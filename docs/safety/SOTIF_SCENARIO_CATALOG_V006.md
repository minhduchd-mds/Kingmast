# KINGMAST v0.0.6 SOTIF scenario catalog

Status: research validation catalog inspired by public safety principles and ISO 21448 concepts. It is not a conformity claim.

## Goal

Find unsafe behavior caused by functional/perception insufficiency even when software has no conventional fault. Every scenario must record sensor configuration, weather/lighting proxy, speed, geometry, expected degraded behavior and evidence.

## Scenario families

| ID | Scenario | Trigger/insufficiency | Expected KINGMAST behavior |
|---|---|---|---|
| ST-001 | Motorcycle cut-in | small lateral target rapidly enters front path | track confidence before escalation; avoid stale target reuse; warn only when deterministic criteria are met |
| ST-002 | Dense motorcycles both sides | many lateral objects and occlusion | maintain spatial state; suppress non-critical clutter; do not convert lateral-only proximity into fabricated collision warning |
| ST-003 | Faded lane markings | low lane confidence | LDW becomes degraded/unavailable; no false lane precision |
| ST-004 | Temporary roadwork lanes | map/lane disagreement | camera/current observation uncertainty is explicit; connected-road advisory cannot override collision-critical sensing |
| ST-005 | Heavy rain | camera contrast and radar clutter change | lower availability/confidence as defined; HMI reports degradation |
| ST-006 | Fog/low visibility | camera detection insufficiency | camera-dependent functions degrade; radar range may remain without fabricated classification |
| ST-007 | Standing water/flood context | road appearance/hazard uncertainty | advisory only; never assert traversability without validated source |
| ST-008 | Strong backlight/sun glare | image saturation | visibility degradation; dependent feature unavailable if thresholds fail |
| ST-009 | Tunnel entry/exit | abrupt exposure change + GNSS loss | map/GNSS context degrades; core on-vehicle warning path remains independent |
| ST-010 | Urban GNSS multipath | position jumps near buildings | reject/qualify low-accuracy jumps; do not project precise objects from untrusted position |
| ST-011 | Occluded pedestrian | object appears late behind parked vehicle | avoid predictive certainty beyond observed evidence; prioritize immediate verified risk |
| ST-012 | Stationary/slow vehicle ahead | range valid but relative speed small/variable | TTC/THW logic remains numerically stable and confidence gated |
| ST-013 | Radar ghost | radar target without camera support | fusion confidence reflects disagreement; no invented class |
| ST-014 | Camera false class | camera class conflicts with radar geometry | geometry/range and classification confidence remain distinct |
| ST-015 | Camera obstruction | lens blocked/dirty | camera-dependent capabilities become unavailable/degraded |
| ST-016 | DMS sunglasses | eyes less observable | uncertain/degraded DMS instead of confident attentive/inattentive state |
| ST-017 | DMS low light | face/gaze quality drops | confidence/availability changes explicitly |
| ST-018 | DMS camera blocked | no valid face observation | DMS unavailable; no identity inference |
| ST-019 | Old V2X SPaT | signed but stale snapshot | reject/expire live state; never present stale phase as live |
| ST-020 | Forged V2X | invalid provider signature | fail closed; connected-road state untrusted/unavailable |
| ST-021 | Speed-map disagreement | mapped limit conflicts with high-confidence sign observation | show source/confidence policy; posted signs/driver observation remain authoritative in wording |
| ST-022 | Network outage during route | provider unreachable | cached/recent route may degrade gracefully; no effect on core sensor warnings |
| ST-023 | WebGL/map failure | rendering unavailable | driver HMI remains alive with non-map safety information |
| ST-024 | Live telemetry freezes | last frame stops changing | explicit stale state; simulator is not substituted |

## Scenario evidence schema

```json
{
  "scenarioId": "ST-001",
  "softwareVersion": "0.0.6",
  "configurationVersion": "...",
  "sensorSet": ["radar-front", "camera-front", "gnss"],
  "initialConditions": {},
  "faultsOrLimitations": [],
  "expectedState": "safe|caution|critical|degraded|unavailable",
  "expectedAuthority": "none",
  "evidence": ["test-log", "trace", "video-optional", "metrics"]
}
```

## Expansion rule

A new perception/DMS/connected-road capability cannot be considered validation-ready until at least one nominal scenario, one boundary scenario, one sensor-degradation scenario and one reasonably foreseeable misuse/ambiguity scenario exist.