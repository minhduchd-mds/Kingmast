# KINGMAST v0.0.6 build provenance

Status: research engineering evidence. This is not a standards certification or signed release attestation.

## Goal

Every successful CI build should be traceable to the exact source commit, dependency lockfile, generated CycloneDX SBOM and selected build outputs. Provenance must preserve the warning-only authority boundary and must never imply actuator capability.

## CI evidence

The CI job generates:

- `/tmp/kingmast.cdx.json` — CycloneDX 1.5 production dependency SBOM;
- `/tmp/kingmast.provenance.json` — KINGMAST provenance envelope.

The provenance envelope records:

- repository, ref and `GITHUB_SHA`;
- package/version and Node/package-manager versions;
- SHA-256 of `pnpm-lock.yaml`;
- SHA-256 of the generated SBOM;
- deterministic tree/file digests for selected production build outputs;
- explicit `actuatorAuthority: none` assertion.

The two files are uploaded only after the full CI verification path, including unit/contract tests, production build and automotive HMI UI tests, succeeds.

## Selected build outputs

v0.0.6 binds evidence to:

- `services/risk-engine/dist` as a deterministic tree digest;
- `apps/hmi/.next/BUILD_ID` as the HMI build identity.

A future signed release pipeline should extend this to release archives/container images and sign the provenance with a protected release identity.

## Security rules

- GitHub Actions used for evidence generation/upload are pinned to immutable reviewed commit SHAs.
- Provenance generation rejects missing materials and symlinked selected build paths.
- No secrets, device keys, viewer tokens or runtime credentials belong in provenance.
- A provenance file is evidence of what CI built; it is not proof of homologation, ISO 26262 compliance, UNECE R155/R156 compliance or vehicle-road approval.

## Production-intent backlog

1. signed release archive/container digest;
2. protected signing identity/HSM or equivalent;
3. verifiable attestation format such as SLSA/in-toto compatible provenance;
4. retention tied to release lifecycle;
5. SBOM vulnerability status at release time;
6. field update manifest linked back to the exact signed build provenance.
