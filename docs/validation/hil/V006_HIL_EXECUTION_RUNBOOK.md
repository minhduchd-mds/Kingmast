# KINGMAST v0.0.6 — Physical HIL execution runbook

This runbook prepares repeatable physical HIL evidence for `HIL-001` through `HIL-012`. It does **not** turn a green CI run into a physical test result, does not qualify target hardware, and does not authorize public-road use.

## Bench prerequisites

- Approved physical controller and deterministic bench/fault source.
- Read-only vehicle/CAN boundary where applicable.
- Time-synchronized capture source.
- Exact source commit under test.
- Bounded controller/bench labels; do not record raw serial numbers in repository-facing evidence.
- Operator and independent reviewer are different people.
- Evidence files are retained outside source control and represented in the capture document only by bounded references plus SHA-256 digests.
- No raw cabin video, raw camera frames, secrets or precise coordinates are uploaded by this workflow.

## Capture contract

Copy `docs/validation/hil/V006_HIL_CAPTURE_INPUT_TEMPLATE.json` to the approved self-hosted runner and populate it from a genuine physical bench execution. The scenario-specific required fields are defined in `docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json`.

The runner reads only:

`/var/lib/kingmast/hil-captures/<HIL-ID>.json`

The capture must use:

- `physicalControllerTest=true`
- `status=captured`
- a full 40-character `softwareCommit`
- ISO start/finish timestamps
- different bounded `operator` and `reviewer` labels
- `resultDisposition=passed|failed`
- all scenario-specific `resultFields`
- at least one evidence reference and a SHA-256 digest for every reference
- explicit privacy flags all set to `false`

## Workflow

Run **Physical HIL Evidence** manually, select the exact HIL scenario and acknowledge that the result is evidence-only. The workflow uses the `self-hosted`, `linux`, `kingmast-hil` runner labels and the protected `hil-physical-evidence` environment.

The workflow:

1. installs dependencies reproducibly;
2. runs repository safety/security gates;
3. packages the local physical capture with `scripts/hil-physical-capture-package.mjs`;
4. validates the resulting package with `pnpm hil:package-check`;
5. uploads only the bounded evidence package.

The workflow never edits `V006_HIL_EVIDENCE_REGISTRY.json` and never sets `targetHardwareQualified=true`.

## Review and promotion

After a physical package exists, an independent reviewer verifies the referenced evidence outside GitHub, confirms equipment/configuration/calibration identity, and records the review decision. Only then may the corresponding registry item be manually promoted from `pending` to `passed` or `failed` with the required evidence metadata.

A `passed` HIL scenario is still only one Gate-3 evidence item. Closed-track approval, target-hardware qualification, legal approval and public-road approval remain separate decisions.
