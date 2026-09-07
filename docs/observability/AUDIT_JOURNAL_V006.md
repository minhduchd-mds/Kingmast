# KINGMAST v0.0.6 bounded audit journal

Status: research/bench durability layer. It is intentionally decoupled from real-time warning computation and is not a production forensic store.

## Purpose

The in-memory `EdgeEventBuffer` remains the immediate runtime event source. When `KINGMAST_AUDIT_JOURNAL_PATH` is configured, each newly deduplicated `EdgeEventRecord` is also queued to a bounded append-only JSONL journal.

The journal exists to retain small safety-event evidence across process restarts without making the warning path depend on storage availability.

## Data boundary

The journal stores only bounded `EdgeEventRecord` metadata:

- event id and timestamp;
- telemetry sequence;
- severity/type/title/message;
- object id when present;
- event position.

It does not store raw continuous camera video, cabin video, radar frames, full GNSS traces, device secrets, authentication headers or provider credentials.

## Tamper-evident local chain

New records use `kingmast-audit-event/v2`. Each JSONL entry contains:

- `previousHash` — SHA-256 hash of the previous local entry, or `null` at a chain boundary;
- `record` — bounded event metadata;
- `entryHash` — SHA-256 over the schema, previous hash and record.

`verifyAuditJournalText()` detects modified record content and broken links inside a retained journal file. On startup, the journal validates the active v2 file before continuing the chain. A corrupted active journal degrades evidence persistence rather than silently appending trusted-looking data.

This is **tamper-evidence, not cryptographic authenticity**. A local attacker able to rewrite the complete file can recompute an unsigned chain. Production forensic evidence still requires protected keys/storage, signed or externally anchored evidence, access control and independent retention controls.

Legacy `kingmast-audit-event/v1` files are accepted only as a migration boundary because v1 did not contain an integrity chain; the first v2 record starts a new chain from that boundary.

## Failure behavior

Disk persistence is asynchronous. A journal write or integrity-initialization failure:

- increments observable journal error state;
- does not block deterministic risk calculation;
- does not block driver warning delivery;
- must not be interpreted as a healthy forensic/evidence state.

This separates `safety operation` from `evidence durability` while making loss of persistence observable through `auditStatus()`.

Viewer-authenticated status is available at `GET /v3/audit/status` and is also included in `GET /v3/diagnostics` and `GET /v3/health/details`. The public `/health` endpoint does not expose journal path or state.

## Bounds

Configuration:

- `KINGMAST_AUDIT_JOURNAL_PATH` — opt-in path;
- `KINGMAST_AUDIT_MAX_BYTES` — 16 KiB to 100 MiB, default 5 MiB;
- `KINGMAST_AUDIT_MAX_FILES` — 1 to 10, default 3.

When the active file would exceed the byte limit, files rotate. The configured file count is a hard upper bound. Files are created with owner-only mode where the platform honors POSIX permissions. Rotation keeps the in-process chain head where historical files are retained; a one-file configuration deliberately starts a new chain after deleting its only old file.

## Production-intent backlog

This local journal is not the final persistence architecture. Production intent still requires:

1. protected durable database/object storage;
2. cryptographic authenticity or externally anchored integrity for evidence records;
3. retention and deletion policy;
4. bounded retry/back-pressure strategy;
5. backup/restore verification;
6. software/calibration/configuration provenance attached to safety events;
7. fleet/device pseudonymization and privacy review;
8. operational alerting when evidence persistence becomes degraded.

Real-time safety state should remain local/in-memory and must not depend on cloud/database availability.
