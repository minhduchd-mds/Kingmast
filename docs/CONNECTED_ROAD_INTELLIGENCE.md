# KINGMAST v0.0.8 — Connected Road Intelligence

This document is carried forward into the active **v0.0.8** software checkpoint. The safety boundary remains **warning-only Level 0** with no steering, braking, throttle, drivetrain or CAN-write authority.

## Consolidated capabilities
1. Normalized V2X/SPaT abstraction for intersection phase data.
2. Explicit SPaT source/freshness/confidence instead of assuming signal state from map data.
3. School-zone context with active window, advisory speed and distance.
4. Construction-zone context under the same warning-only contract.
5. Weather context including visibility, precipitation, wind and road-surface state.
6. Explicit road-hazard items such as flooding, debris, potholes, slippery surface and low visibility.
7. Emergency-vehicle advisories with approach state, confidence and siren metadata.
8. Lane-topology contracts with lane count, lane maneuvers and preferred-lane hints.
9. Highway-exit guidance with exit reference, destination, side and target lanes.
10. Authenticated `/connected-road/provider` ingest with provider identity controls.
11. `/connected-road/context` for fused read-only HMI context.
12. `/connected-road/capabilities` without tying API generation to product versioning.
13. Source-specific freshness budgets for SPaT, emergency, weather and topology data.
14. Route-relative distance calculation when an active route is available.
15. Deterministic simulator context for HMI bench verification without a live V2X provider.
16. Connected-road alert priority and deduplication.
17. Generic weather suppression when a more specific road hazard already explains the risk.
18. Connected-road suppression while an existing collision-critical warning owns driver attention.
19. Compact connected-road HUD ribbon rather than another dashboard page.
20. Deterministic tests for simulator context, emergency priority, collision suppression and hazard deduplication.
21. English/Vietnamese product-owned connected-road shell copy while provider-authored safety content remains source-authored without a trusted translation path.
22. Grounded Assistant explanations remain subordinate to the connected-road warning state and have no vehicle-control authority.

## Driver-attention hierarchy
Connected-road information sits below collision-critical perception warnings. The intended ordering is:

`Collision / VRU hazard → emergency vehicle → SPaT caution → road hazard → construction / school zone → highway exit → lane guidance → general weather context → Assistant explanation`

Lower-priority duplicates are intentionally hidden.

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

## Provider trust
Provider identity is separate from vehicle/device identity. Production-intent connected-road sources require authenticated transport, bounded freshness and explicit trust/revocation handling. Public-map data and authorized live V2X are separate trust classes.

The Assistant provider is also a separate trust domain. It does not receive provider secrets from browser code and receives no actuator tool surface.

## HMI
The development HMI keeps the navigation-first cockpit and a compact connected-road ribbon. The ribbon:
- never covers the dominant collision warning;
- exposes only attention-relevant connected-road context;
- uses stable semantic caution/critical colors;
- respects reduced-motion and locale preferences;
- remains read-only.

## Production gates
Before a connected-road provider can be considered production-ready:
- validate source authentication and transport encryption;
- define provider clock/freshness guarantees;
- characterize dropped/duplicated/out-of-order messages;
- verify intersection and signal-group mapping;
- verify route-to-lane and route-to-exit matching;
- define location-retention/privacy policy;
- prove that collision-critical warnings always preempt connected-road and Assistant context;
- test English/Vietnamese presentation, sunlight, night, vibration and glanceability on target displays;
- generate new v0.0.8 target evidence before making physical/HIL qualification claims.

Historical files explicitly named `V006` and prior v0.0.7 release evidence remain bound to their original evidence campaigns and are not relabelled by this software checkpoint.

KINGMAST remains Apple-inspired and is not an official Apple CarPlay app or a homologated ADAS product.
