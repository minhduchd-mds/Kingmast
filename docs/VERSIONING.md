# KINGMAST versioning policy

Current development version: **v0.0.7**.

KINGMAST is still under active development. Feature additions, UI refinements, sensor integrations and backend capability batches do **not** automatically increment the product version.

## Current checkpoint

`v0.0.7` is an explicit software release checkpoint created for the Vietnamese HMI/Assistant V1 upgrade, grounded read-only AI provider adapter, Vietnamese voice path, device-assistant diagnostics, offline fallback, localization coverage and associated safety/test hardening.

This checkpoint does **not** promote historical physical/HIL/closed-track evidence created under `v0.0.6`. Evidence files whose names or payloads explicitly bind them to `V006` remain immutable historical records unless a new v0.0.7 evidence campaign is executed and reviewed.

## Rules
- Keep the product version at `0.0.7` during the current development cycle.
- Bump the product version only when an explicit development release checkpoint is intentionally cut.
- Do not use feature-batch names such as `V2.4`, `V2.5`, `V3` or similar as the public product version.
- Historical design/evidence notes may retain batch or release identifiers such as `V006` for traceability; they are not silently rewritten as `V007`.
- API paths such as `/v3`, `/v4` and `/v5` represent interface generations and compatibility boundaries. They do not represent the KINGMAST application version.
- All workspace package manifests use the same KINGMAST development version unless a package is intentionally versioned independently later.
- Persistent HMI storage namespaces may retain `kingmast:v006:*` when required for backward compatibility. Storage schema identity is not the product release number.

## Release discipline
A version bump should happen only when the team intentionally creates a release checkpoint with a defined scope, verification result, migration note and rollback point. After a checkpoint, new functionality is merged under that development version until the next intentional bump.

Every release checkpoint must distinguish:
1. software version and package metadata;
2. interface/schema versions;
3. persisted-data schema identifiers;
4. simulation evidence;
5. physical/HIL/closed-track evidence.

Changing the software version alone must never be used to imply that historical evidence has been re-run or that hardware/public-road qualification exists.

## v0.0.7 compatibility note
The HMI continues reading established `kingmast:v006:*` localStorage keys for driver profile, preferences, route cache and first-run state. This prevents a software update from erasing user preferences or repeating first-run setup. A storage-key migration should occur only when the persisted schema itself changes and must include an explicit migration/fallback path.

## Safety
Versioning does not alter the safety boundary. KINGMAST remains warning-only Level 0 research software with no steering, braking, throttle, gear, torque, drivetrain or CAN-write authority. Assistant/provider output remains advisory and read-only.
