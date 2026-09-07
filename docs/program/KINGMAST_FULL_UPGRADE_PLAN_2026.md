# KINGMAST full-platform upgrade plan — 2026

Status: approved engineering direction for the v0.0.6 research line. The plan preserves warning-only Level 0 authority and does not claim homologation.

## Executive target

Evolve KINGMAST from a strong research/engineering prototype into an evidence-driven automotive research platform with clean trust boundaries, original HMI, deterministic safety logic, privacy-by-design, cyber/update lifecycle controls and repeatable SIL/HIL/closed-track validation.

Target architecture principle:

`Sensors -> trusted/fresh normalized data -> deterministic assessment -> alert manager -> HMI + bounded evidence`

Cloud, maps, AI and V2X remain advisory. They never own immediate collision authority and never create vehicle actuation authority.

## Expert review baseline

Current strengths:

- explicit SAE Level 0 warning-only product boundary;
- HMI separates driving attention from parked tools;
- stale/replayed data handling and sensor-health degradation;
- deterministic TTC/THW risk core separated from HMI;
- signed short-lived viewer sessions and authenticated edge ingestion;
- V2X provider signature verification and trust suppression;
- strong CI with lint, types, unit/contract tests, dependency audit, build and Playwright HMI regression;
- explicit privacy direction: DMS metadata without raw continuous video retention.

Primary maturity gaps:

- formal ODD/HARA/SOTIF/TARA traceability and safety-case evidence;
- fleet-grade device identity, secure boot and signed OTA lifecycle;
- SIL/HIL fault injection and long-duration vehicle-computer performance evidence;
- hardware automotive qualification and physical/read-only CAN enforcement;
- durable bounded forensic/audit storage;
- repository governance (main is currently not protected at the GitHub branch level);
- CSS/component consolidation and measurable human-factors validation.

## Workstream A — safety engineering and traceability (P0)

Deliverables:

- `docs/safety/ODD_V006.md`
- `docs/safety/HARA_DRAFT_V006.md`
- `docs/safety/SOTIF_SCENARIO_CATALOG_V006.md`
- requirement IDs linked to scenario tests and evidence
- safety case index for future independent review

Rules:

- no production ODD is claimed until validated;
- no ASIL assignment is claimed from this repository-only draft;
- every safety-relevant feature defines inputs, freshness, confidence, limitation, degraded behavior and unavailable behavior;
- simulator data can never silently substitute live vehicle data after a live session has been established.

Exit gate A:

- all Level-0 safety goals have testable acceptance criteria;
- each critical hazard has at least one prevention/detection/degradation control and a planned verification method;
- public-road deployment remains blocked.

## Workstream B — runtime architecture hardening (P0/P1)

Target modules:

```text
sensor adapters
  -> ingress authentication/replay/freshness
  -> normalized contracts
  -> fusion/perception metadata
  -> deterministic risk/assist assessment
  -> alert stabilization/attention arbitration
  -> read-only HMI transport
  -> bounded event evidence
```

Required changes:

- introduce explicit read-only vehicle adapter contracts rather than relying only on forbidden API-name scans;
- keep CAN transmit primitives outside the process/package boundary used by KINGMAST main;
- isolate connectivity/map/V2X adapters from sensor-critical assessment;
- make all external-provider failure states first-class;
- bound all queues, arrays, caches and in-memory rate-limit maps with TTL/LRU behavior;
- add structured metrics for frame age, reject counts, risk latency, connection health and provider trust failures.

Exit gate B:

- no code path from HMI/AI/connectivity can obtain actuator authority;
- critical risk evaluation is deterministic and independent of cloud availability;
- freshness and confidence are explicit in contracts and test evidence.

## Workstream C — HMI, DMS and surround human factors (P1)

Maintain driving hierarchy:

1. collision/immediate hazard;
2. maneuver/navigation;
3. posted speed/current speed;
4. assist/spatial state;
5. connected-road advisory;
6. secondary status;
7. diagnostics/settings only while parked.

Upgrades:

- consolidate versioned CSS into foundations/tokens/components/feature layers;
- preserve >=44 px touch floor and >=48 px primary quick actions;
- keep reduced-motion, focus-visible, high-contrast and modal focus-return behavior;
- define glanceability and comprehension test protocol, not only screenshot aesthetics;
- DMS states: attentive / uncertain / distracted / drowsy-suspected / unavailable, always with confidence, freshness and camera-health context;
- DMS remains non-biometric by default: no identity inference and no continuous raw cabin-video retention;
- surround UI exposes uncertainty and calibration state instead of presenting false precision.

Human-factors target inputs include Euro NCAP 2026 Safe Driving/HMI principles, reimplemented independently.

Exit gate C:

- 1366x768, 1920x720 and 1280x480 remain regression-tested;
- critical warnings win attention arbitration;
- secondary technical notices cannot obscure critical driving information;
- usability testing produces measured comprehension/error data.

## Workstream D — cybersecurity and privacy lifecycle (P0/P1)

Deliverable: `docs/cybersecurity/TARA_V006.md`.

Runtime targets:

