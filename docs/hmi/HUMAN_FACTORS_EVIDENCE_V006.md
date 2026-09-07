# KINGMAST HMI human-factors evidence — v0.0.6

Status: structural software evidence for a warning-only Level-0 research HMI. This is not a driver study, regulatory HMI approval, or production vehicle qualification.

## Purpose

The HMI already has executable UI contracts and Playwright regression. This evidence layer makes the human-factors-related repository invariants machine-readable without pretending that source-code checks replace measured user research.

CI generates `kingmast-hmi-human-factors-evidence/v1` from the actual HMI source and test suite. The report is retained with the engineering evidence package and bound into the evidence anchor.

## Structural checks

The report verifies that the repository still contains these design invariants:

- warning-only/no-actuation authority is visible in the driver-facing capability model;
- critical hazards suppress secondary capability/status surfaces;
- the Drive view preserves one primary textual warning owner;
- automotive touch controls retain a 44 px floor and primary quick actions retain 48 px minimum height;
- reduced-motion behavior exists;
- increased-contrast behavior exists;
- modal driver action sheets return focus;
- moving-state capability presentation is filtered/quieted;
- live telemetry loss is not silently replaced by simulator continuity;
- Playwright covers 1366x768, 1920x720 and 1280x480 automotive-class viewports.

## Claim boundary

Every generated report SHALL contain:

- `controlAuthority: none`;
- `qualificationClaim: ci-structural-only-not-user-study`;
- `humanFactorsValidated: false`;
- `userStudyEvidence: false`.

A green report therefore means the checked structural rules are present in the tested source revision. It does not prove glanceability, comprehension, workload, distraction, accessibility for every driver, or safe use in a production vehicle.

## Physical/measured evidence still required

Before any production-intent human-factors claim, collect independently reviewed evidence for at least:

1. glance duration and repeat-glance distribution for critical tasks;
2. warning comprehension and correct-action rate;
3. false-selection/error rate while stationary and in an approved simulator/closed-track protocol;
4. recovery time after warning transitions and degraded-state presentation;
5. readability across target luminance, glare, contrast and viewing-angle conditions;
6. representative driver populations and accessibility needs;
7. target display/touch hardware latency and calibration.

Those results must be stored separately from CI structural evidence and tied to exact software/config/display-hardware revisions.

## OEM / clean-room boundary

The hierarchy is independently designed from generic automotive human-factors principles and public assessment material. It does not reproduce Tesla, BYD, VinFast UI layouts, icons, warning copy, animations, timings or proprietary interaction logic.
