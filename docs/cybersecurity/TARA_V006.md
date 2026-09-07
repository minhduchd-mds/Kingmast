# KINGMAST v0.0.6 Threat Analysis and Risk Assessment (TARA) draft

Status: engineering cybersecurity draft. It supports the research platform and is not a UN R155 certification claim.

## Security objectives

1. Preserve warning-only authority.
2. Prevent unauthenticated or replayed sensor/provider data from being treated as trusted live state.
3. Keep browser/viewer privileges read-only and short-lived.
4. Protect future device/update identity and software provenance.
5. Minimize privacy-sensitive data.
6. Keep denial-of-service/resource exhaustion from silently producing false healthy HMI state.

## Trust zones

- Z1 Sensor/edge device
- Z2 Risk engine/local gateway
- Z3 HMI/browser/native shell
- Z4 Connected-road/map/navigation providers
- Z5 Build/update/release infrastructure
- Z6 Future cloud/fleet analytics

## Key assets

- edge/device credentials;
- viewer session signing secret;
- V2X provider keys/certificates;
- telemetry integrity/timestamps/sequences;
- risk/assist state;
- software/firmware/update signatures;
- calibration/configuration versions;
- event evidence;
- privacy-sensitive location/DMS metadata.

## Threat register

| ID | Threat | Current/target mitigation | Remaining work |
|---|---|---|---|
| TH-001 | stolen shared edge token | server secret, constant-time compare | migrate production-intent devices to per-device identity/mTLS/rotation |
| TH-002 | packet replay | sequence, boot ID, timestamp/future-skew checks | persist/coordinate identity state where multi-process deployment requires it |
| TH-003 | forged viewer access | scoped HMAC viewer session, HttpOnly cookie, expiry | add deployment-level identity/RBAC when multi-user administration exists |
| TH-004 | forged V2X | provider HMAC + timestamp + server-derived trust state | migrate capable providers to certificate/mTLS trust and revocation |
| TH-005 | endpoint abuse/DoS | body bounds, route limits, in-memory rate limiting, upstream concurrency | bounded TTL/LRU limiter; gateway/WAF; per-client quota |
| TH-006 | client-error log spam | body size + custom header | authenticate/rate-limit and redact before production exposure |
| TH-007 | dependency/build compromise | frozen lockfile, dependency audit | CodeQL/SAST, secret scan, SBOM, action SHA pinning, provenance/attestation |
| TH-008 | malicious update | not production-ready | signed manifest/package, compatibility, secure boot, rollback, anti-rollback |
| TH-009 | key extraction from edge hardware | prototype secrets | secure element/TPM where target supports it; protected provisioning |
| TH-010 | GNSS spoof/jam | accuracy/freshness degradation | add anomaly/cross-source plausibility tests; HMI unavailable state |
| TH-011 | manipulated map/routing service | advisory boundary, bounded parsing | provider allowlist/TLS pinning policy where appropriate; signed datasets where available |
| TH-012 | secret committed to repository | `.gitignore`, source hygiene | automated secret scanning and history review |
| TH-013 | malicious code added to main | CI but branch currently unprotected | repository branch protection/ruleset + CODEOWNERS + required reviews |

## Production-intent identity target

```text
Device secure key
  -> certificate/per-device identity
  -> authenticated channel
  -> device/boot/sequence/timestamp verification
  -> least-privilege ingest scope
```

Shared static tokens remain a research convenience, not a fleet identity design.

## Update-security target

- signed manifest and package;
- signer identity and key rotation;
- anti-rollback counter/version policy;
- compatibility constraints;
- package hash verification before install;
- post-install health confirmation;
- automatic rollback where target platform supports it;
- auditable update status.

## Privacy controls

- no raw secrets in logs;
- no continuous raw DMS video in default storage;
- separate precise location/event retention from operational state;
- define deletion/retention policy before cloud collection expands;
- pseudonymize fleet/device identifiers where operationally possible.

## Security validation backlog

- fuzz/boundary tests for edge/provider schemas;
- rate-limit memory exhaustion test;
- replay/clock-skew test across restart;
- forged/tampered update test;
- invalid/expired/revoked provider identity test;
- WebSocket session-expiry test;
- secret scanning in CI;
- SBOM/provenance verification in release pipeline;
- incident-response tabletop for compromised edge key/update signer.