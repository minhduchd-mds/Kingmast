# Runtime trust hardening

This hardening batch intentionally does **not** change the KINGMAST product version.

Security and safety goals:

- fail closed when realtime telemetry is stale, malformed, oversized, replayed, or provenance-inconsistent;
- prevent device GPS from inheriting simulated perception objects or alerts;
- reject duplicate telemetry sequence replay;
- reject previously seen edge boot identities and rate-limit boot-ID churn with bounded memory;
- compare the full browser origin for viewer-session issuance and apply same-origin/no-sniff response policy;
- preserve the warning-only, read-only vehicle-control boundary.

The changes are staged on `feat/runtime-trust-hardening` and require the existing CI/security gates before merge.
