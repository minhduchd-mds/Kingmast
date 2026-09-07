# KINGMAST v0.0.6 SUMS/OTA architecture plan

Status: production-intent design plan; not an implementation or UN R156 conformity claim.

## Principle

KINGMAST learns from public OEM update practices only at the abstract safety-process level. No OEM thresholds, package formats, UI or proprietary update architecture are copied.

## Independent update lifecycle

```text
source commit
  -> reproducible build
  -> tests/safety gates
  -> SBOM
  -> artifact hash
  -> signed release manifest
  -> publish
  -> device download
  -> hash/signature verification
  -> compatibility + install-eligibility evaluation
  -> atomic/dual-slot install where supported
  -> boot/runtime health check
  -> accept OR rollback
  -> immutable update evidence
```

## Manifest fields

Minimum conceptual fields:

```json
{
  "updateId": "uuid",
  "product": "KINGMAST",
  "softwareVersion": "0.0.x",
  "artifactSha256": "...",
  "targetPlatform": "...",
  "minBootloader": "...",
  "compatibleHardware": ["..."],
  "configurationSchemaVersion": "...",
  "calibrationCompatibility": "...",
  "createdAt": "...",
  "signerKeyId": "...",
  "signature": "..."
}
```

## Install eligibility

Installation SHALL fail closed unless independently validated KINGMAST policy confirms required conditions such as:

- verified parked/not-moving state;
- stable power/energy reserve for the selected hardware;
- acceptable thermal state;
- sufficient storage;
- target hardware/version compatibility;
- no critical safety operation in progress;
- verified package/signature.

Exact thresholds must be justified for KINGMAST hardware; they are not copied from Tesla, VinFast or any other OEM.

## Rollback

Preferred target: A/B or dual-slot deployment with known-good image. If hardware cannot support it, the platform needs an alternative fail-safe recovery path before vehicle use.

Rollback triggers include:

- signature/hash mismatch before install;
- interrupted/incomplete installation;
- boot failure/health timeout;
- incompatible configuration/calibration;
- critical startup self-test failure.

## Anti-rollback

Security updates may require monotonic version policy. Emergency rollback must be a controlled, signed exception rather than accepting arbitrary older packages.

## Release evidence

Persist bounded metadata:

- previous/new version;
- hardware ID/class;
- update ID;
- signer key ID;
- download/verify/install timestamps;
- eligibility decision;
- install result;
- boot-health result;
- rollback reason if any.

## HMI principles

- installation state is clear and calm;
- no claim that the vehicle is ready while update/health verification is incomplete;
- driver-critical warnings must not be masked by update UI;
- update controls that are unsafe while moving are unavailable/locked;
- release notes are original KINGMAST text.

## Security/operations backlog

- offline signer or protected signing service;
- key rotation/revocation runbook;
- SBOM and provenance attestation;
- staged rollout/canary group;
- update pause/withdraw capability;
- incident response for compromised signer;
- recovery image and service procedure;
- compatibility test matrix across edge/HMI/risk-engine/native firmware.