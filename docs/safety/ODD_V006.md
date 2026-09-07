# KINGMAST v0.0.6 Operational Design Domain (ODD) — research boundary

Status: draft research ODD. No production/public-road ODD is claimed.

## Product authority

KINGMAST main is SAE Level 0, warning-only/advisory-only. It does not steer, brake, accelerate, shift gear, command torque or write generic CAN actuator frames.

## Approved environments for v0.0.6

- deterministic software simulation;
- desktop/mobile HMI preview;
- bench integration with prototype sensors;
- controlled closed-track experiments only after scenario approval and hardware safety review.

Public-road deployment is outside this ODD unless separately approved through legal/regulatory and independent safety review.

## Inputs in scope

- GNSS/location metadata;
- radar tracks;
- camera-derived object/speed-sign metadata;
- read-only vehicle/CAN state when an approved adapter exists;
- lane/DMS/surround assessment metadata;
- map/navigation context;
- explicitly authorized connected-road/V2X provider metadata.

Raw continuous cabin or surround video is not required by the core event store.

## Preconditions

A feature may present an operational state only when its required inputs are:

- authenticated where required;
- inside freshness bounds;
- monotonic/replay-safe where applicable;
- within schema/range bounds;
- above the feature's confidence threshold;
- calibrated when calibration is necessary;
- reported healthy enough for that feature.

Otherwise the feature degrades or becomes unavailable.

## Environmental research matrix

The following conditions are research scenarios, not claims of validated performance:

- daylight/night;
- glare and tunnel transitions;
- dry road/light rain/heavy rain;
- fog/low visibility;
- faded/ambiguous/missing lane markings;
- construction and temporary lanes;
- dense urban traffic;
- motorcycles/bicycles/pedestrians;
- urban GNSS multipath;
- road hazards and standing water context.

Each scenario test must declare speed, target geometry, sensor configuration and pass criteria. There is no globally validated KINGMAST speed envelope in v0.0.6.

## Known exclusions / fail-degraded conditions

- sensor timestamps outside accepted skew/freshness limits;
- radar/camera/GNSS unavailable beyond feature limits;
- unverified live V2X feed;
- unavailable calibration for a calibration-dependent feature;
- external map/routing provider outage;
- vehicle state whose provenance cannot be verified;
- unsupported hardware/vehicle adapter;
- any request for actuator control.

## Driver responsibility and HMI

- warnings are advisory and may contain false positives or false negatives during research;
- the HMI must never imply that the driver can disengage from the driving task;
- technical/secondary notices are suppressed when they conflict with critical warning attention;
- stale live telemetry must never be silently replaced by simulator data.

## ODD change control

Any expansion of environment, speed, vehicle platform, sensor suite or authority requires:

1. updated hazard/SOTIF analysis;
2. updated scenarios;
3. test evidence;
4. independent review before real-vehicle trials;
5. documentation update before capability status changes.