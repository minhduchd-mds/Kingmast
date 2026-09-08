# KINGMAST v0.0.6 — Controlled closed-track execution plan

Status: preparation only. Physical execution is blocked until all Gate-3 prerequisites are independently reviewed. This document does not authorize public-road use and does not grant any vehicle-control authority.

## Entry prerequisites

The machine-readable gate is `docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json`. Before any controlled-track run, every prerequisite in that registry must be true and independently evidenced:

- reviewed physical target soak;
- reviewed required physical HIL scenarios;
- approved ODD/scenario bounds;
- prototype electrical/harness review;
- physical read-only CAN verification;
- test-activity emergency procedure;
- independent observer assignment;
- synchronized logging readiness;
- frozen build/configuration/calibration identity;
- test-facility approval record.

Repository CI cannot satisfy those physical prerequisites. A software-only run must leave the registry blocked.

## Scenario set

The baseline scenarios are `CT-001` through `CT-008` and focus on Vietnam-relevant warning-only research conditions: dense motorcycle cut-ins, weak lane markings, temporary roadworks geometry, reduced visibility, GNSS multipath, occlusion, glare/tunnel transitions, and simultaneous blind-spot/front-hazard attention arbitration.

Each test is executed within separately approved facility speed/geometry bounds. The repository intentionally does not prescribe public-road speeds or unsafe test maneuvers.

## Evidence contract

For every physical scenario capture, record at minimum:

- exact 40-character software commit equal to the checked-out packaging workflow commit;
- bounded vehicle/rig and facility identifiers;
- configuration and calibration revisions;
- ISO start/finish timestamps;
- different operator, reviewer and independent-observer identities where required;
- synchronized input/warning/HMI timing references;
- bounded operator observations;
- 1..64 unique evidence references with unique SHA-256 digest bindings;
- result summary and independent review disposition.

Raw evidence remains outside source control. Repository-facing evidence must not contain secrets, unrestricted raw camera/cabin video, raw hardware serials or unnecessary precise coordinates.

The guarded `Controlled Track Evidence` workflow supplies `KINGMAST_EXPECTED_SOURCE_COMMIT=${GITHUB_SHA}` to the packager. A capture whose `softwareCommit` does not match that exact repository commit is rejected before packaging.

After the package is created, a `kingmast-physical-evidence-manifest/v1` manifest binds the exact package bytes by SHA-256 to the scenario, source commit, workflow run ID and run attempt. The workflow re-validates that manifest before artifact upload.

## Acceptance behavior

A scenario may be reviewed as pass only when the expected warning/degraded/unavailable state is truthful, Level-0 authority remains intact, critical warnings retain attention priority, simulator data is not substituted for failed live truth, and the evidence can be reproduced from the frozen build/configuration/calibration set.

A scenario may be reviewed as fail when any expected safety behavior is missing, stale/untrusted data is presented as live truth, warning attention is masked, evidence integrity cannot be established, or the physical setup deviates from its approved bounds.

## Stop conditions

The test activity must be stopped and recorded when the physical setup leaves its approved bounds, the independent observer calls a stop, logging/time synchronization is lost, the prototype experiences unexpected reboot/power/thermal behavior, the read-only vehicle boundary cannot be established, or the software/configuration/calibration identity changes.

These are test-activity controls; they are not KINGMAST actuator features.

## Promotion rule

Physical capture alone changes a scenario at most to `captured-awaiting-independent-review`. The packaging workflow sets `automaticQualification=false` and `registryMutation=false`. Only a separate independent review may move a registry entry to `reviewed-pass` or `reviewed-fail`. `closedTrackApproved`, `targetHardwareQualified` and `publicRoadApproved` remain false in repository bookkeeping.

See `docs/validation/PHYSICAL_EVIDENCE_TRUST_CHAIN_V006.md` for the common HIL/controlled-track trust-chain contract.
