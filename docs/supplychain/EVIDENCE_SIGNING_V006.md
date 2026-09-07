# KINGMAST evidence signing v0.0.6

The deterministic evidence anchor binds the source commit and evidence material digests. This layer adds an optional **detached Ed25519 signature** without storing a signing private key in the repository.

## Signing flow

1. CI generates and independently verifies `kingmast-evidence-anchor/v1`.
2. A release/security signer receives the verified anchor.
3. `sign-evidence-anchor.mjs` signs only the domain-separated source commit + root SHA-256 payload.
4. `verify-signed-evidence-anchor.mjs` verifies the detached envelope against a separately trusted Ed25519 public key.

The signing private key must be supplied out-of-repository, ideally by an HSM/KMS or isolated release-signing system. The repository secret scanner must never be bypassed to commit a release/evidence private key.

## CI self-test

CI uses **ephemeral generated keys only** to test that detached signing and external timestamp-attestation verification reject a tampered root. These ephemeral keys have no production identity and no release authority.

## External timestamp attestation verifier

`verify-external-evidence-timestamp.mjs` can validate a detached `kingmast-external-evidence-timestamp/v1` record against a separately trusted Ed25519 authority public key. The attestation binds:

- authority ID
- full source commit
- evidence root SHA-256
- RFC3339 `observedAt`

The verifier checks the signature, root/commit binding and excessive future-clock skew. KINGMAST does **not** generate a trusted external timestamp inside normal CI, because a timestamp created by the same build environment would not provide independent time authority.

This format is a research interoperability scaffold, not a claim that an RFC 3161 TSA, Sigstore/Rekor transparency service or accredited timestamp authority is deployed.

## Timestamp boundary

The ordinary signed evidence envelope intentionally reports:

- `externalTimestampAuthority: none`
- `nonRepudiationClaim: false`

A local wall-clock `signedAt` value is not a trusted timestamp. Production evidence requiring independently provable time should use an external timestamp/transparency system and retain its verification material separately.

This repository does not claim RFC 3161 timestamping, Sigstore transparency inclusion, HSM-backed signing or non-repudiation until those controls are deployed and independently evidenced.

## Safety boundary

Evidence signing and timestamp verification are post-processing. Real-time warning computation must never depend on a signing service, timestamp authority, transparency log or evidence storage availability.
