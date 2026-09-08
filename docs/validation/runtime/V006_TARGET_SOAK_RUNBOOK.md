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
- Target runtime envelope records bounded uptime, load, free-memory and available thermal telemetry without hostname, network addresses, process arguments, environment values or raw hardware serials.
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

# Recommended for Linux/Raspberry Pi targets where thermal zones are exposed.
export KINGMAST_REQUIRE_THERMAL_TELEMETRY=1
export KINGMAST_HOST_SOAK_MAX_TEMP_C=85
export KINGMAST_HOST_SOAK_MIN_FREE_MEMORY_MIB=256

pnpm performance:host-soak > target-host-soak.json
```

The runner accepts up to 43,200 seconds (12 hours). Physical mode fails preflight when the duration is below two hours or any required identity field is missing. When `KINGMAST_REQUIRE_THERMAL_TELEMETRY=1`, the run also fails if no readable thermal-zone telemetry is available. `KINGMAST_HOST_SOAK_MAX_TEMP_C` and `KINGMAST_HOST_SOAK_MIN_FREE_MEMORY_MIB` are explicit capture budgets and should be chosen for the selected target before execution rather than relaxed after a failed run.

## After the run

1. Verify `allPassed=true`, `physicalVehicleComputerTest=true`, `physicalPreflight.passed=true`, `runtimeEnvelope.passed=true` and `targetHardwareQualified=false`.
2. Review `runtimeEnvelope.thermal`, `runtimeEnvelope.memory`, uptime progression and load peaks for unexpected behavior.
3. Hash the generated report with SHA-256.
4. Update `docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json` from `pending-physical-execution` to `captured-awaiting-review` and copy only bounded identity/results plus the report SHA-256.
5. Keep `targetHardwareQualified=false` and `reviewStatus=pending-independent-review`.
6. Preserve the raw evidence artifact outside source control according to the project evidence-retention process.
7. Run `pnpm qualification:target-soak` before review.

## Privacy boundary

The runtime envelope intentionally excludes hostname, IP/MAC addresses, raw device serials, command-line arguments and environment values. Thermal-zone readings are aggregate min/max observations only. Do not add precise vehicle position, raw camera/cabin frames, credentials or full environment dumps to the committed registry.

## What this does not test

The process-local soak does not exercise full sensor I/O, ESP32 power/reset behavior, camera/radar transport, thermal chamber conditions, vehicle power transients, EMI/EMC, display rendering, HIL fault injection or closed-track scenarios. Those remain separate Gate-3 evidence items.
