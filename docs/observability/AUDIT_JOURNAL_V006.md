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

## Failure behavior

Disk persistence is asynchronous. A journal write failure:

- increments journal error state;
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

When the active file would exceed the byte limit, files rotate. The configured file count is a hard upper bound. Files are created with owner-only mode where the platform honors POSIX permissions.

## Production-intent backlog

This local journal is not the final persistence architecture. Production intent still requires:

1. protected durable database/object storage;
2. integrity/authenticity protection for evidence records;
3. retention and deletion policy;
4. bounded retry/back-pressure strategy;
5. backup/restore verification;
6. software/calibration/configuration provenance attached to safety events;
7. fleet/device pseudonymization and privacy review;
8. operational alerting when evidence persistence becomes degraded.

Real-time safety state should remain local/in-memory and must not depend on cloud/database availability.
