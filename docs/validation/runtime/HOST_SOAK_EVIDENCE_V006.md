# KINGMAST v0.0.6 Host Soak Evidence

## Purpose

This evidence layer exercises the deterministic warning-only risk core continuously on a general-purpose host and records bounded regression signals for memory growth, event-loop delay, CPU consumption and classification stability.

It is a software/CI qualification aid for the vehicle-computer workstream. It is **not** target vehicle-computer qualification, HIL proof, thermal qualification, automotive real-time certification or public-road evidence.

## Runner

`services/risk-engine/src/host-soak-evidence-cli.ts`

Default local execution:

`pnpm performance:host-soak`

The local default is 30 seconds. CI intentionally uses a shorter bounded run so that every pull request can detect gross memory/event-loop/classification regressions without turning shared GitHub runners into a target-hardware claim.

## Report contract

Schema: `kingmast-host-soak-report/v1`

Mandatory claim boundaries:

- `controlAuthority: none`
- `qualificationClaim: ci-host-soak-regression-only-not-target-hardware`
- `targetHardwareQualified: false`
- `physicalVehicleComputerTest: false`

The report includes workload size, operations/second, classification failures, RSS/heap observations, event-loop p99/max delay and process CPU usage. CI fails only on explicit bounded regression limits and classification instability; the measurements do not change the risk decision algorithm.

## CI budgets

The CI gate uses a short host soak with a bounded RSS-growth budget and event-loop p99 budget. These are regression thresholds for the GitHub-hosted process, not performance requirements for an automotive computer.

No CI result may be re-labelled as HIL, target ECU/vehicle-computer qualification, thermal soak, power-cycle qualification or closed-track evidence.

## Physical qualification still required

HIL-011 remains pending until evidence from the actual controller/vehicle computer exists. Required physical work includes controller identity, software commit, long-duration memory/CPU trace, restart/reconnect timeline, sensor I/O behavior, thermal/throttling observations where applicable, bounded-state diagnostics and independent review.

The recommended target-hardware sequence is 1 hour bench soak, 4 hour extended soak and 8 hour endurance soak, with reboot/reconnect and controlled sensor-loss injections between phases. Actual pass budgets must be defined from the selected hardware and system timing requirements before those tests are run.
