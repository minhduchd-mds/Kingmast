# KINGMAST v0.0.6 — Physical Vehicle-Computer Soak Runbook

This runbook converts the existing short CI host-soak regression into a repeatable **physical target capture** and pairs it with a fresh bounded field-diagnostics snapshot from the target risk-engine service. It does not convert KINGMAST into an automotive real-time qualified product and does not authorize closed-track or public-road operation.

## Minimum execution

- Physical vehicle-computer target selected and recorded.
- Hardware instance represented only by a SHA-256 fingerprint; do not commit a raw serial number.
- Exact build commit and build ID recorded.
- Firmware, configuration and calibration revisions recorded.
- Minimum continuous soak duration: **7,200 seconds (2 hours)**.
- Risk classification invariants remain correct for the deterministic scenario set.
- RSS/heap growth and event-loop p99 remain within the declared run budgets.
- Target runtime envelope records bounded uptime, load, free-memory and available thermal telemetry without hostname, network addresses, process arguments, environment values or raw hardware serials.
- A fresh loopback field-diagnostics snapshot records current edge state, sensor ages, rejected-packet count and available provider-trust status/counters without raw provider identifiers or payloads.
- Any reboot, crash, thermal throttling, OOM, watchdog reset or unexpected process restart invalidates the capture and must be recorded separately.

## Preferred guarded workflow

Use `.github/workflows/target-hardware-capture.yml` on a self-hosted runner labeled `kingmast-target` and protected by the `target-hardware-evidence` environment. The workflow executes the multi-hour soak and then captures field diagnostics from the risk-engine service at loopback `http://127.0.0.1:4000`.

For a production-like target, configure the protected environment secrets used only at runtime:

- `KINGMAST_TARGET_VIEWER_TOKEN` — used to bootstrap the short-lived viewer session required by `/v3/health/details`;
- `KINGMAST_TARGET_EDGE_TOKEN` — used when available to read provider-identity/replay diagnostics.

The helper `scripts/capture-target-field-runtime.mjs` refuses non-loopback hosts, does not embed credentials in URLs, bounds each response to 64 KiB, strips device/provider identifiers from the generated runtime source, and writes the source with mode `0600`.

Provider authentication rejection totals are not currently exposed by the service diagnostics endpoint. The field report therefore marks `providerAuthRejected=false` in its coverage block; a zero value for that uncovered counter is **unavailable evidence**, not proof that no authentication rejection occurred. Replay/capacity and provider-status coverage are marked independently based on the endpoints that were actually reachable.

## Manual soak command

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

## Manual field-diagnostics capture

With the risk-engine service running on loopback, capture a bounded runtime source:

```bash
export KINGMAST_TARGET_DIAGNOSTICS_URL=http://127.0.0.1:4000
export KINGMAST_TARGET_VIEWER_TOKEN=<runtime-secret-if-required>
export KINGMAST_TARGET_EDGE_TOKEN=<runtime-secret-if-required>
export KINGMAST_TARGET_FIELD_RUNTIME_PATH=/tmp/kingmast.target-field-runtime.json
node scripts/capture-target-field-runtime.mjs
```

Then generate the physical field report with the same build/hardware/firmware/configuration/calibration identity used for the soak:

```bash
export KINGMAST_PHYSICAL_VEHICLE_COMPUTER_TEST=1
export KINGMAST_REQUIRE_PHYSICAL_FIELD_CAPTURE=1
export KINGMAST_FIELD_DIAGNOSTICS_INPUT_JSON="$(cat /tmp/kingmast.target-field-runtime.json)"
pnpm --silent diagnostics:field-evidence > target-field-diagnostics.json
```

A physical report is `physicalCaptureReady=true` only when identity is complete and fresh core runtime coverage includes sensor ages plus the edge rejected-packet counter.

## After the run

1. Verify soak `allPassed=true`, `physicalVehicleComputerTest=true`, `physicalPreflight.passed=true`, `runtimeEnvelope.passed=true` and `targetHardwareQualified=false`.
2. Verify field diagnostics `physicalCaptureReady=true`, `identity.complete=true`, `health.coverage.physicalCoreCoverageComplete=true` and `targetHardwareQualified=false`.
3. Review `runtimeEnvelope.thermal`, `runtimeEnvelope.memory`, uptime progression, load peaks and field-diagnostics coverage flags for incomplete instrumentation.
4. Hash both generated reports with SHA-256. The guarded workflow produces a v2 bounded manifest binding both report digests.
5. Update `docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json` from `pending-physical-execution` to `captured-awaiting-review` only after the genuine physical run exists; copy only bounded identity/results plus report digests.
6. Keep `targetHardwareQualified=false` and `reviewStatus=pending-independent-review`.
7. Preserve raw evidence artifacts outside source control according to the project evidence-retention process.
8. Run `pnpm qualification:target-soak` before review.

## Privacy boundary

The runtime envelope intentionally excludes hostname, IP/MAC addresses, raw device serials, command-line arguments and environment values. The field diagnostics source and report exclude raw provider IDs, raw request payloads, precise coordinates, raw camera/cabin frames and secrets. Thermal-zone readings are aggregate min/max observations only.

## What this does not test

The process-local soak and field-diagnostics snapshot do not exercise the full HIL matrix, programmable power transients, thermal chamber conditions, EMI/EMC, physical read-only CAN verification or controlled closed-track scenarios. Those remain separate Gate-3 evidence items.
