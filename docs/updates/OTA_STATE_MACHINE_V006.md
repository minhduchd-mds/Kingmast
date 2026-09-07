# KINGMAST OTA lifecycle state machine — v0.0.6

Status: engineering scaffold for research. It does not claim UN R156 compliance or production OTA readiness.

## Objective

Separate package authenticity/compatibility verification from install eligibility and post-install boot acceptance. An update must not jump directly from download to installation.

## States

```text
idle
  -> staged
  -> verified
  -> ready
  -> installing
  -> pending-boot
       -> accepted
       -> rollback-required
```

Any pre-install validation failure becomes `failed`. Any failure after installation has started becomes `rollback-required` because the previous known-good image must remain recoverable.

## Required gates

### staged -> verified

Requires the existing update verifier to confirm:

- schema validity;
- SHA-256 artifact digest;
- Ed25519 signature;
- signer key identity supplied by trusted configuration;
- target platform and hardware compatibility;
- monotonic rollback index;
- non-future manifest timestamp.

### verified -> ready

Requires independent install eligibility:

- package verified;
- motion state known;
- vehicle stationary/parked;
- stable power;
- sufficient energy reserve;
- acceptable thermal state;
- sufficient storage;
- no critical operation active.

The values/thresholds are KINGMAST-owned engineering decisions and must be validated on the target platform; OEM-specific thresholds are not copied.

### installing -> pending-boot

The write operation must be atomic or use an A/B/known-good strategy. The currently bootable known-good image must not be destroyed before the new image is verified.

### pending-boot -> accepted

Requires a bounded boot-health window proving at minimum:

- target process/firmware starts;
- watchdog remains healthy;
- required configuration/calibration is readable;
- required sensors can enter a valid/degraded state without crash loops;
- software version/rollback index matches the staged package.

A boot-health timeout, watchdog loop, integrity mismatch or incompatible configuration transitions to `rollback-required`.

## Runtime implementation

`services/risk-engine/src/update-state.ts` provides a deterministic transition model with tests. It intentionally does not perform flash writes or vehicle ECU control.

## Production-intent backlog

- A/B partitions or equivalent known-good image strategy;
- hardware-rooted secure boot;
- firmware signing in isolated signer infrastructure;
- anti-rollback stored outside ordinary writable application state;
- power-loss recovery tests during every install phase;
- update campaign/audit persistence;
- signer key rotation/revocation;
- SBOM and build provenance attached to releases;
- independent SUMS process assessment before any compliance claim.
