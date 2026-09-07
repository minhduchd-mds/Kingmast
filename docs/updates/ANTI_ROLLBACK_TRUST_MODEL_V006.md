# KINGMAST v0.0.6 anti-rollback trust model

Status: research engineering contract. This document does not claim production secure-boot or UNECE/ISO compliance.

## Safety/security intent

A signed update with a rollback index lower than the committed device floor must be rejected. The committed floor must not advance merely because an image was downloaded, verified, staged or installed.

The floor advances only after the newly installed image has completed the required boot-health acceptance sequence. This preserves the ability to return to the previously known-good image if the new image fails before acceptance.

## Software contract

`AntiRollbackGuard` separates two operations:

1. `evaluateCandidate(index)` compares a package rollback index with the currently committed floor;
2. `commitAcceptedUpdate(snapshot)` advances the floor only when the OTA lifecycle is in `accepted` state.

The repository contains a `MemoryRollbackIndexStore` for unit/SIL testing only. Its `protection` value is explicitly `memory-test-only`.

## Production trust boundary

The production implementation of `RollbackIndexStore` must use **hardware-protected monotonic state**, or an equivalently protected bootloader-owned mechanism, that ordinary application code, filesystem rollback, image replacement or attacker-controlled configuration cannot decrease. Acceptable target technologies depend on the final compute platform and can include:

- secure-element monotonic counters;
- TPM-backed NV counters;
- SoC eFuse / one-time-programmable version state where lifecycle permits;
- bootloader-owned authenticated monotonic storage with equivalent tamper resistance.

A normal JSON file, environment variable, SQL row or writable application preference is not sufficient as the final anti-rollback root of trust.

## Required ordering

```text
package downloaded
  -> hash verified
  -> release signature verified
  -> hardware/platform compatibility verified
  -> candidate rollback index >= committed floor
  -> parked/power/thermal/storage eligibility
  -> install inactive image
  -> boot candidate
  -> boot-health checks
  -> mark image accepted
  -> commit new monotonic rollback floor
```

If boot-health fails before acceptance, the previous floor remains unchanged and the system may boot the known-good image.

## Evidence required before production intent

- power-loss tests during every OTA state transition;
- bootloader integration test proving lower-index images are rejected outside application control;
- tamper test against rollback-index storage;
- A/B or known-good recovery evidence;
- signer-key compromise/revocation exercise;
- update provenance bound to exact source/build artifact;
- HIL test showing failed candidate boot does not advance the monotonic floor;
- independent cybersecurity and safety review.

KINGMAST remains warning-only Level 0. OTA and rollback state cannot create steering, braking, throttle, torque, gear or generic CAN-write authority.
