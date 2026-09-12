# KINGMAST ESP32 security baseline — v0.0.8 research

Status: research/bench security baseline for the active v0.0.8 software checkpoint. This is not an automotive ECU certification claim and does not promote historical v0.0.6/v0.0.7 physical evidence.

## Boundary

The ESP32 publisher is allowed to collect and transmit sensing/position data only. It has no steering, braking, throttle, gear, torque or generic CAN-write authority. Closed-track/bench use remains the intended scope.

## Mandatory controls

1. Telemetry endpoint uses HTTPS only.
2. TLS certificate validation remains enabled; `setInsecure()` is prohibited.
3. Gateway CA material may be public certificate data; device private keys/secrets must never be committed.
4. Production-intent credentials must be provisioned after build, not embedded in public source.
5. Boot/session identity must change across reboots and packet sequence must be monotonic within a boot.
6. Device time must be synchronized before safety telemetry is accepted.
7. Stale radar/GNSS state must degrade or become unavailable rather than being silently reused.
8. Shared edge tokens are migration-only. The bundled consolidated `/v3/edge/frame` publisher can add a per-device HMAC-SHA256 signature bound to device ID, key ID, boot ID, sequence, timestamp and canonical packet body.
9. Canonical packet serialization in the research publisher keeps object keys in lexical order before signing. This remains a research interoperability mechanism in v0.0.8, not a final fleet protocol standard; production should use a formally specified canonical encoding and independently tested SDK/firmware implementation.
10. `KINGMAST_REQUIRE_DEVICE_AUTH=1` on the gateway rejects the shared token as a substitute for a valid per-device packet signature. Device HMAC secrets remain transitional and should move out of ordinary firmware configuration into hardware-protected non-exportable key storage.
11. Production hardware shall use secure boot, signed firmware, flash encryption where supported, anti-rollback, watchdogs and hardware-protected key storage. These controls are not considered implemented merely because they are documented here.
12. Vehicle CAN remains read-only by architecture and hardware. No TX-capable production adapter is approved by this research baseline.

## Credential lifecycle target

Prototype:

`deviceId + per-device HMAC key + keyId + validity/revocation policy`

Production-intent target:

`hardware-protected private key -> device certificate -> mTLS -> short-lived authorization -> rotation/revocation`

A compromised device credential must be revocable without rotating every other vehicle/device credential.

## Firmware signing versus telemetry signing

Telemetry HMAC proves possession of the configured research device credential for one packet. It does **not** prove that the firmware itself is trusted or that the board booted an approved image.

The production trust chain must independently cover:

`ROM/bootloader root -> secure boot -> signed firmware -> protected device key -> authenticated telemetry`

Compromise of any one layer must not be treated as evidence that the other layers remain trustworthy.

## Firmware release target

Firmware is not installable merely because it compiled. Release evidence shall include:

- source commit SHA;
- firmware version;
- hardware compatibility;
- SHA-256 artifact digest;
- signer identity/key id;
- monotonic rollback index;
- build/test evidence;
- secure-boot/signing evidence for the target board;
- rollback/known-good image strategy.

A v0.0.8 physical firmware qualification claim requires newly generated version-bound target evidence. Files explicitly named `V006` and prior v0.0.7 evidence remain historical.

## CI policy

`scripts/firmware-security-policy-check.mjs` enforces cheap source-level invariants such as HTTPS, CA validation, rejection of `setInsecure()` and preservation of the per-device packet-signing path. This CI rule is defense-in-depth only; it does not replace a real firmware build, hardware penetration testing, secure provisioning, EMC/ESD/power testing or independent safety review.
