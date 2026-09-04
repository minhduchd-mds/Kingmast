# KINGMAST V2.4 — Automotive Navigation Assist HMI

V2.4 is a driver-attention and navigation-quality upgrade. It remains a **warning-only Level 0 research HMI**. No steering, braking, throttle, drivetrain or vehicle-control authority is introduced.

## 20 consolidated upgrades
1. Replace the embedded map iframe with a native MapLibre rendering surface.
2. Keep a configurable map-style URL for production vector-tile providers.
3. Retain an OpenStreetMap raster fallback for local/demo use with attribution.
4. Render route geometry natively in the map coordinate system.
5. Render vehicle, destination, traffic-camera and detected-object markers in the same map coordinate system.
6. Add heading-up / north-up map orientation control.
7. Match traffic cameras to the active route corridor instead of proximity alone.
8. Filter mapped cameras by travel direction when camera direction metadata exists.
9. Prioritize speed, red-light and average-speed cameras for driver-facing warnings.
10. Add staged camera advisories at about 1 km, 500 m, 300 m and immediate range.
11. Add maneuver urgency states for far, near, prepare and now.
12. Add an advisory lane hint derived from the maneuver instruction; it is not lane-level perception.
13. Add route progress, remaining distance and dynamic ETA estimates.
14. Detect sustained off-route deviation and request a reroute with cooldown protection.
15. Add optional spoken maneuver, camera, speed-limit and reroute guidance using browser speech synthesis.
16. Deduplicate spoken guidance so the driver is not repeatedly interrupted by the same event.
17. Lock destination editing while a real vehicle source is moving; current navigation remains viewable.
18. Cache the latest route for short offline/degraded periods and clearly label cached guidance.
19. Persist a small list of recent destinations for parked quick selection.
20. Add Auto / Day / Night appearance modes, larger touch targets and reduced-motion behavior for automotive readability.

## Driver hierarchy
The main driving surface follows this order:

`Maneuver → lane hint → current speed → posted speed limit → hazard → relevant camera → route progress`

Technical telemetry such as packet counters, sensor ages and coordinates remains outside the normal driving path.

## Camera warning policy
A traffic camera is not automatically a driver warning just because it is nearby. KINGMAST first map-matches the camera to the route corridor and checks direction metadata when available. Driver-facing warning priority is:

1. speed enforcement;
2. average-speed enforcement;
3. red-light enforcement;
4. traffic monitoring only when it has additional driver-relevant metadata.

Coverage is never presented as complete. Only public metadata or explicitly authorized providers are supported.

## Rerouting policy
Off-route distance is measured against the active route geometry. Rerouting requires sustained deviation, not a single noisy GNSS sample, and uses a cooldown to avoid request loops. This is advisory navigation only.

## Voice policy
Voice guidance is optional and can be muted with one large control. Prompts are short and priority-driven. Collision/safety warnings remain visually dominant. Web Speech synthesis is a preview implementation; an embedded production build should use an OEM-approved speech stack.

## Appearance
- **Auto** follows the host/system light-dark preference.
- **Day** increases surface brightness and contrast for daylight testing.
- **Night** preserves the dark automotive palette.

Production sunlight/night validation still requires real display luminance, glare, cabin placement and driver-distraction testing.

## Map provider note
`NEXT_PUBLIC_MAP_STYLE_URL` can point at an approved vector-style provider. When it is blank, the HMI falls back to `NEXT_PUBLIC_MAP_RASTER_TILE_URL`. Public demonstration tile endpoints must not be treated as a production SLA; production deployments need a licensed or self-hosted tile service appropriate for expected traffic.

## Verification gates
- warning-only source boundary remains green;
- TypeScript typecheck passes;
- production Next.js build passes;
- moving destination edit is blocked for real vehicle sources;
- collision-critical severity outranks overspeed caution;
- camera warnings require active-route relevance;
- reroute has sustained-deviation and cooldown gates;
- reduced-motion remains supported.

KINGMAST is Apple-inspired but is **not** an official Apple CarPlay implementation and is not a homologated ADAS product.
