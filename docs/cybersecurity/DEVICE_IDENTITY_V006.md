# KINGMAST v0.0.6 device identity transition

Status: research/prototype security architecture. This is a transitional design toward fleet-grade device identity; it is not an mTLS/PKI or UN R155 conformity claim.

## Goal

Replace one shared edge-ingest credential with identity that is bound to an individual edge device and can be rotated or revoked independently.

The v0.0.6 implementation adds per-device HMAC-SHA256 authentication to the consolidated `/v3/edge/frame` packet route. Existing legacy sensor routes continue to use the shared research edge token until their publishers migrate.

## Packet binding

A device signature covers:

```text
KINGMAST-EDGE-V1
<deviceId>
<keyId>
<bootId>
<sequence>
<timestampMs>
<canonical packet JSON>
```

The server verifies the signature using the key registry entry associated with `packet.deviceId` and the supplied `x-kingmast-device-key-id` header. Replay/freshness checks are still performed independently by the edge packet guard.

Headers:

- `x-kingmast-device-key-id`
- `x-kingmast-device-signature` — lowercase/uppercase hexadecimal HMAC-SHA256 is accepted

## Registry and rotation

`KINGMAST_DEVICE_KEYS_JSON` is server-only. The conceptual shape is:

```json
{
  "edge-1": [
    {
      "keyId": "2026-09-a",
      "secret": "replace-with-a-random-secret-of-at-least-32-characters",
      "state": "active",
      "notBeforeMs": 1788700000000,
      "notAfterMs": 1791300000000
    }
  ]
}
```

Rules:

- maximum four keys per device to bound configuration/state;
- key IDs are unique per device;
- secrets are at least 32 characters;
- keys can be `active` or `revoked`;
- optional validity windows allow overlap during rotation;
- expired, future, unknown and revoked keys fail closed;
- diagnostics expose only counts/status, never key material.

A normal rotation can temporarily provision old and new active keys, update the device, verify traffic on the new key, then mark the old key revoked and remove it after the incident/evidence retention period.

## Enforcement modes

`KINGMAST_REQUIRE_DEVICE_AUTH=0` is migration mode. A valid per-device signature is accepted, but `/v3/edge/frame` can still fall back to the existing shared edge token.

`KINGMAST_REQUIRE_DEVICE_AUTH=1` requires a currently active device key at server startup and removes shared-token fallback for `/v3/edge/frame` outside explicit loopback development.

This flag does not magically secure legacy `/v3/perception/*`, `/v3/edge/gnss` or `/v3/assist/*` publishers. Those routes remain migration backlog and must not be represented as per-device authenticated until converted.

## Why HMAC is transitional

Per-device HMAC materially reduces the blast radius of one shared token and provides rotation/revocation semantics, but symmetric secrets are not the production target for a fleet. Production-intent hardware should progress to:

```text
hardware-protected private key
  -> per-device certificate / mTLS or equivalent asymmetric identity
  -> provisioning authority
  -> rotation + revocation service
  -> authenticated ingest scope
  -> secure boot / measured software identity
```

Private keys should be non-exportable where supported by secure element/TPM/HSM-backed hardware.

## Operational requirements before vehicle/fleet use

- secure provisioning ceremony and asset inventory;
- device certificate/key issuance and revocation workflow;
- key compromise incident runbook;
- authenticated time/freshness strategy appropriate to target hardware;
- secure boot and signed firmware chain;
- anti-rollback state protected outside ordinary application storage;
- least-privilege ingest authorization by device/vehicle role;
- server-side audit of identity/key ID/auth failures without logging secrets;
- rate limiting at an external gateway for Internet-facing deployment;
- independent penetration/security review.

## Security boundary

Device authentication only proves that a packet was produced by a holder of the configured device credential. It does not make sensor data physically correct, calibrated, non-spoofed or safe. Freshness, sequence, sensor-health, confidence, fusion and safety logic remain separate required controls.

KINGMAST remains Level 0 warning-only. Device identity cannot create steering, brake, throttle, torque, gear or generic CAN-write authority.
