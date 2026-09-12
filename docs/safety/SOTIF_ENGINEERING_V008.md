# KINGMAST v0.0.8 — ADAS / SOTIF engineering plan

Status: **engineering research plan and software safety architecture**. This document does not claim ISO 21448 conformity, ISO 26262 certification, ASIL assignment, homologation, Euro NCAP performance, FMVSS 127 compliance, HIL qualification, closed-track approval or public-road approval.

KINGMAST main remains **SAE Level 0 warning/advisory only**. It has no steering, braking, throttle, gear, torque or generic CAN-write authority.

## 1. Why this work exists

The ADAS problem is not limited to conventional software faults. A perfectly executing algorithm can still produce unsafe or misleading driver information when the intended function is underspecified, when perception performance is insufficient, or when the environment creates a triggering condition that was not adequately covered by design and validation.

The current published SOTIF reference is ISO 21448:2022. ISO has also started a second-edition working draft in 2026; the published 2022 edition remains the normative public reference for this engineering plan until a replacement is published. ISO 21448 explicitly covers functional/performance insufficiencies and reasonably foreseeable misuse, while conventional faults covered by ISO 26262 and cybersecurity threats are separate concerns.

KINGMAST therefore treats every driver-facing ADAS claim as a **bounded claim supported by provenance, freshness, synchronization, calibration, sensor health, confidence and scenario evidence**. Missing evidence must reduce the claim; it must never be filled by simulation or inferred certainty during a live session.

## 2. Authoritative reference set

Source metadata and URLs are machine-readable in `docs/safety/sotif/V008_SOURCE_REGISTER.json`. Key references:

- ISO 21448:2022 — Safety of the intended functionality: https://www.iso.org/standard/77490.html
- ISO/WD 21448 Edition 2 — revision awareness only, not a published replacement: https://www.iso.org/standard/93071.html
- ISO 26262 road-vehicle functional-safety family: https://www.iso.org/publication/PUB200262.html
- ISO 34502:2022 — scenario-based safety evaluation framework: https://www.iso.org/standard/78951.html
- ISO 34503:2023 — ODD taxonomy/specification: https://www.iso.org/standard/78952.html
- ISO 34504:2024 — scenario categorization: https://www.iso.org/standard/78953.html
- ISO 34505:2025 — scenario evaluation and test-case generation: https://www.iso.org/standard/78954.html
- ASAM OpenSCENARIO XML — dynamic scenario exchange: https://www.asam.net/standards/detail/openscenario-xml/
- ASAM OpenODD 1.0.0 — machine-readable operating-domain modelling: https://publications.pages.asam.net/standards/ASAM_OpenODD/ASAM_OpenODD/latest/specification/index.html
- Euro NCAP Safety Assist latest protocol index: https://www.euroncap.com/safety-assist/
- Euro NCAP AEB Car-to-Car Test Protocol v4.3.1: https://cdn.euroncap.com/cars/assets/euro_ncap_aeb_c2c_test_protocol_v431_532926aad1.pdf
- NHTSA FMVSS No. 127 final-rule information: https://www.nhtsa.gov/press-releases/nhtsa-fmvss-127-automatic-emergency-braking-reduce-crashes

These references are used to structure engineering questions and scenario coverage. Citation does **not** make KINGMAST compliant with a standard or regulation.

## 3. Intended-function decomposition

Each safety-relevant capability is decomposed into what KINGMAST may and may not claim.

### 3.1 Front collision warning / following-gap awareness

Permitted research claim only when required evidence is valid:

- radar-backed range;
- relative/closing dynamics where the speed sources are trustworthy;
- TTC/THW as deterministic derived values;
- warning-only severity;
- explicit degraded/unavailable state.

Prohibited claims:

- automatic braking or collision avoidance;
- guaranteed collision prediction;
- critical TTC derived from stale radar;
- critical escalation from uncertain vehicle speed alone;
- range inferred from a failed radar source;
- validated performance outside an explicitly evidenced speed/environment envelope.

### 3.2 Camera object classification

Permitted:

- class/bearing metadata when the camera observation is fresh and confidence/calibration gates pass;
- use of camera class to enrich a radar-backed object association;
- camera-only spatial context with explicit source provenance.

Not permitted without physical validation:

- camera-only estimated depth as authoritative collision range;
- camera-only critical proximity warning;
- stable class certainty through glare, obstruction or low visibility when observation quality is insufficient.

