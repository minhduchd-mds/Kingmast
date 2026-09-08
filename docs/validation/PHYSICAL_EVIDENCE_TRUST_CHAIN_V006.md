# KINGMAST physical evidence trust chain v0.0.6

This contract hardens the handoff from an already executed physical activity into a reviewable KINGMAST evidence package. It applies to physical HIL and controlled-track packaging only. It does not authorize a bench or track run and does not create target-hardware qualification, homologation or public-road approval.

## Required binding

Every physical capture package must be generated while the repository is checked out at the same full 40-character commit recorded by the capture. The guarded workflows set `KINGMAST_EXPECTED_SOURCE_COMMIT=${GITHUB_SHA}` and the packagers reject any capture whose `softwareCommit` differs from that exact source commit.

The package records `sourceCommitBinding.matched=true`, `automaticQualification=false`, `registryMutation=false` and `reviewDisposition=captured-awaiting-independent-review`. A package may contain a physical pass/fail result, but that result cannot mutate the committed HIL or controlled-track registry automatically.

## Package-to-manifest integrity

After packaging, `scripts/physical-evidence-manifest.mjs` computes a SHA-256 digest over the exact JSON package bytes and creates `kingmast-physical-evidence-manifest/v1`. The manifest binds:

- physical evidence kind (`hil` or `closed-track`);
- scenario ID;
- exact repository source commit;
- package schema, claim and pass/fail status;
- exact package SHA-256;
- GitHub workflow name, run ID and run attempt;
- independent-review-required state;
- explicit false values for automatic qualification, registry mutation, target-hardware qualification, closed-track approval and public-road approval.

`scripts/physical-evidence-manifest-check.mjs` re-reads both files and recomputes the package digest. Package-byte tampering, source-commit mismatch, identity/status mismatch or any automatic qualification flag causes the check to fail.

## Workflow boundary

`.github/workflows/hil-physical-evidence.yml` and `.github/workflows/closed-track-evidence.yml` remain manual `workflow_dispatch` workflows on dedicated self-hosted runners and protected environments. They have repository `contents: read` only, do not persist checkout credentials, do not download ad-hoc runtime code, and upload only bounded JSON package/manifest artifacts.

The workflows are evidence packaging mechanisms. They do not perform autonomous vehicle control, do not grant CAN write authority, do not authorize a physical test, and do not close the independent review requirement.

## Deterministic software self-test

`pnpm evidence:physical-trust-selftest -- --json --ci` uses fixture packages only. It proves that valid HIL/controlled-track bindings pass while package tampering, source-commit mismatch and attempts to enable automatic qualification are rejected. The self-test explicitly reports `physicalEvidenceCaptured=false` and cannot satisfy HIL or controlled-track evidence.

`pnpm evidence:physical-workflow-policy` verifies that both guarded workflows remain manual, self-hosted, protected, source-bound and repository-read-only.

## Promotion rule

Physical activity -> bounded capture -> source-bound package -> SHA-256 manifest -> independent review -> human-controlled registry update.

No CI, simulator, HIL packager or controlled-track packager may skip the independent review step or promote a virtual/fixture result into a physical qualification state.
