# KINGMAST Independent Safety Simulation

The simulator is a small deterministic research oracle designed to stay independent from production code.

It currently covers 35 scenarios plus at least 185 bounded deterministic parameter variants across forward collision, vulnerable road users, lane departure, driver monitoring, speed context, sensor integrity/limitations, rear cross traffic, blind spot, surround-camera readiness, connected-road trust, update integrity and warning arbitration.

## Independence guarantees

- no import of `services/risk-engine`;
- no import of production contracts, HMI or edge code;
- no network access during deterministic execution;
- no shelling out to external simulators;
- no online learning;
- no automatic mutation of production thresholds;
- `controlAuthority = none`;
- physical/HIL/closed-track/public-road claims are always false.

The native JSON library is intentionally simulator-neutral. `autonomy-lab/adapters/export-asam-bridge.mjs` emits a reviewable bridge manifest targeting ASAM OpenDRIVE 1.9.0 and OpenSCENARIO XML 1.4.0. It deliberately reports `asamSchemaValidated=false`, `carlaExecuted=false` and `esminiExecuted=false` until external tools validate/execute a generated scenario.

## Score interpretation

`recognitionResearchScore` is a weighted measure of scenario pass consistency, degradation/rejection handling, region coverage, vulnerable-road-user class coverage, driver-monitoring coverage and safety-boundary preservation.

A high score means **broad deterministic research coverage**, not that the vehicle is safe in the real world.
