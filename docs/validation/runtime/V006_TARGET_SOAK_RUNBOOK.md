# KINGMAST v0.0.6 — Physical Vehicle-Computer Soak Runbook

This runbook converts the existing short CI host-soak regression into a repeatable **physical target capture**. It does not convert KINGMAST into an automotive real-time qualified product and does not authorize closed-track or public-road operation.

## Minimum execution

- Physical vehicle-computer target selected and recorded.
- Hardware instance represented only by a SHA-256 fingerprint; do not commit a raw serial number.
- Exact build commit and build ID recorded.
- Firmware, configuration and calibration revisions recorded.
- Minimum continuous soak duration: **7,200 seconds (2 hours)**.
- Risk classification invariants remain correct for the deterministic scenario set.
- RSS/heap growth and event-loop p99 remain within the declared run budgets.
- Any reboot, crash, thermal throttling, OOM, watchdog reset or unexpected process restart invalidates the capture and must be recorded separately.

## Command

```bash
export KINGMAST_PHYSICAL_VEHICLE_COMPUTER_TEST=1
export KINGMAST_HOST_SOAK_SECONDS=7200
export KINGMAST_PRODUCT_VERSION=0.0.6
export KINGMAST_BUILD_COMMIT=<commit>
export KINGMAST_BUILD_ID=<build-id>
export KINGMAST_HARDWARE_TARGET=<target-model>
export KINGMAST_HARDWARE_INSTANCE_SHA256=<sha256-of-local-instance-id>
export KINGMAST_FIRMWARE_REVISION=<firmware-revision>
export KINGMAST_CONFIGURATION_REVISION=<configuration-revision>
export KINGMAST_CALIBRATION_REVISION=<calibration-revision>
pnpm performance:host-soak > target-host-soak.json
```

The runner accepts up to 43,200 seconds (12 hours). Physical mode fails preflight when the duration is below two hours or any required identity field is missing.

## After the run

1. Verify `allPassed=true`, `physicalVehicleComputerTest=true`, `physicalPreflight.passed=true` and `targetHardwareQualified=false`.
2. Hash the generated report with SHA-256.
3. Update `docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json` from `pending-physical-execution` to `captured-awaiting-review` and copy only bounded identity/results plus the report SHA-256.
4. Keep `targetHardwareQualified=false` and `reviewStatus=pending-independent-review`.
5. Preserve the raw evidence artifact outside source control according to the project evidence-retention process.
6. Run `pnpm qualification:target-soak` before review.

## What this does not test

The process-local soak does not exercise full sensor I/O, ESP32 power/reset behavior, camera/radar transport, thermal chamber conditions, vehicle power transients, EMI/EMC, display rendering, HIL fault injection or closed-track scenarios. Those remain separate Gate-3 evidence items.
