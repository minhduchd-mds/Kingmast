# KINGMAST read-only vehicle port

Status: enforced software architecture contract for the warning-only v0.0.6 research line. It is not evidence of an automotive-qualified physical CAN interface.

## Purpose

KINGMAST mainline software must be structurally unable to request steering, braking, throttle, gear, torque or generic vehicle actuation. The public contract at `@kingmast/contracts/vehicle-readonly` therefore exposes only `ReadOnlyVehiclePort.readSnapshot()` and fixes its authority to `read-only`.

```text
Vehicle / gateway RX
        |
        v
approved read adapter
        |
        v
ReadOnlyVehiclePort
        |
        +--> normalized vehicle snapshot
        +--> sensor-health/provenance
        |
        v
Risk Engine / HMI
```

There is intentionally no symmetric write/control port in KINGMAST main.

## Required properties

1. Vehicle integration adapters produce bounded typed snapshots only.
2. Every snapshot carries observation time and provenance.
3. Missing or untrusted vehicle state degrades dependent functions instead of inventing healthy values.
4. HMI, AI, connected-road and cloud code consume read models only.
5. `scripts/safety-boundary-check.mjs` scans service, edge, HMI and shared-contract code for prohibited control-like APIs and verifies this contract remains exported.
6. Autonomous/control research stays isolated under `autonomy-lab/` and must never be imported into the main warning-only runtime.

## Hardware boundary still required

A TypeScript contract and static CI gate are not sufficient proof for a real vehicle. Before controlled vehicle integration, the selected adapter/harness must independently demonstrate a receive-only or otherwise physically/permission-enforced non-actuating path, appropriate isolation/protection, and a reviewed failure mode.

## Migration rule

New vehicle platform adapters must implement or adapt into this read-only contract. Do not expose vendor SDK handles, raw writable bus objects or generic command functions above the hardware integration boundary.
