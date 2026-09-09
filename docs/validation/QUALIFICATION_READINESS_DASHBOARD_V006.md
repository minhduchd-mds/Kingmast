# KINGMAST v0.0.6 — Qualification Readiness Dashboard

This dashboard is a repository-side engineering readiness view. It deliberately separates **software preparation** from **reviewed physical evidence** so that CI, simulation or bookkeeping cannot be mistaken for target-hardware qualification.

## Two scores, two meanings

`softwarePreparationScorePercent` measures whether the repository contains the required fail-closed contracts for hardware qualification, sensor calibration lifecycle, HIL coverage, controlled-track coverage, target soak and independent review. It can reach 100% before any physical bench is available.

`physicalEvidenceCompletionScorePercent` measures only independently reviewable physical evidence recorded in the fail-closed registries. Its weighted baseline is:

- hardware targets: 20%
- sensor calibration: 15%
- target vehicle-computer soak: 15%
- HIL: 25%
- controlled track: 15%
- independent review: 10%

A physical-evidence score of 100% still does **not** set `targetHardwareQualified`, `closedTrackApproved` or `publicRoadApproved` to true. Those decisions remain outside repository automation.

## Generated report

Run:

```bash
pnpm qualification:readiness
```

The command emits `kingmast-qualification-readiness-report/v1` JSON with:

- hardware target coverage and pending IDs;
- sensor calibration states and pending IDs;
- target-soak physical/review state;
- HIL-001..HIL-012 status coverage;
- CT-001..CT-008 status coverage;
- independent-review domain coverage;
- software preparation score;
- reviewed physical-evidence completion score;
- explicit Level-0 and no-qualification boundaries.

P3 CI stores the generated report as an engineering artifact. The report is derived from the committed registries and does not edit them.

## Hardware matrix

`docs/validation/hardware/V006_HARDWARE_QUALIFICATION_MATRIX.json` defines the physical evidence expected for the vehicle computer, primary display, front radar, surround camera set, DMS camera, GNSS/IMU and read-only CAN interface. Pending targets keep `evidence: null`. Captured targets remain `captured-awaiting-independent-review`; repository automation cannot promote them.

## Sensor calibration lifecycle

`docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json` defines a fail-closed lifecycle from unprovisioned hardware through provisioning, calibration capture, independent review, approval/rejection and invalidation. Hardware replacement, mounting/harness change, sensor firmware change, geometry/configuration change, calibration-input change, time-sync loss, maintenance/impact events and review revocation invalidate an approved calibration and require controlled recalibration.

No committed sensor is currently marked approved. CI may validate lifecycle structure only; it cannot create physical calibration evidence or mutate production thresholds.

## Safety boundary

KINGMAST remains warning-only/advisory-only SAE Level 0. The readiness dashboard does not create steering, braking, throttle, gear, torque, drivetrain or CAN-write authority and does not authorize public-road testing.