### 3.3 Radar + camera fusion

Fusion must never create more certainty than its inputs support. Current software requirements:

1. reject stale and excessive future-dated frames and individual observations;
2. require bounded cross-sensor timestamp skew for association;
3. use one-to-one camera/radar association in a single fusion cycle;
4. reject range-inconsistent associations;
5. penalize confidence for association residuals;
6. keep radar-only objects unclassified (`unknown`) rather than inventing a class;
7. expose disagreement/association diagnostics to SOTIF monitoring;
8. keep camera-only estimated range from generating collision-critical textual warnings.

### 3.4 Lane / free-space / surround

A lane or surround geometry claim requires:

- selected sensor set known;
- calibration valid;
- synchronization valid;
- observation fresh;
- sufficient observation quality;
- explicit degradation under faded/missing markings, glare, obstruction, construction or geometry disagreement.

No false lane precision is permitted when the inputs do not support it.

### 3.5 GNSS / navigation context

Navigation context is advisory. Precise positioning claims require bounded accuracy/freshness. Map/routing/traffic providers cannot override collision-critical on-vehicle sensing. Public map data must not be presented as a live traffic-signal or authoritative live hazard feed.

## 4. Runtime SOTIF claim gate

`services/risk-engine/src/sotif-monitor.ts` introduces a research-only runtime monitor. It does **not** certify the function. It answers a narrower question:

> Given the currently observed sensor health, freshness, calibration/time-sync assurance, environment observations and fusion consistency, which intended-function claims are still supportable?

The monitor returns:

- `nominal`, `degraded`, `unavailable` or `outside-research-envelope`;
- reason codes and observed triggering conditions;
- a confidence ceiling;
- allowed claim flags for radar range, relative speed, classification, lane geometry, precise position and critical FCW;
- `controlAuthority: none`;
- `qualificationClaim: research-runtime-monitor-only`.

### Critical design rule: no invented physical envelope

The default runtime policy intentionally sets:

- `validatedSpeedRangeKmh: null`;
- `maxGnssAccuracyM: null`.

A developer is not allowed to invent production-looking speed, weather, visibility or accuracy limits. Such limits must be introduced through a controlled evidence programme tied to exact hardware, calibration, software/configuration, target vehicle and test evidence.

## 5. Triggering-condition taxonomy

KINGMAST tracks triggering conditions in the following families.

### Environment

- heavy rain / radar clutter / camera contrast loss;
- fog / low visibility;
- glare and direct sun;
- abrupt illumination transitions such as tunnel entry/exit;
- wet/standing-water visual ambiguity;
- night and difficult contrast conditions.

Environment state may affect safety logic only when it comes from an observed, fresh and identified source (`vehicle-sensor`, `authorized-provider` or controlled `test-fixture`). The software must not infer weather merely to make a demo appear realistic.

### Dynamic scene

- stopped, slower and braking lead vehicle;
- motorcycle cut-in/cut-out;
- dense motorcycles and occlusion;
- vulnerable road user emerging from occlusion;
- crossing-path and turn-across-path conflict;
- oncoming/head-on geometry;
- curvature/lane-association ambiguity;
- adjacent vehicle with similar bearing.

### Sensor/perception insufficiency

- camera obstruction/dirt;
- radar ghost/multipath;
- class disagreement;
- range disagreement;
- one detection competing for multiple radar tracks;
- low-confidence small targets;
- lane markings faded/missing/temporary;
- GNSS urban multipath.

### Temporal/data integrity

- stale frame;
- stale observation inside a fresh envelope;
- future-dated observation;
- cross-sensor skew;
- frozen live telemetry;
- out-of-order/replayed data.

### Foreseeable misuse / ambiguity

- driver assumes Level 0 warning system controls the vehicle;
- driver treats map/provider context as live road authority;
- operator attempts to use the system outside an evidenced research envelope;
- a development simulator is mistaken for live vehicle truth.

## 6. Scenario engineering model

The machine-readable scenario registry is `docs/safety/sotif/V008_TRIGGERING_CONDITION_REGISTRY.json`.

Every scenario has:

- stable unique ID;
- feature and category;
- class (`nominal`, `boundary`, `triggering-condition`, `degradation`, `misuse`);
- triggering condition / initial condition;
- required inputs;
- expected safe/degraded behavior;
- explicit forbidden claims;
- linked hazards;
- authoritative reference IDs;
- evidence state;
- `controlAuthority: none`.

