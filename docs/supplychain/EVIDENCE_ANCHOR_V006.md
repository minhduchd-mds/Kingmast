# KINGMAST v0.0.6 engineering evidence anchor

Status: deterministic research evidence bundling. This is not a trusted timestamp, notarization service, qualified electronic signature, or standards certification.

## Goal

KINGMAST CI produces several independent evidence files: CycloneDX SBOM, build provenance, deterministic SIL replay output, HIL claim registry, and firmware-trust claim registry. `generate-evidence-anchor.mjs` binds those files to one source commit and one deterministic SHA-256 root.

The output contains:

- full 40-character source commit SHA;
- SHA-256 digest and byte length of each evidence material;
- deterministic root SHA-256 over sorted material names/digests;
- `actuatorAuthority: none`;
- explicit `externallySigned: false` and `externalTimestampAuthority: none` markers.

## Security property

The anchor makes accidental or unauthorized evidence changes detectable when a previously trusted root digest is available for comparison. It does **not** by itself establish authenticity or non-repudiation because an attacker that controls the complete local artifact set can recompute an unsigned root.

## Production-intent next step

For stronger forensic assurance, publish or sign the root outside the build runner using a protected release/evidence key or external transparency/timestamp service. That external trust anchor must be operationally separate from the repository write path.

A future implementation should add:

1. HSM/KMS-backed evidence-root signing;
2. trusted timestamp or transparency-log inclusion;
3. signer key rotation/revocation;
4. immutable retention policy;
5. independent verification tooling;
6. linkage from physical HIL/firmware evidence to the exact anchor root.

Real-time warning computation must never depend on evidence anchoring or external availability.
