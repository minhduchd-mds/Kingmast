# KINGMAST v0.0.6 HIL Execution Orchestration Runbook

## Purpose

This runbook defines the **pre-execution orchestration gate** for physical HIL scenarios `HIL-001` through `HIL-012`.

The orchestrator does not drive sensors, transmit CAN frames, control vehicle actuators, execute a physical test, approve hardware, mutate evidence registries, or authorize public-road use. It only answers:

1. Is the software contract internally valid?
2. Which HIL scenarios are blocked before execution?
3. Which reviewed physical prerequisites are missing?
4. Which scenarios have complete independently reviewed evidence after execution?

KINGMAST remains warning-only/advisory-only SAE Level 0 with no steering, braking, throttle, gear, torque, drivetrain or CAN-write authority.

## Inputs

Default repository contracts:

- `V006_HIL_BENCH_MATRIX.json`
- `V006_HIL_EQUIPMENT_CAPABILITY_MATRIX.json`
- `../hardware/V006_HARNESS_MAPPING_TEMPLATE.json`
- `../hardware/V006_DEVICE_PROVISIONING_TEMPLATE.json`
- `../sensors/V006_CALIBRATION_CAPTURE_TEMPLATE.json`
- `V006_HIL_TIME_SYNC_CONTRACT.json`
- `V006_HIL_SCENARIO_EVIDENCE_REQUIREMENTS.json`
- `V006_HIL_EXECUTION_MANIFEST.json`
- `V006_HIL_EVIDENCE_REGISTRY.json`

The committed defaults are intentionally fail-closed. They contain no approved equipment assignment, no reviewed vehicle harness mapping, no provisioned hardware records, no physical calibration result, no reviewed time-sync session and no physical HIL result.

## Baseline CI mode

Run:

```bash
node scripts/hil-execution-orchestrator.mjs --json --source-commit "$GITHUB_SHA"
```

Expected committed baseline:

- software contract valid: `true`
- software preparation: `100%`
- ready physical HIL scenarios: `0/12`
- blocked physical HIL scenarios: `12/12`
- reviewed evidence complete: `0/12`
- target hardware qualified: `false`
- public road approved: `false`

A blocked physical baseline is the correct result until genuine reviewed bench inputs exist.

## Physical bench preflight mode

On an approved isolated self-hosted HIL runner, supply reviewed local state files instead of changing source-controlled templates:

```bash
node scripts/hil-execution-orchestrator.mjs \
  --json \
  --require-ready \
  --scenario HIL-001 \
  --source-commit "$GITHUB_SHA" \
  --equipment /approved/kingmast-hil/equipment.json \
  --harness /approved/kingmast-hil/harness.json \
  --provisioning /approved/kingmast-hil/provisioning.json \
  --calibration /approved/kingmast-hil/calibration.json \
  --time-sync /approved/kingmast-hil/time-sync.json \
  --registry /approved/kingmast-hil/evidence-registry.json
```

`--require-ready` returns a non-zero status when the selected scenario has any unresolved physical prerequisite. The orchestrator still does not execute the stimulus.

## Pre-execution blockers

A scenario is blocked when any applicable prerequisite is missing:

- exact 40-character source commit is not frozen;
- vehicle harness mapping is not independently reviewed;
- one or more required equipment roles lack reviewed capability evidence;
- one or more required physical devices are not reviewed/provisioned against the same source commit;
- one or more required sensor calibrations are not independently approved for bounded HIL against the same source commit;
- no reviewed time-synchronization session and evidence-backed numeric acceptance limits exist.

The report uses bounded blocker identifiers such as:

- `equipment:front-radar`
- `provisioning:vehicle-computer-aarch64`
- `calibration:front-radar`
- `time-sync:no-reviewed-session-or-limits`

It does not echo hardware serial numbers, secrets, raw camera data or unrestricted packet payloads.

## Time synchronization

Physical HIL evidence must provide:

- monotonic ordering for local event sequences;
- a reviewed cross-device correlation anchor;
- time-source identity;
- measured offset, uncertainty and drift;
- discontinuity detection;
- exact source-commit binding;
- SHA-256-bound measurement evidence;
- an independent reviewer different from the operator.

The repository deliberately leaves `maxOffsetMs`, `maxUncertaintyMs` and `maxDriftPpm` unset. Numeric limits must come from reviewed bench equipment/scenario requirements; source code must not invent them.

## Equipment capability

The equipment matrix defines capability classes, not approved OEM/vendor models. A physical assignment must bind a bounded SHA-256 equipment identity and reviewed capability evidence to each required role.

The KINGMAST CAN interface remains receive-only. HIL scenarios requiring CAN observation also require an independent bus analyzer capable of detecting unexpected KINGMAST transmit activity. Any unexpected transmit activity is an abort condition under the physical bench contract.

## Evidence completeness

Pre-execution readiness and post-execution evidence completeness are separate.

A physical HIL execution can only become evidence-complete after its registry entry contains independently reviewed physical evidence. A reviewed failure can be evidence-complete while still failing qualification; evidence completeness does not mean the scenario passed.

Repository automation cannot promote a capture into target-hardware qualification or mutate the committed registry automatically.

## Safety stop

Abort or refuse execution if any of the following is true:

- a writable CAN or actuator path is present;
- electrical/harness mapping is guessed or unreviewed;
- required instrumentation is unavailable;
- time correlation cannot be demonstrated;
- equipment, provisioning or calibration identity does not match the frozen test configuration;
- independent review roles are not available;
- test conditions leave the approved isolated bench envelope.

Physical HIL, controlled-track and public-road claims remain separate evidence layers.
