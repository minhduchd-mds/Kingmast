# KINGMAST v0.0.6 HARA draft — Level 0 research platform

Status: engineering hazard-analysis draft. It is not an ISO 26262 certification artifact and does not assign formal ASIL values.

## Item boundary

KINGMAST observes trusted sensor/vehicle/context inputs, computes deterministic warning/advisory state, presents driver information and records bounded evidence. Vehicle actuation is prohibited.

## Hazard register

| ID | Hazardous behavior | Potential consequence | Primary controls | Verification |
|---|---|---|---|---|
| HZ-001 | Missed high-risk closing-gap warning | Driver receives no useful warning before conflict | freshness/confidence/radar-health gates; deterministic TTC/THW; sensor-degraded HMI | risk unit tests; stale/radar-loss scenarios |
| HZ-002 | False or unstable critical warning | distraction/startle/reduced trust | alert stabilizer; confidence thresholds; single-primary-warning attention policy | oscillation/noise tests; HMI tests |
| HZ-003 | Stale/frozen data accepted as live | incorrect risk/spatial state | timestamp/skew checks; sensor-age downgrade; replay guard | fault injection |
| HZ-004 | Simulator silently replaces failed live telemetry | driver sees fabricated healthy context | live-session truth rule; explicit stale/offline mode | runtime resilience UI tests |
| HZ-005 | Public map/V2X treated as authoritative real-time truth | misleading signal/speed/hazard advice | provider trust/source policy; signed live V2X; advisory-only suppression | provider trust tests; forged feed test |
| HZ-006 | DMS false confidence presented as fact | driver attention state misrepresented | confidence + availability + no identity inference; uncertain state | DMS scenario tests |
| HZ-007 | HMI overload masks critical warning | delayed comprehension | alert priority/attention arbitration; parked progressive disclosure | Playwright + human-factors test |
| HZ-008 | Sensor disagreement creates false precision | incorrect object/lane interpretation | explicit fusion confidence; health/calibration status | disagreement scenarios |
| HZ-009 | Software update leaves inconsistent or untrusted runtime | unavailable/mis-versioned assistance | signed package/manifest; compatibility; rollback; version evidence | update fault injection |
| HZ-010 | Spoofed/replayed edge/provider data accepted | false warning/context or service disruption | auth, HMAC/session signatures, sequence/timestamp replay controls | security tests |
| HZ-011 | Vehicle-control capability accidentally added | unintended actuation path | architectural read-only adapter + CI boundary + review | static architecture test + CODEOWNERS |
| HZ-012 | Excessive resource use freezes HMI/risk transport | warning latency/unavailability | bounded buffers/maps; performance watchdog/metrics; degraded UI | soak/load/WebGL-failure tests |

## Safety goals

- SG-001: KINGMAST SHALL never provide vehicle actuation authority from mainline software.
- SG-002: safety-relevant sensing SHALL be freshness/confidence/health aware and fail degraded/unavailable.
- SG-003: a live vehicle session SHALL never be replaced silently by simulated truth.
- SG-004: externally sourced connected/map data SHALL remain advisory and trust-qualified.
- SG-005: one highest-priority driver warning SHALL own textual attention during a critical event.
- SG-006: DMS SHALL expose uncertainty/availability and SHALL NOT require identity recognition or continuous raw-video retention.
- SG-007: software/firmware versions used for evidence SHALL be identifiable and update provenance verifiable.
- SG-008: security-sensitive ingress SHALL authenticate and reject replayed/untrusted data.
- SG-009: safety-relevant runtime state SHALL remain bounded and SHALL fail closed or degrade explicitly when configured capacity is exhausted.

## Traceability convention

Future requirements/tests should reference safety-goal IDs in comments or scenario manifests, for example:

```text
requirement: KM-SAF-SG-003
hazard: HZ-004
test: runtime-resilience/live-stale-does-not-simulate
expected: explicit degraded state; no simulator substitution
```

## Formalization still required before production intent

- severity/exposure/controllability analysis by qualified functional-safety reviewers;
- formal safety goals/functional safety concept/technical safety concept;
- hardware failure analysis and diagnostic coverage;
- independence and confirmation measures where applicable;
- production/operation/service/decommissioning safety lifecycle evidence.
