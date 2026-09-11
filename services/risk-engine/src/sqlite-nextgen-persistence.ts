import {constants, closeSync, lstatSync, mkdirSync, openSync, chmodSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import type {NextgenPersistenceAdapter, NextgenPersistenceRecord} from './nextgen-persistence.js';

const MAX_RECORD_BYTES = 65_536;
const MAX_RECORDS = 8_192;

function validateKey(key: string) {
  if (!key || key.length > 240 || key.includes('\0')) throw new Error('invalid-persistence-key');
}

/** Local single-host storage. SQLite serializes writers; capacity never evicts access grants. */
export class SqliteNextgenPersistence implements NextgenPersistenceAdapter {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    const file = resolve(path);
    mkdirSync(dirname(file), {recursive: true, mode: 0o700});
    // Reject symlinks and create private files before SQLite opens the database.
    const fd = openSync(file, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    closeSync(fd);
    if (!lstatSync(file).isFile()) throw new Error('invalid-persistence-file');
    chmodSync(file, 0o600);
    this.database = new DatabaseSync(file);
    try {
      this.database.exec(`
        PRAGMA journal_mode = DELETE;
        PRAGMA synchronous = FULL;
        PRAGMA secure_delete = ON;
        PRAGMA busy_timeout = 0;
        CREATE TABLE IF NOT EXISTS nextgen_records (key TEXT PRIMARY KEY, record TEXT NOT NULL);
      `);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  async get<T>(key: string): Promise<NextgenPersistenceRecord<T> | null> {
    validateKey(key);
    const row = this.database.prepare('SELECT record FROM nextgen_records WHERE key = ?').get(key);
    if (!row) return null;
    const record = JSON.parse(String(row.record)) as NextgenPersistenceRecord<T>;
    if (record.version !== 1 || !Number.isFinite(record.updatedAtMs) || record.value === undefined) {
      throw new Error('invalid-persistence-record');
    }
    return record;
  }

  async set<T>(key: string, record: NextgenPersistenceRecord<T>): Promise<void> {
    validateKey(key);
    if (record.version !== 1 || !Number.isFinite(record.updatedAtMs) || record.value === undefined) {
      throw new Error('invalid-persistence-record');
    }
    const serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized) > MAX_RECORD_BYTES) throw new Error('persistence-record-too-large');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.database.prepare('SELECT key FROM nextgen_records WHERE key = ?').get(key);
      const count = this.database.prepare('SELECT count(*) AS n FROM nextgen_records').get()!;
      if (!existing && Number(count.n) >= MAX_RECORDS) throw new Error('persistence-capacity-reached');
      this.database.prepare('INSERT INTO nextgen_records (key, record) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET record = excluded.record').run(key, serialized);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    this.database.prepare('DELETE FROM nextgen_records WHERE key = ?').run(key);
  }

  async list(prefix: string): Promise<string[]> {
    // substr uses literal prefixes, including '%' and '_'; LIKE would treat them as wildcards.
    return this.database.prepare('SELECT key FROM nextgen_records WHERE substr(key, 1, ?) = ? ORDER BY key').all(prefix.length, prefix).map(row => String(row.key));
  }

  close() { this.database.close(); }
}
