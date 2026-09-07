# KINGMAST v0.0.6 firmware trust chain

Status: research/bench security architecture. This document does **not** claim that ESP32 secure boot, flash encryption, hardware anti-rollback or A/B recovery are physically implemented or validated on the target board.

## Goal

Separate three different claims that must never be conflated:

1. **Application package verification** — the risk-engine can verify SHA-256, Ed25519 release signatures, platform/hardware compatibility and rollback index policy.
2. **Firmware source policy** — CI can reject insecure source patterns such as plaintext telemetry, disabled TLS verification, missing per-device signing hooks or committed private keys.
3. **Physical firmware trust** — the actual board/bootloader proves secure boot, signed image enforcement, protected key storage, anti-rollback and known-good recovery under real power-loss and reboot conditions.

Only (1) and parts of (2) are implemented in the repository today. Physical firmware trust remains unverified until hardware evidence is attached.

## Target chain

```text
reviewed source commit
  -> reproducible build / provenance
  -> firmware artifact SHA-256
  -> release signature
  -> bootloader signature verification
  -> secure-boot root of trust
  -> hardware-protected rollback floor
  -> A/B or equivalent known-good recovery
  -> post-boot health acceptance
  -> commit rollback floor only after healthy boot
```

No stage may create steering, braking, throttle, gear, torque or generic CAN-write authority.

## Required evidence controls

`docs/updates/V006_FIRMWARE_TRUST_EVIDENCE.json` tracks eight mandatory controls:

- `FW-001` secure-boot root;
- `FW-002` signed firmware image enforcement;
- `FW-003` flash encryption;
- `FW-004` hardware-protected device private key;
- `FW-005` hardware-protected anti-rollback floor;
- `FW-006` A/B or equivalent known-good recovery;
- `FW-007` power-loss recovery;
- `FW-008` physical read-only CAN boundary.

The baseline intentionally marks all controls `pending` and claims `no-production-firmware-release-claimed`.

## Claim gate

`pnpm firmware:evidence` validates the registry. A control cannot be marked `passed` or `failed` without:

- exact full source commit SHA;
- physical hardware identifier;
- toolchain version;
- start/end timestamps;
- operator;
- independent reviewer;
- one or more evidence references.

The gate validates evidence bookkeeping only. It does not flash hardware, inspect eFuses, verify a secure element, cycle vehicle power or execute a HIL bench.

## A/B and power-loss expectations

Production-intent recovery testing must demonstrate at minimum:

- candidate image is written without destroying the known-good image;
- interrupted download does not alter the active known-good slot;
- interrupted install cannot leave the device in an unbootable ambiguous state;
- failed boot-health acceptance causes deterministic rollback;
- rollback index is not advanced before candidate boot acceptance;
- repeated power interruption is bounded and observable;
- recovery metadata cannot be rewritten by ordinary application code without authorization.

## ESP32 boundary

The bundled ESP32 code remains a research publisher. CI source checks and HMAC packet signing improve bench security but do not establish an automotive ECU security case. Production-intent hardware must use the target platform's documented secure-boot/signing mechanisms, non-exportable credentials where available, and independently reviewed provisioning/recovery procedures.

## Legal / OEM clean-room boundary

This trust-chain design is derived from general secure-update and automotive cybersecurity principles. It does not copy Tesla, BYD, VinFast firmware, bootloader logic, signing keys, partition layouts, calibration values, UI, proprietary update procedures or private documentation.
