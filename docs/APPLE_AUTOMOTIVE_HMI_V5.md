# KINGMAST V2.5 — Route Intelligence, EV and Surround Safety

V2.5 continues the Apple-inspired automotive HMI direction while preserving the project safety boundary: **warning-only Level 0 driver assistance**. Nothing in this batch can command steering, braking, throttle, drivetrain, gear selection or CAN writes.

## 20 consolidated upgrades
1. Add OSRM route alternatives instead of assuming a single route is always best.
2. Add deterministic EV energy estimation for each route option.
3. Rank route choices with time, energy and configured reserve margin.
4. Persist a parked-only EV profile for battery, usable capacity, consumption and reserve target.
5. Estimate arrival battery percentage for each route alternative.
6. Add route-intelligence contracts shared between backend and HMI.
7. Query public mapped speed-limit segments along the active route corridor.
8. Preview the next meaningful speed-limit transition ahead of the vehicle.
9. Query mapped traffic signals, crossings and roundabouts along the active route.
10. Surface the next junction/intersection event without implying live signal state.
11. Query mapped EV charging stations along the route corridor.
12. Estimate charging-station route distance and approximate detour distance.
13. Suggest a charging stop when projected arrival falls below the configured reserve.
14. Add left/right blind-spot advisories from fused detected-object zones.
15. Add low-speed rear cross-traffic advisories from approaching rear detections.
16. Feed blind-spot and cross-traffic severity into the single dominant driver-warning arbitration.
17. Keep destination edits and route-alternative switching parked-only for real vehicle sources.
18. Add a dedicated parked Energy workspace while keeping only reserve-critical information on Drive.
19. Add 12–15 inch responsive HMI layout profiles with larger touch/readability targets.
20. Add deterministic backend tests for EV energy, route speed zones, junctions, charging extraction and off-route filtering.

## Driver hierarchy
The normal driving surface remains intentionally short:

`Maneuver → current speed → posted limit → next limit change → dominant hazard → relevant camera → junction → ETA / energy reserve`

Detailed object confidence, raw coordinates, route choices, EV profile controls and diagnostics remain outside the normal driving path.

## Speed-zone policy
Upcoming speed limits are derived from mapped metadata near the active route and are advisory. A mapped transition is shown only when it is ahead and differs from the current limit. Camera/sign recognition can still provide fresher current-limit context. **Posted road signs remain authoritative.**

## Intersection policy
KINGMAST may preview a mapped traffic signal, crossing or roundabout. It does **not** claim to know the live phase/state of a traffic light unless a future authorized V2X/SPaT provider is integrated and validated.

## Blind-spot and rear-cross-traffic policy
Blind-spot and rear-cross-traffic warnings are perception advisories derived from fused object metadata. They do not initiate lane changes, steering corrections or braking. A production implementation requires sensor-coverage validation, false-positive/false-negative characterization, mounting calibration and vehicle-level safety analysis.

## EV policy
Energy estimates use route distance and the configured consumption profile. Charging-station metadata from public maps may be incomplete and does not imply live connector availability. A production route planner should integrate an authorized charging provider with live status before presenting availability guarantees.

## Provider and privacy notes
- Routing: OSRM-compatible provider.
- Geocoding: configured Nominatim-compatible provider.
- Route intelligence: public OpenStreetMap/Overpass metadata by default.
- Traffic cameras: public or explicitly authorized providers only.
- Location data remains sensitive; production deployments need retention, transport encryption and access-control policies.

## Verification gates
- warning-only source boundary remains green;
- TypeScript typecheck passes;
- deterministic route-intelligence tests pass;
- production Next.js build passes;
- collision-critical warnings outrank overspeed and energy cautions;
- route alternatives cannot be switched while a real vehicle source is moving;
- mapped speed/junction/charger data is never presented as complete or authoritative;
- reduced-motion remains supported.

KINGMAST is Apple-inspired but is **not** an official Apple CarPlay implementation and is not a homologated ADAS product.
