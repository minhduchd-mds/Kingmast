# KINGMAST HMI V3 — Apple-Inspired Automotive UI/UX

## Product boundary
KINGMAST HMI V3 is an Apple-inspired OEM-style automotive safety interface, not an official Apple CarPlay application. Official CarPlay apps use Apple-provided templates and entitlements. KINGMAST remains warning-only Level 0: no brake, steering, throttle, drivetrain or CAN-write authority.

## 20 consolidated HMI upgrades
1. Navigation-first Drive cockpit.
2. Dynamic road speed limit replaces the previous hard-coded value.
3. Speed-limit change notice with short persistence.
4. Overspeed becomes a caution state without suppressing a critical collision warning.
5. Next maneuver promoted to the top of Drive.
6. Remaining-route distance shown only when a route is active.
7. Route-aware traffic-camera corridor matching.
8. Camera warnings use "ahead" only after route matching.
9. Route camera type copy: speed, red-light, average-speed, traffic.
10. Primary driver navigation reduced to Drive, Navigate and Alerts.
11. Trip, Objects and Vehicle diagnostics become parked-only for moving real vehicles.
12. Simulator keeps parked tools available for bench inspection.
13. Technical coordinates, provider IDs and rejected-packet counters removed from the driving path.
14. Primary touch targets raised to 44+ px, normally 48–56 px.
15. Driver-facing body text increased; 9–10 px labels are removed from critical surfaces.
16. Decorative range sweep removed from Drive.
17. Material hierarchy simplified: fewer glass layers and shadows.
18. Destination latitude/longitude fields replaced by a single Where to? search.
19. Search uses a configurable geocoding adapter; routing remains provider-abstracted through the backend.
20. Map overlays now include route line, route destination, cameras, objects and a live dynamic speed-limit sign.

## Driving information hierarchy
The Drive surface must answer, in order:
1. What do I do next? — maneuver.
2. How fast am I going? — current speed.
3. What is the posted/observed limit? — speed-limit sign.
4. Is there an immediate hazard? — one primary warning.
5. What route-relevant enforcement/road context is ahead? — camera or road context.

Detailed confidence values, coordinates, sensor ages and provider diagnostics belong in parked diagnostics, not the driving surface.

## Warning priority
Collision / vulnerable-road-user critical warning > other safety caution > overspeed caution > navigation information > passive system status.

Overspeed must never visually replace a critical TTC/object warning. The speed sign may gain a caution treatment while the primary alert remains collision focused.

## Speed-limit integrity
The Drive speed-limit sign must consume the same `RoadContext.speedLimit.currentKmh` value used by Navigate. No independent hard-coded speed limit is permitted.

Data priority:
1. Fresh high-confidence local sign observation.
2. Current road map/provider context.
3. Unknown state.

If road context is unavailable, display `—` and prompt the driver to verify posted signs. Do not invent a legal limit for production data.

## Route-aware camera rule
A nearby camera is not automatically a camera ahead. A camera may be described as "ahead" only if it is matched to the active route geometry within the configured corridor and has non-negative route progress relative to the vehicle.

Without an active route, camera copy must say "nearby" rather than "ahead".

Coverage is explicitly partial unless an authorized provider contract guarantees a defined region. KINGMAST does not bypass authentication or access private camera feeds.

## Interaction rules
- Driving primary controls: 48–56 px preferred, never below 44 px.
- Avoid long text entry while moving.
- Destination selection should happen before movement or by low-distraction/voice workflows.
- Primary information remains in the upper and central visual field.
- No decorative animation may delay, cover or compete with a warning.
- Reduced-motion preference is respected.
- Color is never the only warning encoding.

## Verification checklist
- Drive and Navigate show the same current speed-limit value.
- Critical object alert remains primary while overspeed is active.
- Camera on a parallel/non-route road is not labeled "ahead".
- Parked-only tools cannot be entered on a real moving vehicle.
- Simulator remains fully inspectable for development.
- Route search failure leaves Drive usable.
- Road-context failure shows unknown speed limit rather than stale invented data.
- 44 px minimum target gate passes on primary controls.
- 9–10 px typography is absent from critical driving content.
- No actuator command path is introduced.

## Production follow-ups
Before vehicle deployment: replace public demo routing/geocoding endpoints with owned/contracted services, use a native/vector map renderer rather than an embedded public map, validate sunlight/night contrast on target hardware, run driver-distraction studies, and complete OEM/functional-safety review.
