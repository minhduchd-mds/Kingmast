# KINGMAST Security Policy

KINGMAST is a public safety-first ADAS research platform. The production boundary in this repository remains warning-only Level 0; it must not be treated as a homologated vehicle-control system.

## Supported security scope

Security reports are especially important when they affect:

- device/provider authentication or authorization;
- secret/key exposure;
- replay protection or telemetry integrity;
- viewer/session isolation;
- configuration-write authority;
- firmware/update verification or rollback protection;
- supply-chain provenance, SBOM or evidence integrity;
- denial-of-service paths that could starve warning computation;
- any path that appears to introduce steering, braking, throttle, gear, torque or CAN-write authority.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting/security advisory workflow for this repository when available. Do not include live credentials, private keys, personal data, vehicle identifiers, proprietary OEM material or exploit traffic from systems you do not own or have permission to test.

If private reporting is unavailable, open a minimal issue that contains no exploit secret or sensitive operational detail and request a private follow-up channel.

## What to include

A useful report includes:

- affected commit/version;
- affected component and route/module;
- preconditions and threat model;
- reproducible steps using synthetic or authorized test data;
- expected vs actual security behavior;
- impact assessment;
- suggested mitigation if known.

## Handling expectations

KINGMAST security fixes should preserve fail-closed behavior, least privilege and the warning-only authority boundary. Security changes should include regression tests or machine-readable evidence where practical and should pass CodeQL, repository secret scanning, dependency audits, architecture/safety boundaries, unit/contract tests and HMI regression before merge.

## Research and physical testing boundary

Do not test against public roads, third-party vehicles, live infrastructure, traffic cameras, V2X providers or other systems without explicit authorization. SIL/unit tests are not accepted as proof of physical secure boot, HIL, eFuse, hardware anti-rollback, A/B recovery, CAN isolation or secure-element behavior.

## Secrets and keys

Never commit production credentials, signing private keys, device private keys, provider secrets, database credentials or tokens. Private keys for firmware/evidence signing should remain outside the repository and should be protected by an isolated signer, HSM/KMS or hardware-backed key store for production-intent deployments.
