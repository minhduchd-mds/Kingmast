# KINGMAST physical evidence trust chain v0.0.6

This contract hardens the complete handoff from an already executed physical activity into retained, reviewable KINGMAST evidence. It applies to physical HIL and controlled-track evidence and defines the same retention/review boundary for target-soak and calibration evidence. It does not authorize a bench or track run and does not create target-hardware qualification, homologation or public-road approval.

## Required source binding

Every physical capture package must be generated while the repository is checked out at the same full 40-character commit recorded by the capture. Guarded workflows set `KINGMAST_EXPECTED_SOURCE_COMMIT=${GITHUB_SHA}` and packagers reject captures whose `softwareCommit` differs from that exact source commit.

The package records `automaticQualification=false`, registry mutation disabled and `reviewDisposition=captured-awaiting-independent-review`. A package may contain a physical pass/fail observation, but that observation cannot mutate the committed HIL or controlled-track registry automatically.

## Package-to-manifest integrity

After packaging, `scripts/physical-evidence-manifest.mjs` computes SHA-256 over the exact JSON package bytes and creates `kingmast-physical-evidence-manifest/v1`. The manifest binds:

- physical evidence kind;
- scenario ID;
- exact repository source commit;
- package schema, claim and pass/fail status;
- exact package SHA-256;
- workflow/run identity when captured through a guarded workflow;
- independent-review-required state;
- explicit false values for automatic qualification, registry mutation, target-hardware qualification, controlled-track approval and public-road approval.

`scripts/physical-evidence-manifest-check.mjs` re-reads both files and recomputes the package digest. Package-byte tampering, source-commit mismatch, identity/status mismatch or any automatic qualification flag causes the check to fail.

## Protected evidence store boundary

Source control does not retain raw physical evidence. `docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_POLICY.json` defines a metadata-only contract for a separately protected store.

A retained physical record must bind the package SHA-256, exact source commit and every evidence SHA-256 digest, and the external store must have reviewed access control, encryption at rest and an immutable/write-once mode. Duplicate package digests are rejected.

The committed evidence-store index intentionally remains empty with `backendConfigured=false`. A real protected store must be provisioned outside the repository before long-term physical evidence retention can be claimed.

## Independent review workflow

Captured evidence enters `V006_PHYSICAL_EVIDENCE_REVIEW_QUEUE.json`. Automation may validate queue metadata and a completed review package, but it cannot perform the engineering review itself.

A completed `kingmast-physical-evidence-review-package/v1` binds:

- evidence class and scenario;
- exact source commit;
- capture-package SHA-256;
- physical evidence operator;
- a different independent reviewer;
- review timestamp;
- disposition and accepted pass/fail result when applicable;
- findings and review-evidence SHA-256 references.

The allowed dispositions are `accept-result`, `accept-with-findings` and `reject-evidence`.

## HIL and controlled-track lifecycle

HIL and controlled-track scenarios use the same lifecycle vocabulary:

`BLOCKED -> READY -> CAPTURED -> REVIEWED / FAILED`

`READY` means bounded physical prerequisites have been reviewed. It is not a pass.

`CAPTURED` means a source-bound package passed ingestion validation and is waiting for independent review. It is not a pass.

`REVIEWED` or `FAILED` is derived only from manually maintained reviewed registries. CI and ingestion tools cannot promote registry state.

## Workflow boundary

`.github/workflows/hil-physical-evidence.yml` and `.github/workflows/closed-track-evidence.yml` remain manual `workflow_dispatch` workflows on dedicated self-hosted runners and protected environments. They are evidence packaging mechanisms only.

`.github/workflows/physical-evidence-lifecycle-readiness.yml` validates the source-controlled store contract, review workflow, HIL lifecycle, controlled-track lifecycle and unified physical-validation portfolio. Its artifacts are software preparation evidence, not physical test evidence.

## Deterministic software self-tests

The physical evidence trust-chain, evidence-store validator, independent review package validator and controlled-track ingestion validator include fixture-only self-tests. Fixture runs explicitly report that no physical evidence was stored, no physical review was performed and no physical HIL or controlled-track activity was executed.

## Promotion rule

Authorized physical activity -> bounded capture -> source-bound package -> SHA-256 manifest -> protected external evidence-store registration -> independent review queue -> independent review package -> human-controlled registry update -> lifecycle dashboard.

No CI, simulator, packager, ingestion validator, evidence store index or review queue may skip independent review or promote virtual/unreviewed evidence into physical qualification status.
