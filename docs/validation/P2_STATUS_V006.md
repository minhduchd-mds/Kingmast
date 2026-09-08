# KINGMAST v0.0.6 — P2 Status

P2 advances KINGMAST from the completed P0/P1 software baseline toward repeatable vehicle-computer qualification and controlled closed-track evidence. The product boundary remains warning-only SAE Level 0 with no steering, braking, throttle, torque, gear, drivetrain or CAN-write authority.

## Completed software/evidence baselines

- Deterministic risk-core performance evidence with p50/p95/p99/max and classification invariants.
- CI host-soak regression for CPU, RSS/heap, event-loop delay and deterministic risk classifications.
- HMI performance evidence for boot-to-ready, first usable driving surface, frame timing/jank and WebGL context-loss fallback.
- Release qualification matrix for toolchain, display classes and target classes.
- Gate-3 acceptance criteria and human-readable acceptance pack.
- Bounded field-diagnostics evidence contract covering build identity, hashed hardware-instance identity, firmware/configuration/calibration revisions, sensor freshness/reject counts and aggregated provider-trust failures.
- Physical target soak runner/runbook with a minimum two-hour preflight and maximum twelve-hour execution window.
- Target-soak honesty registry that remains `pending-physical-execution` until real target evidence exists.
- Engineering evidence anchor binds 17 materials, including field diagnostics and target-soak registry.

## Latest validated CI baseline

For commit `f0b47e76174e6a255b6297b5097761e575cb640e`:

- Verify workflow: passed.
- CodeQL JavaScript/TypeScript analysis: passed.
- Unit/contract tests: passed.
- Field diagnostics software contract: passed.
- Target-soak evidence honesty policy: passed while preserving `physicalVehicleComputerTest=false` and `targetHardwareQualified=false`.
- CI host soak: 3 seconds, 7,996,500 risk operations, RSS growth 10.301 MiB, event-loop p99 20.414 ms, all classification invariants passed.
- HMI performance: boot-to-ready 2642.41 ms, first usable driving surface 2675.15 ms, frame p99 50 ms, jank ratio 1.85%, WebGL context-loss fallback passed.

These figures are CI regression evidence only and are not target-hardware qualification results.

## Remaining physical Gate-3 blockers

1. Execute at least a two-hour soak on the selected vehicle-computer target and capture the bounded identity/evidence fields.
2. Capture field diagnostics from the physical target with build, firmware, configuration and calibration identity plus hashed hardware-instance identity.
3. Execute physical HIL/fault-injection cases, including controller/sensor I/O, restart/reconnect and power/fault behavior.
4. Execute controlled closed-track scenarios with timestamped evidence and operator observations.
5. Complete independent safety, cybersecurity and engineering review.

Public-road research and target-hardware qualification remain blocked until those physical evidence items and reviews are complete.
