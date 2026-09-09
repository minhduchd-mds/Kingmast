# KINGMAST v0.0.6 — Physical Bench Execution Runbook

Status: preparation-only. This runbook does not assert that a physical bench exists, does not provide a vehicle-specific pinout, and does not authorize vehicle/public-road operation.

## 0. Frozen baseline

Before connecting selected hardware, freeze the exact KINGMAST source commit/build, vehicle-computer image, firmware revisions, configuration revisions, calibration procedure revisions, harness revision and evidence time source. Record bounded identities or SHA-256 bindings; do not commit raw hardware serials, credentials, precise coordinates, raw cabin video or raw camera frames.

## 1. Bench and harness review

Use `V006_PHYSICAL_BENCH_EXECUTION_PACK.json` as the logical interface contract. The selected bench implementation must be reviewed against authorized hardware/service documentation. Vehicle connector positions, wire colors, fuse/current limits and vendor-specific power requirements are not guessed by KINGMAST.

The CAN integration boundary is receive-only. The selected adapter/harness must demonstrate that the KINGMAST path has no transmit authority. An independent bus analyzer is part of the evidence set.

## 2. Device provisioning

Bind the selected vehicle computer, display, sensors and read-only CAN interface to bounded hardware-instance SHA-256 values, firmware/configuration revisions and the exact source commit. Provisioning begins as `unprovisioned`; CI cannot promote it to reviewed-pass.

## 3. Calibration capture

Use the reviewed procedure for the selected sensor. Calibration capture requires source-commit, hardware/configuration/firmware and measurement SHA-256 bindings. An operator and a different independent reviewer are required before approval. Hardware/mounting/firmware/geometry/time-sync changes invalidate approved calibration according to the lifecycle registry.

## 4. Bench smoke and authority check

Before scenario execution, confirm synchronized logging, bounded diagnostics, sensor freshness visibility and the physical emergency power-isolation method. Independently verify the receive-only CAN boundary before and during bench execution. Any unexpected KINGMAST transmit activity is an abort condition.

## 5. HIL execution

Execute only the reviewed HIL scenario set embedded in `V006_PHYSICAL_BENCH_EXECUTION_PACK.json`. Each HIL-001..HIL-012 entry remains pending until a genuine physical bench capture exists. CI/SIL/simulator success cannot satisfy a physical HIL result.

## 6. Target soak

After the selected target and sensor baseline are frozen, run the existing target-soak procedure for the approved duration and retain resource, thermal, restart/reconnect and field-diagnostic evidence. A host/CI soak is regression evidence only.

## 7. Evidence review

All physical captures remain `captured-awaiting-independent-review` until a different reviewer assesses the evidence. Registry promotion is a controlled engineering action and is not performed automatically by repository workflows.

## Safety boundary

KINGMAST remains warning-only/advisory-only SAE Level 0. This runbook creates no steering, braking, throttle, gear, torque, drivetrain or CAN-write authority. It does not grant target-hardware qualification, homologation, controlled-track approval or public-road authorization.
