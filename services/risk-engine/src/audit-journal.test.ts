import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import type {EdgeEventRecord} from '@kingmast/contracts';
import {BoundedAuditJournal,createAuditJournalFromEnv,verifyAuditJournalText} from './audit-journal.js';

const dirs:string[]=[];
function record(index:number):EdgeEventRecord{return{id:`event-${index}`,timestampMs:1_800_000_000_000+index,sequence:index,severity:'caution',type:'vehicle-too-close',title:'Vehicle too close',message:`bounded audit ${index}`.padEnd(96,'x'),objectId:`obj-${index}`,position:{lat:21.0285,lng:105.8542}};}
afterEach(async()=>{await Promise.all(dirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

describe('BoundedAuditJournal',()=>{
  it('persists bounded metadata with a tamper-evident hash chain',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    const journal=new BoundedAuditJournal(path,16*1024,3);
    journal.append(record(1));
    journal.append(record(2));
    await journal.flush();
    const text=await readFile(path,'utf8');
    const lines=text.trim().split('\n');
    const first=JSON.parse(lines[0]!);
    const second=JSON.parse(lines[1]!);
    expect(first.schema).toBe('kingmast-audit-event/v2');
    expect(first.previousHash).toBeNull();
    expect(first.entryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.previousHash).toBe(first.entryHash);
    expect(first.record.id).toBe('event-1');
    expect(first.record).not.toHaveProperty('rawVideo');
    expect(verifyAuditJournalText(text)).toMatchObject({ok:true,entries:2,legacyEntries:0,lastHash:second.entryHash});
    expect(journal.status()).toMatchObject({enabled:true,pending:0,written:2,writeErrors:0,integrityErrors:0,integrityHead:second.entryHash});
  });

  it('detects tampered event content and broken chain links',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    const journal=new BoundedAuditJournal(path,16*1024,3);
    journal.append(record(1));journal.append(record(2));await journal.flush();
    const text=await readFile(path,'utf8');
    expect(verifyAuditJournalText(text).ok).toBe(true);
    expect(verifyAuditJournalText(text.replace('Vehicle too close','Vehicle very close'))).toMatchObject({ok:false,reason:'entry-hash-mismatch'});
    const lines=text.trim().split('\n').map((line)=>JSON.parse(line));
    lines[1].previousHash='0'.repeat(64);
    expect(verifyAuditJournalText(lines.map((line)=>JSON.stringify(line)).join('\n'))).toMatchObject({ok:false,reason:'chain-link-mismatch'});
  });

  it('migrates a legacy v1 prefix by starting an explicit v2 chain boundary',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    await writeFile(path,`${JSON.stringify({schema:'kingmast-audit-event/v1',record:record(0)})}\n`,'utf8');
    const journal=new BoundedAuditJournal(path,16*1024,3);
    journal.append(record(1));
    await journal.flush();
    const text=await readFile(path,'utf8');
    const lines=text.trim().split('\n').map((line)=>JSON.parse(line));
    expect(lines[1].schema).toBe('kingmast-audit-event/v2');
    expect(lines[1].previousHash).toBeNull();
    expect(verifyAuditJournalText(text)).toMatchObject({ok:true,entries:1,legacyEntries:1,lastHash:lines[1].entryHash});
  });

  it('rotates and bounds the number of journal files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    const journal=new BoundedAuditJournal(path,16*1024,2);
    for(let index=0;index<140;index+=1)journal.append(record(index));
    await journal.flush();
    const files=(await readdir(dir)).filter((name)=>name.startsWith('events.jsonl'));
    expect(files.length).toBeLessThanOrEqual(2);
    expect(journal.status().rotations).toBeGreaterThan(0);
  });

  it('fails configuration instead of silently accepting unbounded settings',()=>{
    expect(()=>createAuditJournalFromEnv({KINGMAST_AUDIT_JOURNAL_PATH:'/tmp/audit',KINGMAST_AUDIT_MAX_FILES:'1000'})).toThrow(/between 1 and 10/);
  });
});
