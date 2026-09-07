# KINGMAST v0.0.6 device identity transition

Status: research/prototype security architecture. This is a transitional design toward fleet-grade device identity; it is not an mTLS/PKI or UN R155 conformity claim.

## Goal

Replace one shared edge-ingest credential with identity that is bound to an individual edge device and can be rotated or revoked independently.

The v0.0.6 implementation supports two per-device packet-authentication modes on the consolidated `/v3/edge/frame` route:

- `hmac-sha256` — transitional symmetric identity for bench migration;
- `ed25519` — asymmetric packet signing where the server stores only the device public key.

Existing legacy sensor routes continue to use the shared research edge token until their publishers migrate.

## Packet binding

Both algorithms sign the same canonical payload:

```text
KINGMAST-EDGE-V1
<deviceId>
<keyId>
<bootId>
<sequence>
<timestampMs>
<canonical packet JSON>
```

The server resolves the key registry entry associated with `packet.deviceId` and `x-kingmast-device-key-id`, then verifies according to that key's declared algorithm. Replay/freshness checks remain independent in the edge packet guard.

Headers:

- `x-kingmast-device-key-id`
- `x-kingmast-device-signature`
  - HMAC-SHA256: 64-character hexadecimal digest;
  - Ed25519: canonical base64 encoding of the 64-byte signature.

## Registry and rotation

`KINGMAST_DEVICE_KEYS_JSON` is server-only. HMAC migration example:

```json
{
  "edge-1": [
    {
      "keyId": "2026-09-hmac-a",
      "algorithm": "hmac-sha256",
      "secret": "replace-with-a-random-secret-of-at-least-32-characters",
      "state": "active"
    }
  ]
}
```

Asymmetric example:

```json
{
  "edge-1": [
    {
      "keyId": "2026-09-ed25519-a",
      "algorithm": "ed25519",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
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
- HMAC secrets are at least 32 characters;
- Ed25519 records contain a valid Ed25519 public key and no shared secret;
- keys can be `active` or `revoked`;
- optional validity windows allow overlap during rotation;
- expired, future, unknown and revoked keys fail closed;
- diagnostics expose only counts/status, never secret/private key material.

A normal rotation can temporarily provision old and new active keys, update the device, verify traffic on the new key, then revoke/remove the old credential according to the evidence-retention policy.

## Enforcement modes

`KINGMAST_REQUIRE_DEVICE_AUTH=0` is migration mode. A valid per-device signature is accepted, but `/v3/edge/frame` can still fall back to the existing shared edge token.

`KINGMAST_REQUIRE_DEVICE_AUTH=1` requires a currently active device key at server startup and removes shared-token fallback for `/v3/edge/frame` outside explicit loopback development.

This flag does not secure legacy `/v3/perception/*`, `/v3/edge/gnss` or `/v3/assist/*` publishers. Those routes remain migration backlog and must not be represented as per-device authenticated until converted.

## Why Ed25519 is an intermediate step, not fleet PKI

Ed25519 removes the need for the server to store a device shared secret and gives KINGMAST an asymmetric identity primitive. The current registry is still a static research configuration: it does not provide certificate-chain validation, hardware attestation, automated provisioning, revocation distribution or mTLS transport identity.

Production-intent hardware should progress toward:

```text
hardware-protected non-exportable private key
  -> per-device certificate / mTLS or equivalent asymmetric identity
  -> provisioning authority
  -> rotation + revocation service
  -> authenticated least-privilege ingest scope
  -> secure boot / measured software identity
```

The current Ed25519 packet-signature mode is useful for bench/closed research and migration testing, but must not be described as fleet-grade PKI.

## Operational requirements before vehicle/fleet use

- secure provisioning ceremony and asset inventory;
- device certificate/key issuance and revocation workflow;
- hardware-backed private key on the target platform;
- key compromise incident runbook;
- authenticated time/freshness strategy appropriate to target hardware;
- secure boot and signed firmware chain;
- anti-rollback state protected outside ordinary application storage;
- least-privilege ingest authorization by device/vehicle role;
- server-side audit of identity/key ID/auth failures without logging secrets;
- rate limiting at an external gateway for Internet-facing deployment;
- independent penetration/security review.

## Security boundary

Device authentication only proves that a packet was produced by a holder of the configured credential. It does not make sensor data physically correct, calibrated, non-spoofed or safe. Freshness, sequence, sensor-health, confidence, fusion and safety logic remain separate required controls.

KINGMAST remains Level 0 warning-only. Device identity cannot create steering, brake, throttle, torque, gear or generic CAN-write authority.