The format intentionally follows the useful public concepts of ISO 34502/34503/34504/34505: define operating conditions, categorize the scenario, turn scenarios into traceable test cases with IDs/objectives/inputs/steps/platform/expected results, and measure coverage. Those ISO 3450x documents are ADS-focused and do not by themselves establish KINGMAST Level-0 compliance; they are used as scenario-engineering references.

ASAM OpenSCENARIO/OpenODD are future interchange targets for external simulators and machine-readable ODD/operating-condition definitions.

## 7. External benchmark scenarios are comparators, not pass claims

Euro NCAP 2026 Safety Assist currently publishes AEB/FCW car-to-car families including stationary lead, moving lead, braking lead, turn-across-path, crossing-path and head-on cases. The protocol also expects synchronized measurement and manufacturer evidence about sensor architecture, operating limitations and validation routes. KINGMAST uses these families as research coverage comparators, not as a Euro NCAP score claim.

NHTSA FMVSS No. 127 is an AEB/PAEB regulation and therefore exceeds KINGMAST's Level-0 authority. Its vehicle/pedestrian scenario families are useful to identify missing perception scenarios, but KINGMAST does not claim FMVSS 127 compliance and does not implement automatic braking.

## 8. Metrics: measure, do not invent thresholds

The following metrics must be captured per exact hardware/configuration. Numeric production acceptance thresholds remain **TBD by hazard analysis + validation programme** unless backed by reviewed evidence.

### Perception

- detection precision/recall by object class and scenario tag;
- missed detection rate;
- nuisance/false detection rate;
- range error distribution for radar-backed targets;
- bearing error distribution;
- classification confusion matrix;
- track continuity and identity-switch count;
- association match/unmatch/disagreement rate;
- time-sync skew distribution;
- sensor frame age/jitter/drop distribution.

### Warning behavior

- warning onset time relative to scenario ground truth;
- TTC/THW computation error given ground-truth trajectories;
- missed-warning rate;
- nuisance-warning rate;
- warning oscillation/chatter;
- degraded/unavailable transition latency;
- stale/future input rejection rate.

### SOTIF coverage

- scenario-family coverage;
- operating-condition tag coverage;
- triggering-condition coverage;
- boundary-value coverage;
- sensor-degradation coverage;
- foreseeable-misuse coverage;
- unknown/unresolved scenario findings.

## 9. Validation layers

Evidence is kept explicitly separated:

- **L0 static/contract** — source policy, schema, no-actuation boundary;
- **L1 unit** — deterministic risk/fusion/SOTIF monitor tests;
- **L2 service integration** — API, transport, replay/freshness and fault tests;
- **L3 SIL/scenario simulation** — deterministic and parameter-sweep scenario execution;
- **L4 HIL** — real target I/O timing and sensor/ECU interfaces;
- **L5 controlled track** — physical targets, calibrated sensors and ground truth;
- **L6 independent review** — safety/SOTIF reviewer disposition tied to exact evidence.

No software-only layer may auto-promote itself to physical qualification.

## 10. Immediate engineering acceptance rules

A change touching ADAS risk/perception is not complete unless:

1. stale/future/invalid data behavior is defined;
2. sensor provenance is preserved;
3. calibration/synchronization assumptions are explicit;
4. sensor disagreement cannot increase certainty;
5. a missing sensor produces degraded/unavailable behavior rather than synthetic continuity;
6. camera-only depth does not silently become radar-quality range;
7. at least one nominal, boundary, degradation, triggering-condition and misuse scenario exists for a new safety-relevant capability;
8. deterministic tests cover the safety boundary;
9. physical-performance claims stay false until independently reviewed evidence exists;
10. vehicle control authority remains `none`.

## 11. Open physical work before a higher SOTIF maturity claim

The repository cannot complete these items by software alone:

- select production-intent radar/camera/GNSS/IMU and target compute;
- characterize field of view, range, resolution and environmental limits;
- complete sensor mounting/calibration and time synchronization;
- collect calibrated ground truth;
- execute adverse weather/lighting/occlusion campaigns;
- quantify false positives/false negatives and warning timing;
- validate curves, cut-in/cut-out, small VRUs and dense two-wheel traffic;
- HIL timing/fault injection;
- controlled-track evidence;
- independent functional-safety/SOTIF review.

Until those are complete, KINGMAST remains a strong research prototype with deliberately bounded claims, not a production-qualified ADAS product.
