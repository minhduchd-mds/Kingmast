# KINGMAST P0–P6 Physical Runtime · v0.0.6

## Purpose

This increment turns the existing physical-validation contracts into executable, fail-closed runtime primitives without manufacturing physical qualification. KINGMAST remains warning-only/advisory-only SAE Level 0 with `controlAuthority=none`, no steering/braking/throttle/gear/torque/drivetrain command authority and no CAN-write authority.

The committed physical registries remain intentionally unchanged: real target hardware, HIL and controlled-track results must still originate from independently reviewed physical work.

## P0 — Safety and evidence boundary

Implementation: `services/risk-engine/src/physical-validation-runtime.ts`.

- Reuses the shared `ReadOnlyVehiclePort`; a non-read-only vehicle port is rejected at construction.
- Adds a bounded protected-evidence metadata runtime. It never accepts raw evidence bytes and never stores raw physical evidence in source control.
- Requires backend provisioning, reviewed access control, encryption at rest and immutable retention before metadata registration.
- Rejects invalid SHA-256/source-commit bindings, unsafe object references, duplicate record IDs and duplicate package digests.
- Registration never performs automatic qualification or registry mutation.

The source-controlled evidence-store index remains `backendConfigured=false` and empty until a real external protected store is provisioned and independently reviewed.

## P1 — Vehicle-computer runtime

`VehicleComputerRuntime` wraps only the shared read-only vehicle contract. Snapshot freshness, future-clock skew and CAN/GNSS-IMU/ECU health are evaluated against caller-supplied runtime requirements. Diagnostic events use a bounded in-memory buffer.

No vehicle-specific connector position, wire color, fuse/current value, protocol calibration or undocumented OEM parameter is introduced.

## P2 — Reviewed time synchronization and calibration lifecycle

`TimeSyncMonitor` refuses to qualify cross-device evidence until finite, non-negative numeric limits and a review reference are explicitly supplied as reviewed configuration. The repository continues to define no guessed bench-specific offset/uncertainty/drift thresholds.

`transitionCalibration` implements explicit physical lifecycle transitions. Capture requires source-commit and calibration SHA-256 binding. Approval/rejection requires an independent reviewer different from the calibration operator. There is no automatic promotion path.

## P3 — HIL bench capture lifecycle

`HilBenchAgent` starts every session `BLOCKED`. A scenario can become `READY` only when hardware review, calibration review, reviewed time synchronization, physical read-only authority verification and source-commit binding are all supplied. Capture moves only to `CAPTURED` and requires `pending-independent-review`; it does not create a physical pass.

The committed HIL registry remains 12 pending scenarios with no evidence attached. Existing physical package ingestion, orchestration, protected-store registration and independent review workflows remain authoritative for later promotion.

## P4 — Existing target-soak and hardware qualification integration

This increment deliberately does not duplicate the existing target-soak runner, hardware qualification matrix, device provisioning template, harness mapping template, boot-security evidence and runtime-health supervisor. The new vehicle runtime and evidence metadata runtime are designed to feed those existing workstreams once actual hardware is selected.

A software test or CI job cannot satisfy target-controller soak, thermal/resource envelope, physical TX-disable verification or independent hardware review.

## P5 — External CARLA/esmini session gate

Implementation: `autonomy-lab/digital-twin/p5-external-simulator-session.mjs`.

- Remains inside `autonomy-lab`; production code must not import it.
- Builds only bounded invocations from the reviewed external-runner contract.
- Runtime network download remains prohibited.
- Validates source commit, scenario/result SHA-256 binding, engine and campaign scope.
- Fixture execution cannot claim external execution.
- External simulation is always non-physical: it cannot satisfy HIL, controlled track, target-hardware qualification or public-road approval.

The existing guarded external-simulator workflow remains responsible for actual dedicated-runner execution and evidence retention when such a runner is provisioned.

## P6 — Controlled-track capture lifecycle

`ControlledTrackAgent` starts `BLOCKED`. All ten Gate-3 prerequisites must be true, and the independent observer must differ from the operator, before a scenario can become `READY`. Capture moves only to `CAPTURED` with `pending-independent-review`; it neither authorizes a test nor creates an approved result.

The committed CT-001..CT-008 registry remains pending and `closedTrackApproved=false`.

## Unified software portfolio

`buildP0P6Portfolio` exposes software/runtime readiness without collapsing it into a physical score. Its terminal claims remain hard-false:

- `physicalQualificationComplete=false`
- `targetHardwareQualified=false`
- `closedTrackApproved=false`
- `publicRoadApproved=false`

## Verification

The implementation is guarded by:

- `services/risk-engine/src/physical-validation-runtime.test.ts`
- `autonomy-lab/digital-twin/p5-external-simulator-session.mjs --selftest`
- `scripts/p0-p6-physical-runtime-policy-check.mjs`
- existing architecture/safety/source-hygiene/security/qualification gates
- full repository CI and CodeQL before merge

## Still requires real external work

Actual completion still requires selection and authorized documentation of the real vehicle-computer/display/sensors/read-only adapter; reviewed harness mapping; physical device provisioning; controlled sensor calibration; reviewed cross-device time synchronization; a provisioned protected evidence backend; genuine target soak; genuine CARLA/esmini runner evidence where claimed; HIL-001..HIL-012 physical execution and independent review; CT-001..CT-008 controlled-track execution and independent review; and program-level safety/SOTIF, cybersecurity, hardware, HMI/human-factors and evidence-integrity sign-off.
