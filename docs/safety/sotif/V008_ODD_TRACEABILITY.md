# KINGMAST v0.0.8 — SOTIF operating-domain and test traceability

Status: **research engineering artifact**. This document does not claim ISO 21448 conformity, ISO 34503 compliance, ASAM OpenODD conformance, ASAM OpenSCENARIO XML conformance, HIL qualification, controlled-track qualification, homologation or public-road approval.

KINGMAST remains **Level 0 warning/advisory only** with `controlAuthority: none`.

## 1. Why this artifact exists

The SOTIF scenario registry alone is not enough. Every triggering condition needs three additional forms of traceability:

1. the operating conditions under which the scenario is meaningful;
2. the software evidence that can exercise or constrain the scenario;
3. the physical evidence that is still required before any performance/qualification statement is allowed.

The machine-readable profile is `V008_RESEARCH_OPERATING_DOMAIN.json`. It uses ISO 34503:2023 and ASAM OpenODD 1.0.0 as **structural references**. Because KINGMAST is a Level-0 warning platform and physical bounds have not been established, the file deliberately calls itself a **research operating-domain model**, not a validated production ODD.

## 2. Operating-condition dimensions

The profile separates conditions into:

- scenery and road context;
- environment/illumination/precipitation/visibility;
- dynamic traffic and conflict families;
- sensor health, calibration, synchronization and freshness;
- external map/routing/connected-road context;
- physical validation state.

Environment values may influence a runtime SOTIF decision only when they are actually observed by an identified fresh source. The model explicitly forbids fabricated weather values.

## 3. No invented validation envelope

All production-looking physical limits remain `null` until evidence exists for the exact hardware/configuration:

- validated speed range;
- radar detection range;
- camera detection range;
- visibility range;
- precipitation range;
- illumination range;
- temperature range;
- GNSS accuracy limit;
- cross-sensor synchronization limit.

The profile also keeps these flags false:

- `targetHardwareQualified`;
- `hilQualified`;
- `controlledTrackQualified`;
- `publicRoadApproved`.

A future physical-evidence change must bind any non-null limit to exact sensor part numbers, mounting, calibration, compute target, software/configuration identity, ground-truth method and independent review disposition.

## 4. Runtime SOTIF assurance snapshot

`services/risk-engine/src/sotif-assurance.ts` composes the feature-level `sotif-monitor` assessments into one bounded diagnostic snapshot.

The snapshot reports:

- overall state;
- minimum confidence ceiling across evaluated features;
- per-feature assessments;
- whether speed/GNSS research-envelope bounds were explicitly provided;
- whether critical collision warning is supportable;
- physical evidence flags, all false in software-only evidence;
- `controlAuthority: none`;
- `qualificationClaim: research-runtime-diagnostics-only-not-sotif-conformity`.

This snapshot is an engineering diagnostic object. It is not a certification result and does not grant a warning claim that the underlying monitor has rejected.

## 5. Scenario-to-test traceability report

Run:

```bash
pnpm sotif:traceability
```

The report is `kingmast-sotif-test-traceability-report/v1` and creates a stable test-case ID `TC-S8-xxx` for each SOTIF scenario.

For every scenario it records:

- objective and expected behavior;
- required inputs;
- linked hazards and public-source references;
- forbidden claims;
- candidate automated evidence files;
- whether the exact stable scenario ID is asserted in those test files;
- required validation layers;
- explicit pending physical evidence state.

A candidate test file is **not** treated as proof that the exact scenario executed. Direct scenario-ID linkage is reported separately so gaps are visible rather than hidden.

## 6. Validation-layer policy

The planning report uses the existing KINGMAST evidence layers:

- L0 static/contract;
- L1 deterministic unit tests;
- L2 service integration/fault behavior;
- L3 SIL/scenario simulation;
- L4 HIL;
- L5 controlled track;
- L6 independent review.

Boundary, triggering-condition and degradation scenarios retain L4/L5 as future requirements where physical perception/timing behavior matters. Software evidence must never auto-promote a scenario to HIL/track qualification.

## 7. OpenODD / OpenSCENARIO bridge

Run:

```bash
pnpm sotif:openx -- S8-001
```

or directly:

```bash
node autonomy-lab/adapters/export-sotif-openx-bridge.mjs S8-001 --json
```

The bridge targets:

- ASAM OpenODD 1.0.0 for machine-readable operating-domain context;
- ASAM OpenSCENARIO XML 1.4.0 for future dynamic-scenario interchange.

The current output is intentionally a **bridge manifest**, not an OpenODD document and not a `.xosc` file. It carries `openOddSchemaValidated: false`, `openScenarioXmlSchemaValidated: false` and `asamConformant: false`.

Actual ASAM export is not complete until generated artifacts are validated against the selected official schema/toolchain and executed in an external simulator under a reviewed mapping.

## 8. Automated policy gate

`pnpm sotif:policy` now checks both the original SOTIF engineering policy and the ODD/traceability policy.

The additional gate rejects changes that:

- invent physical numeric bounds;
- turn physical/HIL/track/public-road flags true without a separate evidence process;
- reference unknown HARA hazards or unknown authoritative source IDs;
- lose candidate test traceability for a SOTIF scenario;
- imply ASAM schema validation/conformance that has not occurred;
- weaken the Level-0/no-actuation boundary.

## 9. Next physical/engineering work

This update improves **traceability and claim control**, not physical perception maturity. The next SOTIF work remains:

1. bind stable S8 scenario IDs directly into deterministic SIL tests;
2. add measured radar/camera time synchronization and calibration lifecycle evidence;
3. select exact production-intent radar/camera/GNSS/IMU/compute targets;
4. create HIL fault-injection vectors for stale/future/disagreement/calibration cases;
5. create controlled-track ground-truth packages for lead-vehicle, VRU, cut-in/cut-out and curvature cases;
6. quantify detection, range, bearing, association, missed-warning and nuisance-warning distributions;
7. obtain independent SOTIF/functional-safety review before changing any qualification claim.
