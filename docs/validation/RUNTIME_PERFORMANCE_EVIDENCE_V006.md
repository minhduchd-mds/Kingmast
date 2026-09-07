# KINGMAST runtime performance evidence — v0.0.6

Status: CI regression evidence for the warning-only research line. This document does **not** claim automotive real-time qualification, target-hardware qualification, ISO 26262 timing evidence, public-road approval or homologation.

## Purpose

KINGMAST now records a deterministic risk-core performance report in CI so pathological latency regressions are detected before they become part of the engineering evidence bundle.

The report is intentionally narrower than a vehicle-computer qualification program. GitHub-hosted runners are shared cloud machines and their wall-clock behavior cannot prove timing on the intended vehicle hardware.

## Command

```bash
pnpm performance:risk-evidence
```

The underlying runner is `services/risk-engine/src/performance-evidence-cli.ts`.

## Fixed workload

The runner exercises the deterministic risk core across seven independently defined states:

1. safe following;
2. short-headway caution;
3. closing-gap critical;
4. stale-data rejection;
5. future-data rejection;
6. radar unavailable;
7. CAN degraded.

Every timed iteration also verifies the expected severity and, where applicable, the expected safety/degradation reason. A performance result cannot pass if classification behavior changes unexpectedly.

## CI regression budget

Default CI workload:

- warm-up: 2,000 assessments;
- timed assessments: 20,000;
- reported latency: p50, p95, p99 and max;
- default regression ceiling: p99 <= 5 ms.

The 5 ms ceiling is deliberately generous for this small in-process deterministic function. It is a **regression alarm**, not the validated timing requirement of a production ADAS ECU.

Optional environment variables are bounded to prevent accidental runaway benchmark workloads:

- `KINGMAST_RISK_PERF_ITERATIONS`;
- `KINGMAST_RISK_PERF_WARMUP`;
- `KINGMAST_RISK_P99_BUDGET_MS`.

The repository CI uses the default values so a pull request cannot silently relax the checked budget through workflow environment configuration.

## Evidence semantics

The JSON report declares:

- `schema = kingmast-risk-performance-report/v1`;
- `controlAuthority = none`;
- `qualificationClaim = ci-regression-only-not-target-hardware`;
- `targetHardwareQualified = false`;
- runtime Node/platform/architecture metadata;
- workload size;
- p50/p95/p99/max latency;
- classification failures;
- timing pass/fail;
- overall pass/fail.

CI binds the report into the existing engineering evidence anchor and uploads it with the other evidence artifacts.

## What remains for P2 target-hardware qualification

Before Gate 3 closed-track acceptance, performance evidence must be repeated on the selected vehicle-computer hardware with controlled thermal/power conditions and representative sensor/map/display load. The P2 program must add at least:

- boot-to-ready and first usable HMI timing;
- risk/assist latency under concurrent camera/radar/GNSS/map load;
- HMI frame-time and jank evidence at supported display resolutions;
- CPU, RSS/heap and event-loop delay under long-duration replay;
- thermal throttling and brownout/restart behavior;
- WebGL/GPU degradation evidence;
- bounded queue/cache/state behavior during soak;
- reproducible machine, software, firmware, configuration and calibration identity.

Target-hardware pass/fail thresholds must be set from the selected platform, ODD, sensor rates and safety engineering requirements. They must not be copied from an OEM implementation.
