# KINGMAST Autonomy Lab

Simulation-only research workspace for sensing, safety recognition, scenario generation and future CARLA/ROS 2/Autoware-style experiments.

This directory is intentionally excluded from the commercial warning-only ECU release path. No autonomy-lab controller is deployable to a road vehicle from `main`, and production code is forbidden from importing this lab.

## Independent Safety Research

`autonomy-lab/safety-research/` is a clean-room research registry for public regulator, standards-body and OEM material from the United States, Europe, Vietnam and international sources. Accepted entries contain source metadata plus original paraphrases only. The registry cannot automatically promote a finding or threshold into production.

`autonomy-lab/safety-sim/` is a deterministic independent oracle. It deliberately does **not** import `services/risk-engine`, shared production contracts, HMI code or edge implementations. That separation reduces common-mode validation error: the research oracle and production implementation cannot pass merely because they share the same code.

`autonomy-lab/adapters/` holds simulator-neutral interoperability bridges. The current ASAM bridge targets OpenDRIVE 1.9.0 and OpenSCENARIO XML 1.4.0 metadata, but does not claim schema conformance until an external schema/simulator validates generated artifacts.

`autonomy-lab/digital-twin/` defines the external CARLA/esmini execution boundary. The checked-in runner contract fixes the reviewed wrapper paths and result envelope, while the manual external-simulator workflow binds genuine outputs to the exact source commit, campaign SHA-256, runner-native result identity, cross-simulator parity report and a bounded evidence manifest. The manifest remains `captured-awaiting-independent-review`; simulator success cannot promote HIL, target-hardware, controlled-track or public-road status.

`autonomy-lab/validation/` maps virtual research domains to existing HIL and controlled-track evidence IDs and contains a Vietnam-specific synthetic controlled-track research pack. Those mappings never promote virtual results into physical pass status.

Run:

```bash
pnpm research:safety-check
pnpm research:safety-gaps -- --json
pnpm sim:safety-independent -- --json --ci
pnpm sim:safety-sweep -- --json --ci
pnpm sim:safety-campaign -- --json --ci
pnpm sim:asam-bridge -- --all --json
pnpm sim:digital-twin-contract
pnpm sim:external-runner-contract
pnpm sim:external-evidence-selftest -- --json
pnpm sim:physical-traceability
pnpm sim:vn-track-pack
```

The current simulation score is a research coverage/consistency metric only. It is not an ASIL, FMVSS, UNECE, EU type-approval, QCVN, Euro NCAP, HIL, closed-track or public-road safety rating.

## Research promotion rule

Public source -> candidate principle -> human review -> accepted research registry -> scenario mapping -> independent simulation -> production proposal -> separate engineering review -> SIL/HIL/physical evidence.

There is no online self-learning path that can rewrite production warning thresholds. New research may generate proposals and new scenarios, but any production change remains human-controlled, versioned and independently validated.
