# KINGMAST versioning policy

Current development version: **v0.0.6**.

KINGMAST is still under active development. Feature additions, UI refinements, sensor integrations and backend capability batches do **not** automatically increment the product version.

## Rules
- Keep the product version at `0.0.6` during the current development cycle.
- Bump the product version only when an explicit development release checkpoint is intentionally cut.
- Do not use feature-batch names such as `V2.4`, `V2.5`, `V3` or similar as the public product version.
- Historical design notes may retain batch/file identifiers for traceability, but they are not release numbers.
- API paths such as `/v3`, `/v4` and `/v5` represent interface generations and compatibility boundaries. They do not represent the KINGMAST application version.
- All workspace package manifests should use the same KINGMAST development version unless a package is intentionally versioned independently later.

## Release discipline
A version bump should happen only when the team intentionally creates a release checkpoint with a defined scope, verification result, migration note and rollback point. Until then, new functionality is merged under the same development version.

## Safety
Versioning does not alter the safety boundary. KINGMAST remains warning-only Level 0 research software with no steering, braking, throttle, drivetrain or CAN-write authority.
