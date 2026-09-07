# KINGMAST v0.0.6 HIL evidence registry

Status: evidence-control contract for research/closed-track progression. It does not claim that HIL testing has been completed and does not imply public-road approval, homologation or standards conformity.

## Purpose

`docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json` is the machine-readable index for physical hardware-in-the-loop evidence. It intentionally starts with every scenario in `pending` state and top-level claim `no-hil-results-claimed`.

The registry solves a specific assurance problem: a green unit/SIL/CI pipeline must never be presented as physical HIL proof.

## Status semantics

- `pending` — required physical bench evidence does not yet exist or has not been attached.
- `blocked` — execution is intentionally blocked by missing equipment, integration, safety review or another recorded dependency.
- `passed` — the physical HIL scenario was executed and the evidence object satisfies the required identity, provenance, timing and review fields.
- `failed` — the physical HIL scenario was executed and failed; the same evidence quality requirements apply as for a passed result.

A `pending` or `blocked` entry must keep `evidence: null`. This prevents a placeholder from looking like a completed test.

## Claimed-result evidence minimum

Any `passed` or `failed` scenario must identify at least:

- target controller identity;
- HIL bench identity;
- exact 40-character software commit SHA;
- test start and finish timestamps;
- operator;
- independent reviewer;
- one or more durable evidence references;
- result summary.

Configuration/calibration SHA-256 hashes and harness revision are required by the scenario where applicable and should be supplied whenever the test depends on them.

Evidence references should point to controlled artifacts such as synchronized measurement logs, bus captures, power traces, photos of the bench/harness, calibration records, firmware/build artifacts or signed review records. Raw secrets and private keys must never be attached as evidence.

## CI honesty gate

`pnpm hil:evidence` runs `scripts/hil-evidence-check.mjs` and fails closed when:

- the baseline registry or required HIL scenarios are missing;
- duplicate scenario IDs exist;
- an unsupported status appears;
- a pending/blocked entry contains evidence that could imply a physical result;
- a passed/failed result lacks controller/bench/provenance/timestamp/operator/reviewer/evidence references;
- a result claims a malformed commit or SHA-256 hash;
- the top-level no-HIL claim conflicts with scenario result claims.

The gate validates evidence bookkeeping and claim integrity. It does **not** execute HIL equipment, validate sensor physics, certify a board or prove the evidence is true. Independent review and physical test controls remain required.

## Baseline physical scenarios

The v0.0.6 registry tracks twelve baseline HIL activities covering radar freshness, replay/clock faults, DMS temporal integrity, surround synchronization/calibration, device-auth tamper/revocation, signed-update/rollback behavior, power-loss recovery, CAN-loss behavior, GNSS faults, radar-camera disagreement, restart/soak behavior and the physical read-only CAN authority boundary.

These scenarios complement the executable SIL/fault-injection corpus; they do not replace it.

## Promotion rule

A scenario may move from `pending`/`blocked` to `passed`/`failed` only after a real physical run has occurred and its evidence is available for review. Do not change a scenario to `passed` merely because:

- unit tests pass;
- deterministic SIL replay passes;
- Playwright passes;
- CodeQL is green;
- firmware source policy passes;
- a simulated hardware model passes.

## Safety boundary

KINGMAST v0.0.6 remains Level-0 warning-only. HIL evidence must verify degraded/fail-closed behavior and the physical read-only integration boundary; it must not introduce steering, braking, throttle, torque, gear or generic CAN-write authority.
