# KINGMAST v0.0.6 — Connected Road Intelligence Batch

This batch adds connected-road context while keeping the product development version at **v0.0.6**. It is a feature batch, not a product release. The safety boundary remains **warning-only Level 0** with no steering, braking, throttle, drivetrain or CAN-write authority.

## 20 consolidated upgrades
1. Add a normalized V2X/SPaT abstraction for intersection phase data.
2. Keep SPaT source/freshness/confidence explicit instead of assuming signal state from map data.
3. Add school-zone context with active window, advisory speed and distance.
4. Add construction-zone context with the same warning-only contract.
5. Add weather context including visibility, precipitation, wind and road-surface state.
6. Add explicit road-hazard items such as flooding, debris, potholes, slippery surface and low visibility.
7. Add emergency-vehicle advisories with approach state, confidence and siren metadata.
8. Add lane-topology contracts with lane count, lane maneuvers and preferred-lane hints.
9. Add highway-exit guidance with exit reference, destination, side and target lanes.
10. Add authenticated `/connected-road/provider` ingest using the existing edge token policy.
11. Add `/connected-road/context` for the HMI to obtain fused connected-road context.
12. Add `/connected-road/capabilities` without tying API generation to product versioning.
13. Reject stale SPaT, emergency, weather and topology data according to source-specific freshness budgets.
14. Add route-relative distance calculation when an active route is available.
15. Add a deterministic simulator context so the HMI can be exercised without a live V2X provider.
16. Add connected-road alert priority and deduplication.
17. Suppress generic weather notices when a more specific road hazard already explains the risk.
18. Suppress all connected-road notices while an existing collision-critical warning owns driver attention.
19. Add a compact Apple-inspired connected-road HUD ribbon rather than another dashboard page.
20. Add deterministic tests for simulator context, emergency priority, collision suppression and hazard deduplication.

## Driver-attention hierarchy
Connected-road information sits below collision-critical perception warnings. The intended ordering is:

`Collision / VRU hazard → emergency vehicle → SPaT caution → road hazard → construction / school zone → highway exit → lane guidance → general weather context`

The HUD shows at most three connected-road advisories at once. Lower-priority duplicates are intentionally hidden.

## SPaT abstraction
The normalized SPaT model is intentionally provider-neutral. It includes:
- intersection identifier and position;
- approach heading when known;
- signal group;
- movement phase state;
- minimum and maximum end time when supplied;
- confidence, timestamp and source.

The model is compatible with a future J2735/MAP/SPaT adapter, but KINGMAST does **not** claim standards compliance merely because it exposes similar concepts. A production adapter must be verified against the exact provider/RSU message profile.

Public map data must never be presented as live traffic-signal phase.

## School and construction zones
Zone data can come from an explicitly authorized provider or a separately validated public-map adapter. KINGMAST does not infer a school-zone speed restriction solely because a school building is nearby. The HMI continues to tell the driver to verify posted signs.

## Weather and road hazards
Weather input is contextual, not a replacement for driver observation. Road hazards can be more specific than weather and therefore outrank a generic rain/fog notice. Provider timestamps and expiry times are required so stale flooding or debris warnings do not remain indefinitely.

## Emergency vehicles
Emergency-vehicle context may come from an authorized V2X/fleet/roadside provider or validated vehicle-side sensing. KINGMAST does not attempt to access protected dispatch systems. An emergency warning is advisory only and tells the driver to keep a safe path and follow local traffic law.

## Lane topology and highway exits
Lane guidance is descriptive. It can recommend a preferred lane for an upcoming route or exit but does not command a lane change. Missing or low-confidence topology must degrade to ordinary turn-by-turn navigation.

## Provider API
Authenticated provider ingest:

```http
POST /connected-road/provider
x-kingmast-edge-token: <configured token>
content-type: application/json
```

Read-only fused context:

```http
POST /connected-road/context
content-type: application/json
```

The request includes the current vehicle position, optional route and whether a collision-critical warning currently owns attention.

## HMI
The development HMI keeps the existing navigation-first cockpit and adds a bottom connected-road ribbon. The ribbon:
- never covers the dominant collision warning;
- shows no more than three advisories;
- exposes current SPaT availability, lane topology and next-exit context in compact metadata;
- uses stable semantic caution/critical colors;
- respects reduced-motion preferences;
- remains read-only.

## Production gates
Before a connected-road provider can be considered production-ready:
- validate source authentication and transport encryption;
- define provider clock/freshness guarantees;
- characterize dropped/duplicated/out-of-order messages;
- verify intersection and signal-group mapping;
- verify route-to-lane and route-to-exit matching;
- define location-retention/privacy policy;
- prove that collision-critical warnings always preempt connected-road context;
- test sunlight, night, vibration and glanceability on target 12–15 inch displays.

KINGMAST remains Apple-inspired and is not an official Apple CarPlay app or a homologated ADAS product.
