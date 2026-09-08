# KINGMAST v0.0.6 — Field Diagnostics Evidence

This P2 diagnostic path is for service/engineering evidence only. KINGMAST remains warning-only Level 0 with no steering, braking, throttle, torque, gear, drivetrain or CAN-write authority.

## Evidence model

`services/risk-engine/src/field-diagnostics.ts` produces a bounded report containing:

- product/build identity;
- hardware target class plus **SHA-256 hashed** hardware-instance identity instead of a raw serial number;
- firmware, configuration and calibration revisions;
- edge health state;
- GNSS/radar/camera freshness ages;
- rejected edge-packet count;
- aggregated provider-auth/replay/capacity trust failures;
- aggregated provider health/trust posture without provider identifiers;
- explicit privacy assertions showing that raw cabin video, raw camera frames, precise coordinates, raw request payloads, secrets and raw hardware serials are excluded.

CI executes the same schema as a software-contract regression only. It must report `physicalVehicleComputerTest=false` and `targetHardwareQualified=false`.

## Physical capture

A physical service capture must explicitly set all identity fields and enable the physical flag. Example:

```bash
export KINGMAST_PRODUCT_VERSION=0.0.6
export KINGMAST_BUILD_COMMIT=<commit>
export KINGMAST_BUILD_ID=<build-id>
export KINGMAST_HARDWARE_TARGET=raspberry-pi-5
export KINGMAST_HARDWARE_INSTANCE_SHA256=<sha256-of-local-instance-id>
export KINGMAST_FIRMWARE_REVISION=<firmware-revision>
export KINGMAST_CONFIGURATION_REVISION=<configuration-revision>
export KINGMAST_CALIBRATION_REVISION=<calibration-revision>
export KINGMAST_PHYSICAL_VEHICLE_COMPUTER_TEST=1
export KINGMAST_REQUIRE_PHYSICAL_FIELD_CAPTURE=1
export KINGMAST_FIELD_DIAGNOSTICS_INPUT_JSON='<bounded-runtime-snapshot>'
pnpm diagnostics:field-evidence > field-diagnostics.json
```

The runtime JSON is intentionally narrow. Accepted input contains only edge health/freshness/reject counters and aggregated provider trust state. Unknown fields are stripped by the schema so coordinates, tokens, provider names and other payload data cannot flow into the generated report.

## Qualification boundary

A successful physical diagnostic capture proves only that the required diagnostic identity and bounded runtime fields were captured. It does **not** qualify the target computer, certify a vehicle, approve public-road use or replace HIL/closed-track evidence and independent review.
