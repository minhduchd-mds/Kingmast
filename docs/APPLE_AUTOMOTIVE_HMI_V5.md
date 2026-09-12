# KINGMAST v0.0.8 — Route Intelligence, EV and Surround Safety

This feature document is carried forward into the active **v0.0.8** software checkpoint while preserving the project safety boundary: **warning-only Level 0 driver assistance**. Nothing in this batch can command steering, braking, throttle, drivetrain, gear selection or CAN writes.

> Versioning note: `V5` in this filename describes an HMI feature/design generation, not the KINGMAST product version. The current product checkpoint is v0.0.8. See `docs/VERSIONING.md`.

## Consolidated capabilities
1. OSRM route alternatives instead of assuming a single route is always best.
2. Deterministic EV energy estimation for each route option.
3. Route ranking with time, energy and configured reserve margin.
4. Persisted parked-only EV profile for battery, usable capacity, consumption and reserve target.
5. Estimated arrival battery percentage for each route alternative.
6. Shared route-intelligence contracts between backend and HMI.
7. Public mapped speed-limit segments along the active route corridor.
8. Preview of the next meaningful speed-limit transition ahead of the vehicle.
9. Mapped traffic signals, crossings and roundabouts along the active route.
10. Next junction/intersection context without implying live signal state.
11. Mapped EV charging stations along the route corridor.
12. Charging-station route distance and approximate detour distance.
13. Charging-stop suggestion when projected arrival falls below configured reserve.
14. Left/right blind-spot advisories from fused detected-object zones.
15. Low-speed rear cross-traffic advisories from approaching rear detections.
16. Blind-spot and cross-traffic severity arbitration into the single dominant driver warning.
17. Destination edits and route-alternative switching parked-only for real moving vehicle sources.
18. Dedicated parked Energy workspace with reserve-critical information only on Drive.
19. 12–15 inch responsive HMI layout profiles with larger touch/readability targets.
20. Deterministic backend tests for EV energy, route speed zones, junctions, charging extraction and off-route filtering.
21. English/Vietnamese product-owned HMI localization across Drive, Navigation and related recovery surfaces.
22. Grounded read-only Assistant V1, with moving-mode interaction restrictions and deterministic offline fallback.

## Driver hierarchy
The normal driving surface remains intentionally short:

`Maneuver → current speed → posted limit → next limit change → dominant hazard → relevant camera → junction → ETA / energy reserve`

Assistant and connected-road context remain secondary to collision-critical perception and the active maneuver. Detailed object confidence, raw coordinates, route choices, EV profile controls and diagnostics remain outside the normal driving path.

## Speed-zone policy
Upcoming speed limits are derived from mapped metadata near the active route and are advisory. A mapped transition is shown only when it is ahead and differs from the current limit. Camera/sign recognition can still provide fresher current-limit context. **Posted road signs remain authoritative.**

## Intersection policy
KINGMAST may preview a mapped traffic signal, crossing or roundabout. It does **not** claim to know the live phase/state of a traffic light unless an authorized V2X/SPaT provider is integrated and validated.

## Blind-spot and rear-cross-traffic policy
Blind-spot and rear-cross-traffic warnings are perception advisories derived from fused object metadata. They do not initiate lane changes, steering corrections or braking. A production implementation requires sensor-coverage validation, false-positive/false-negative characterization, mounting calibration and vehicle-level safety analysis.

## EV policy
Energy estimates use route distance and the configured consumption profile. Charging-station metadata from public maps may be incomplete and does not imply live connector availability. A production route planner should integrate an authorized charging provider with live status before presenting availability guarantees.

## Provider, Assistant and privacy notes
- Routing: OSRM-compatible provider.
- Geocoding: configured Nominatim-compatible provider.
- Route intelligence: public OpenStreetMap/Overpass metadata by default.
- Traffic cameras: public or explicitly authorized providers only.
- Assistant provider: server-side adapter only, HTTPS except explicit loopback bench mode, no actuator tools.
- Provider-authored route/road text remains source-authored where trusted translation is unavailable.
- Location and device diagnostics are sensitive; production deployments need retention, transport encryption and access-control policies.
- Assistant transcript is not persisted by the HMI.

## Verification gates
- warning-only source boundary remains green;
- TypeScript typecheck passes;
- deterministic route-intelligence and Assistant contract tests pass;
- production Next.js build passes;
- collision-critical warnings outrank overspeed, energy, connected-road and Assistant context;
- route alternatives cannot be switched while a real vehicle source is moving;
- mapped speed/junction/charger data is never presented as complete or authoritative;
- moving Assistant text composition remains disabled;
- Vietnamese and English localization preserve identical safety authority;
- reduced-motion remains supported.

Historical v0.0.6/v0.0.7 physical/HIL evidence remains version-bound and is not promoted by this software checkpoint.

KINGMAST is Apple-inspired but is **not** an official Apple CarPlay implementation and is not a homologated ADAS product.
