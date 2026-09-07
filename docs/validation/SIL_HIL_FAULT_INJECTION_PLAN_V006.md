# KINGMAST v0.0.6 SIL/HIL and fault-injection plan

Status: validation plan for research/closed-track progression. Public-road approval is not implied.

## Validation layers

### L0 — pure unit/contract

Risk, lane, DMS, fusion, replay, provider trust, session and alert-stabilization functions.

### L1 — SIL scenario replay

Synthetic/replayed normalized inputs drive the actual risk/assist runtime without real sensors.

### L2 — service integration

Risk engine + HMI + WebSocket + provider adapters with controlled faults.

### L3 — HIL bench

Real edge controller/sensor interfaces connected to deterministic signal/fault generators.

### L4 — closed track

Instrumented target vehicle/prototype only after ODD/scenario and hardware review.

## Mandatory fault matrix

| Fault | Injection | Expected behavior |
|---|---|---|
| frozen radar | hold timestamp/frame | radar becomes unavailable; old range is not reused as live truth |
| stale camera | stop camera updates | classification/camera-dependent functions degrade |
| GNSS jump | inject implausible low-quality position | position context is degraded/rejected; no false precision |
| duplicate sequence | resend edge sequence | packet rejected |
| reordered sequence | send lower sequence | packet rejected |
| future skew | timestamp beyond accepted skew | packet rejected |
| clock regression | move timestamp backward | packet rejected/degraded |
| CAN loss | mark unavailable/degraded | confidence reduces; no unjustified critical escalation from uncertain speed alone |
| radar-camera disagreement | conflicting geometry/class | fusion exposes uncertainty; no fabricated class/range |
| surround calibration loss | high reprojection error/un-calibrated camera | 360 readiness degrades; UI does not show calibrated precision |
| V2X forged signature | invalid signature | provider snapshot rejected |
| V2X stale state | old signed timestamp | live state expires/rejects |
| routing outage | provider timeout/503 | navigation degrades; core sensor warning path stays active |
| WebGL failure | disable WebGL | non-map HMI stays operational |
| live frame freeze | stop WebSocket updates | explicit stale state; no simulator substitution |
| process restart | restart risk engine | recovery is observable; no hidden continuity assumptions |
| update hash failure | tamper artifact | installation rejected |
| update boot failure | health check fails | rollback/recovery path invoked in future OTA implementation |
| resource pressure | bounded CPU/memory/network load | latency metrics/health show degradation without unbounded memory growth |

## Vietnam-relevant SIL/HIL scenarios

- dense motorcycle flow with cut-ins from both sides;
- motorcycle in blind spot while another object is front-critical;
- faded lanes and patchy road paint;
- construction with temporary cones/lane shift;
- heavy rain and spray reducing vision quality;
- standing water/flood advisory with uncertain traversability;
- bus/truck occluding pedestrian or motorcycle;
- urban canyon GNSS multipath;
- tunnel entry/exit exposure transition;
- mixed bicycles/pedestrians near curb and parked cars.

## Metrics

Record at minimum:

- input timestamp and age;
- sequence/boot/device ID where applicable;
- sensor health/confidence;
- risk-evaluation latency;
- warning state/transition timestamp;
- HMI receive/render timestamp when measurable;
- rejected packet reason/count;
- provider trust state;
- process memory/CPU during soak tests;
- software/config/calibration version.

## Acceptance rule

A safety-relevant fault passes only when:

1. the fault is detected or its effect is bounded by design;
2. output does not exceed Level-0 authority;
3. degraded/unavailable state is truthful;
4. critical warning attention is not masked;
5. simulator/demo state is not substituted for lost live truth;
6. the evidence is reproducible.

## Closed-track entry checklist

- approved scenario and speed/geometry bounds;
- prototype electrical/harness review;
- physical/read-only CAN boundary verified;
- emergency stop procedure for the test activity (not a KINGMAST actuator feature);
- independent observer/reviewer;
- synchronized logging;
- known software/config/calibration hashes;
- rollback/recovery plan;
- no public-road exposure.