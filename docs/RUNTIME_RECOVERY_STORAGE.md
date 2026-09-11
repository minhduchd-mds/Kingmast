# Runtime recovery and local storage

This change retains product version 0.0.7 and the warning-only / advisory-only boundary.

## Durable profiles and access policy

The risk engine uses Node.js built-in SQLite (Node.js 22.13 or newer), without an
additional native package. Profiles, privacy preferences, remembered places/routes,
access grants, revocations and access audit records use the same repository interface.
Only persistence is changed; permission evaluation remains advisory and grants no actuator authority.

Configuration is server-side:

```sh
export KINGMAST_NEXTGEN_PERSISTENCE=sqlite
export KINGMAST_NEXTGEN_SQLITE_PATH=/var/lib/kingmast/nextgen.sqlite
```

The default path is `.kingmast-data/nextgen.sqlite`, relative to the risk-engine
working directory (normally `services/risk-engine` when launched through pnpm).
Use a writable persistent local volume with one running risk-engine instance.
Do not place it on network storage or use multiple live backend replicas: other
runtime state, including access caches and replay guards, remains process-local.
An ephemeral container filesystem does not survive container replacement.

SQLite commits each write transaction before reporting success and uses FULL
synchronous mode. It does not silently fall back to memory if opening or writing
the database fails. Corruption or lock contention raises an error. Writes are
bounded to 64 KiB per record and 8,192 records; reaching capacity rejects new keys
instead of evicting access grants or revocations. Existing repository-specific
retention limits still apply. Lock waiting is disabled to avoid stalling the
warning process behind another writer; disk latency still requires target testing.

Database files are created with mode 0600; newly created directories use 0700.
The database contains personal metadata and is not encrypted by this adapter.
Protect the volume with OS access controls and disk encryption as appropriate.
Deletion uses SQLite secure_delete; backups and filesystem snapshots have their
own retention. For a consistent backup, stop the backend before copying the
database, or use SQLite's supported backup tooling. Restore only while stopped.
Never restore an old backup without reconciling subsequent access revocations.

There is no migration from earlier RAM-only state after that old process has
stopped. Export/recreate required profiles before switching that deployment.
`KINGMAST_NEXTGEN_PERSISTENCE=memory` is permitted only with explicit local insecure
development enabled; it remains non-durable.

## Realtime recovery

The HMI arms a five-second watchdog when opening a WebSocket. Heartbeats and
telemetry keep it alive. A timeout retires the socket and its callbacks, then
schedules reconnect through the existing backoff even if no close event arrives.
Connection attempts that never finish are also retired. Cleanup disarms the
watchdog, and reconnect clears previous transport freshness timestamps. Stored
vehicle data is not replaced with healthy simulator data.

## Camera freshness and logging

Camera frames must satisfy both monotonic and wall-clock age checks before
inference and again before signing/publishing. A slow inference result is dropped
with its original capture timestamp preserved; `staleAfterInference` is observable.
Application-level camera-open errors no longer include the source URL, and HTTP
transport errors log their exception class rather than credential-bearing text.
This applies to both object and speed-sign publisher error messages. Third-party
camera/decoder logging should be configured separately on the target device.

CI runs `python edge/camera-detector/runtime_selftest.py`, including mocked
main-loop regression tests without physical camera or model dependencies.
Software regression results do not constitute physical camera, thermal, power-loss,
vehicle-computer timing or HIL qualification.
