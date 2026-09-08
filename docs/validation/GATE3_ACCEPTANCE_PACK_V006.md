# KINGMAST v0.0.6 — Gate-2 to Gate-3 Acceptance Pack

## Purpose

This pack defines the evidence required to move KINGMAST from software/SIL/HIL engineering evidence toward a **controlled closed-track research gate**. It does not approve public-road use, does not create a homologation claim, and does not expand KINGMAST beyond warning-only/advisory-only SAE Level 0 authority.

The machine-readable policy is `docs/validation/V006_GATE3_ACCEPTANCE_CRITERIA.json`. Release/toolchain/display compatibility is tracked in `docs/validation/V006_RELEASE_QUALIFICATION_MATRIX.json`.

## Current disposition

**BLOCKED — physical target-hardware evidence and independent acceptance review are still required.**

GitHub Actions evidence is regression evidence only. A green CI run is not proof that a vehicle computer, display, sensor harness or physical vehicle is qualified.

## Acceptance package

| Area | Required evidence | Gate-3 pass condition |
| --- | --- | --- |
| Target computer | Hardware model, CPU architecture, RAM/storage, OS image, runtime, display | Exact tested target identity is recorded and reproducible |
| Software identity | Git SHA, v0.0.6, lock digest, SBOM, provenance | Installed artifacts resolve to the reviewed source/build |
| Firmware/config/calibration | Signed firmware manifest, config revision, sensor calibration revision | Compatibility is explicit and no unrecorded calibration/config is used |
| Boot/recovery | Cold/warm power cycles, boot-to-ready measurements, restart behavior | No unsafe state; approved project-specific timing threshold is met |
| HMI performance | Frame timing/jank under map + surround + warning load; WebGL loss | Driver surface remains usable and renderer failure falls back deterministically |
| Soak/resources | Multi-hour target-hardware CPU/RSS/heap/event-loop/bounded-state record | No unbounded growth or degradation that compromises warning presentation |
| Fault injection | Sensor stale/loss, provider loss, storage degradation, reconnect/restart | System degrades explicitly, never gains actuator authority, and does not mask live-data loss with simulator data |
| Update/recovery | Invalid signature, incompatibility, failed install, rollback | Unsafe/untrusted update is rejected and recovery path is demonstrated |
| Closed track | Vehicle, operator, route, weather, sensor state, scenario results | Defined scenarios execute in a controlled environment with traceable evidence |
| Review | Safety, cyber and engineering review record | Closed-track scope is approved; public-road/homologation remain separately blocked |

## Minimum physical run record

Each physical run must capture a unique run ID, UTC start/end time, vehicle identifier appropriate for the research program, vehicle-computer hardware identity, software commit, firmware/config/calibration revisions, display class, sensor inventory, scenario IDs, operator/reviewer identifiers, environment/weather, observed warnings, degraded-mode transitions, anomalies and disposition.

Do not retain raw cabin video merely to satisfy this pack. DMS evidence should use the minimum derived state necessary for the test objective unless a separately approved study requires raw media.

## CI evidence that may accompany the pack

The existing CI bundle may contribute deterministic risk-performance, short host-soak, realtime recovery/loopback, HMI structural checks, browser HMI performance, SIL replay, SBOM, provenance and security results. Those materials help establish software integrity but cannot replace the physical evidence above.

## Authority boundary

KINGMAST remains read-only with respect to the vehicle. No Gate-3 evidence may introduce steering, braking, throttle, torque, gear, drivetrain or CAN-write authority. If any test configuration requires actuator authority, it is outside this repository's approved scope and must stop at the safety gate.

## Gate decision

Gate-3 may only change from **blocked** to an approved controlled-closed-track disposition after all machine-readable criteria are supported by physical evidence and a recorded independent review. That decision does not authorize public-road research or commercial/homologated use.
