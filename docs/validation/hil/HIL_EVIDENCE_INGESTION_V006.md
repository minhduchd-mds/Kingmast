# KINGMAST v0.0.6 Physical HIL Evidence Ingestion

## Goal

KINGMAST keeps physical HIL claims separate from CI/SIL evidence. A bench result is accepted into the evidence workflow only when a complete package passes `scripts/hil-evidence-package-check.mjs` and is independently reviewed before the baseline HIL registry is updated.

## Workflow

1. Copy `V006_HIL_EVIDENCE_PACKAGE_TEMPLATE.json` to a new evidence package outside the baseline template.
2. Set `claim` to `physical-hil-result` and `status` to `passed` or `failed` only after a real bench run.
3. Record controller and bench identity, exact 40-character software commit, start/finish timestamps, operator and a different independent reviewer.
4. Reference raw/log/capture artifacts in `evidenceRefs` and bind every reference with SHA-256 in `evidenceDigests`.
5. Add configuration/calibration hashes and harness revision when relevant to the scenario.
6. Run `KINGMAST_HIL_PACKAGE_PATH=<path> pnpm hil:package-check`.
7. After review, transfer the approved result into `V006_HIL_EVIDENCE_REGISTRY.json` and run `pnpm hil:evidence`.

## Evidence integrity

A reference without a SHA-256 binding is rejected by the package validator. The validator also rejects missing timestamps, invalid commit identity, an operator reviewing their own run, unsupported HIL scenario IDs, or a template that attempts to contain physical results.

The package validator verifies structure and evidence bindings; it does not prove that the referenced files are genuine. A production evidence store still requires protected retention, access control, backup and external signing/timestamping appropriate to the program.

## Claim boundary

SIL replay, GitHub Actions host-soak reports, process-local performance measurements and screenshots do not satisfy physical HIL scenarios by themselves. They may be attached only as supplemental evidence.

KINGMAST remains warning-only Level 0. Physical testing must not introduce steering, braking, throttle, gear, torque or generic CAN-write authority into the production boundary.