- per-device identity for future fleet/vehicle prototypes;
- mTLS or equivalent strong device authentication where supported;
- secure element/TPM-backed private keys on production-intent hardware;
- secret rotation and revocation;
- secure boot and signed firmware;
- anti-rollback policy;
- rate limiting with bounded memory;
- authenticated and rate-limited diagnostics/client-error ingestion;
- SAST, secret scanning, SBOM, dependency/license scanning and artifact provenance in CI;
- structured security-event logging without raw secrets/PII.

Privacy targets:

- local-first camera/DMS processing;
- data-minimization matrix by field;
- explicit retention periods for event evidence;
- user-visible privacy state and consent where applicable;
- deletion/export design before cloud telemetry is expanded.

Exit gate D:

- high-risk attack paths have mitigations and tests;
- key/update compromise has a documented recovery path;
- no secret is exposed through `NEXT_PUBLIC_*` or committed edge credentials.

## Workstream E — SUMS/OTA and software provenance (P0)

Deliverable: `docs/updates/SUMS_OTA_ARCHITECTURE_V006.md`.

Independent update lifecycle:

`build -> SBOM -> sign -> publish manifest -> download -> verify -> install eligibility -> atomic install -> boot health -> accept/rollback -> audit`

No Tesla/VinFast installation thresholds are copied. KINGMAST defines its own validated power/parked/thermal/storage preconditions for the selected target hardware.

Exit gate E:

- unsigned or incompatible package cannot install;
- interruption cannot leave an unbootable safety display when the target supports rollback;
- version/config/calibration provenance is visible in diagnostics;
- update installation is impossible while the independently defined moving state says the vehicle is in motion.

## Workstream F — SIL/HIL/fault injection and evidence (P0)

Deliverable: `docs/validation/SIL_HIL_FAULT_INJECTION_PLAN_V006.md`.

Mandatory faults:

- stale/frozen radar and camera;
- reordered/duplicate/replayed packets;
- clock regression/future skew;
- GNSS jump/multipath/loss;
- CAN loss/degraded speed truth;
- camera/radar disagreement;
- calibration unavailable/high reprojection error;
- network/V2X/map outage and forged provider feed;
- process restart/brownout equivalent;
- corrupted update manifest/package;
- high CPU/GPU load and WebGL failure.

Scenario focus for Vietnam-relevant research:

- motorcycle cut-in and dense two-wheeler traffic;
- weak/faded lane markings;
- roadworks and temporary lane shifts;
- heavy rain/low visibility/flood-water context;
- urban GNSS multipath;
- parked-vehicle and pedestrian occlusion;
- high glare/tunnel transitions.

Exit gate F:

- every P0 safety behavior has deterministic replayable tests;
- failure modes degrade truthfully;
- no live-data fault is hidden by simulator continuity;
- bench/closed-track evidence package is reproducible by another engineer.

## Workstream G — hardware and vehicle-integration maturity (P0 before road trials)

The ESP32 path remains prototype-only until hardware evidence exists for:

- automotive power transient protection;
- reverse-polarity/load-dump/brownout behavior;
- watchdog/reset strategy;
- ESD/EMC/EMI considerations;
- thermal operating range;
- isolation/grounding/fusing;
- connector retention and serviceability;
- timestamp synchronization;
- calibration process;
- physically and architecturally enforced read-only CAN path.

A software demo is never evidence of homologated ECU/harness readiness.

## Workstream H — DevSecOps and repository governance (P1)

Immediate repository changes in this program:

- add CODEOWNERS for safety/risk/edge/contracts/workflow surfaces;
- add an engineering-evidence CI gate;
- keep frozen lockfile install and dependency audit;
- retain full UI regression.

Next repository-admin actions:

- protect `main` with PR-only changes;
- require CI checks and review;
- block force push/deletion;
- require safety owner review on relevant paths;
- add CodeQL/SAST, secret scanning, SBOM and signed release provenance when repository/account capabilities permit.

## Program gates

### Gate 0 — research governance
PASS when public sources are logged, clean-room rules are followed, and no proprietary asset/code is introduced.

### Gate 1 — engineering prototype
PASS when CI is green, warning-only boundary is intact, and core features have deterministic test coverage.

### Gate 2 — SIL/HIL
PASS when defined faults are injected and expected degraded states are proven.

### Gate 3 — bench/closed-track
PASS only with approved ODD/scenario plan, calibrated hardware and independent safety review.

### Gate 4 — public-road research
BLOCKED by default. Requires legal/regulatory approval, validated ODD, vehicle-safe hardware, documented safety/cyber case and independent sign-off.

### Gate 5 — commercial/homologation
Out of scope for repository claims until applicable market regulations, ISO/UNECE processes, hardware qualification and external assessment are satisfied.

## Definition of done for any new ADAS capability

A capability is not done until all are true:

- explicit Level-0 authority statement;
- typed input/output contract;
- freshness/confidence rules;
- degraded/unavailable behavior;
- privacy classification;
- threat analysis;
- unit/scenario tests;
- HMI attention behavior;
- observability/evidence fields;
- documentation of hardware/provider dependency;
- full CI green.

## Expected maturity outcome

The near-term goal is not to copy an OEM feature list. The goal is a smaller, more disciplined KINGMAST platform whose behavior is explainable, independently implemented, testable and evidence-backed. Research-prototype maturity can reasonably improve materially once the P0 safety, update, security and HIL gates are closed; production/homologation readiness must remain a separate external validation program.