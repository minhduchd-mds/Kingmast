# KINGMAST v0.0.6 Vehicle Computer Qualification Plan

## Scope

This plan defines the next qualification work for the vehicle-computer execution environment while preserving KINGMAST's warning-only Level-0 boundary. It separates CI regression evidence from physical controller evidence so that software results cannot be mistaken for automotive qualification.

## Stage A — CI host regression

Every pull request runs the process-local host soak and risk performance evidence. The goals are classification stability, bounded memory growth, bounded event-loop regression and evidence capture. These checks are repeatable but run on shared general-purpose infrastructure and therefore do not qualify target hardware.

## Stage B — target controller bench

Run the exact production build on the selected controller with sensor interfaces connected in read-only mode. Capture controller identity, kernel/runtime version, software commit, configuration/calibration hashes, memory, CPU, temperature, process restarts, reconnect behavior and sensor health transitions.

Recommended sequence:

- 1 hour baseline soak with nominal sensor feeds;
- 4 hour soak with controlled radar/camera/GNSS/CAN loss and recovery;
- 8 hour endurance soak including application restart and controlled power cycles.

Pass budgets must be approved for the selected hardware before execution. Do not retroactively choose budgets after seeing results.

## Stage C — HIL fault injection

Execute the HIL registry scenarios against physical interfaces and ingest each run through `HIL_EVIDENCE_INGESTION_V006.md`. HIL-011 is the primary vehicle-computer soak scenario; HIL-008 and HIL-012 must demonstrate receive-only CAN behavior independently of software source inspection.

## Stage D — vehicle / closed-track evidence

Only after bench/HIL gates pass should the same warning-only build be evaluated in a controlled vehicle environment. This stage requires independent review of warning timing, sensor degradation, thermal/power behavior and HMI behavior. Public-road operation remains outside the v0.0.6 research qualification scope.

## Required boundaries

No stage authorizes steering, braking, throttle, gear, torque or generic CAN-write commands. CI, SIL, screenshots or simulator traces cannot be promoted into physical HIL or vehicle evidence. Human-factors user-study evidence remains a separate workstream from structural HMI CI checks.
