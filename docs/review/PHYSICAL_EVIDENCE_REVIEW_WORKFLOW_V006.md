# KINGMAST v0.0.6 Independent Physical Evidence Review Workflow

## Purpose

This workflow separates evidence capture from engineering review. Automation may validate package structure, hashes and lifecycle metadata, but it cannot perform an independent safety, cybersecurity, hardware or human-factors engineering judgment.

## Lifecycle

`CAPTURED -> QUEUED -> ASSIGNED -> IN-REVIEW -> COMPLETED`

A completed review package records:

- evidence class and scenario ID;
- exact source software commit;
- capture package SHA-256;
- physical evidence operator;
- a different independent reviewer;
- review timestamp;
- review disposition;
- reviewed scenario result when the captured result is accepted;
- bounded findings and review-evidence SHA-256 references.

Allowed review dispositions are:

- `accept-result`
- `accept-with-findings`
- `reject-evidence`

`accept-with-findings` requires at least one finding. `reject-evidence` does not turn a captured run into a pass or fail result.

## Registry promotion

A validated review package does not mutate any registry. HIL and controlled-track registry updates remain human-controlled, and the registry validator remains the final bookkeeping gate. Review queue completion and registry promotion are distinct actions.

## Independence

The reviewer must differ from the physical evidence operator. Programs may impose stricter organizational independence outside this repository.

## Safety boundary

Review completion never creates public-road authorization, homologation, actuator control or CAN write authority. A reviewed failed result must remain visible; it must not be silently replaced by a later run without explicit supersession traceability.
