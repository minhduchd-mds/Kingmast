# KINGMAST evidence signing v0.0.6

The deterministic evidence anchor binds the source commit and evidence material digests. This layer adds an optional **detached Ed25519 signature** without storing a signing private key in the repository.

## Signing flow

1. CI generates and independently verifies `kingmast-evidence-anchor/v1`.
2. A release/security signer receives the verified anchor.
3. `sign-evidence-anchor.mjs` signs only the domain-separated source commit + root SHA-256 payload.
4. `verify-signed-evidence-anchor.mjs` verifies the detached envelope against a separately trusted Ed25519 public key.

The signing private key must be supplied out-of-repository, ideally by an HSM/KMS or isolated release-signing system. The repository secret scanner must never be bypassed to commit a release/evidence private key.

## CI self-test

CI uses an **ephemeral generated key only** to test that the signing/verification implementation rejects a tampered root. The ephemeral key has no production identity and no release authority.

## Timestamp boundary

The signed envelope intentionally reports:

- `externalTimestampAuthority: none`
- `nonRepudiationClaim: false`

A local wall-clock `signedAt` value is not a trusted timestamp. Production evidence requiring independently provable time should use an external timestamp/transparency system (for example an organizational TSA or audited transparency service) and retain its verification material separately.

This repository does not claim RFC 3161 timestamping, Sigstore transparency inclusion, HSM-backed signing or non-repudiation until those controls are deployed and independently evidenced.

## Safety boundary

Evidence signing is post-processing. Real-time warning computation must never depend on a signing service, timestamp authority, transparency log or evidence storage availability.
