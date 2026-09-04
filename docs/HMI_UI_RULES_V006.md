# KINGMAST v0.0.6 — Apple-Inspired Automotive HMI Rules

KINGMAST is an original warning-only automotive HMI. It is not an official Apple CarPlay application. These rules borrow interaction principles associated with premium Apple product design—clarity, hierarchy, restraint, accessibility, predictable motion, and high-quality material treatment—while remaining an OEM-style custom interface.

## 20 front-end rules

1. **Driving hierarchy is fixed:** maneuver → current speed → posted speed limit → primary hazard → secondary route context.
2. **One primary warning owns attention.** Connected-road and route notices must not visually compete with a critical collision warning.
3. **Warning-only boundary is visible in the product.** UI wording must never imply steering, braking, throttle, gear, torque, or CAN-write authority.
4. **Minimum automotive touch target is 52 px** for primary in-vehicle controls; 44 px is the absolute fallback for secondary controls.
5. **No critical driving text below 13 px.** Secondary labels should normally be 12–14 px; large speed and maneuver values remain dominant.
6. **Speed limit integrity is mandatory.** Never hard-code a posted limit when road context already supplies the current value.
7. **Color is semantic, not decorative.** Blue = navigation/action, green = ready/safe, yellow = caution, red = critical.
8. **Glass is restrained.** Use one elevated material hierarchy rather than blur, glow, and shadow on every card.
9. **Motion explains state.** Startup reveal, route trace, readiness progression, and warning transitions are allowed; ambient cyberpunk animation is not.
10. **Reduced Motion is first-class.** Decorative motion is disabled and boot timing is shortened when the user requests reduced motion.
11. **High Contrast is supported.** Borders and important labels strengthen under `prefers-contrast: more`.
12. **Focus visibility is never removed.** Keyboard and assistive-device focus receives a 3 px high-contrast outline.
13. **The first screen must communicate readiness.** GPS, sensors, route, and warning-only assistance are shown as a short self-check sequence before Drive.
14. **Live-data integrity beats visual continuity.** Once a live vehicle session exists, stale telemetry must not be silently replaced by simulator context.
15. **Route-relevant context only.** SPaT, cameras, exits, and connected-road metadata should surface only when relevant to the current route/approach.
16. **Driver mode hides complexity.** Detailed object confidence, provider metadata, diagnostics, and EV setup belong to parked/diagnostic workspaces.
17. **Short displays preserve safety content.** On 1280×480-class layouts, secondary side panels disappear before speed, limit, maneuver, or primary warning shrink.
18. **1366×768 is a primary validation viewport.** The layout must not horizontally overflow, and main driving values must remain readable.
19. **Wide displays do not add clutter.** 1920×720 gains breathing room and road-scene scale, not extra dashboard widgets.
20. **UI rules are executable.** Source-level UI contract checks and Chromium Playwright tests run in CI on every push to `main` and every pull request.

## Startup sequence

The new startup experience is intentionally short. It moves through GPS/sensor checking, route readiness, and a final `System self-check complete` state before handing the screen to Drive. It uses CSS-rendered horizon, road perspective, route trace, and vehicle depth so the first screen feels premium without coupling the product to a heavy background image asset.

## Motion policy

Normal mode uses a restrained reveal, route trace, horizon breathing, readiness-chip transition, button press feedback, and standard view transitions. No continuous radar sweep or distracting ambient animation should be introduced. Under `prefers-reduced-motion: reduce`, the startup completes quickly and decorative animations are disabled.

## Viewport verification

Automated Chromium checks cover:

- 1366×768: startup, no horizontal clipping, primary hierarchy, minimum control sizing.
- 1920×720: wide automotive cockpit hierarchy.
- 1280×480: short landscape compaction; the secondary drive-side content is removed before safety-critical information.
- Reduced Motion: startup exits quickly and avoids decorative timing dependency.
- Primary navigation interactions: Drive/Navigate/Alerts remain reachable with large controls.

## Safety boundary

All changes in this UI batch remain advisory-only. They do not add control authority, actuator commands, brake/steering/throttle logic, or CAN writes.
