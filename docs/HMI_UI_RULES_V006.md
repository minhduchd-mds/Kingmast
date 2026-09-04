# KINGMAST v0.0.6 — Apple-Inspired Automotive HMI & Engineering Rules

KINGMAST is an original warning-only automotive HMI. It is not an official Apple CarPlay application. These rules apply Apple Human Interface Guidelines principles—clarity, hierarchy, restraint, accessibility, predictable motion, simplicity and careful craft—without copying Apple layouts, assets or proprietary templates.

Primary references:
- Apple Human Interface Guidelines — CarPlay: https://developer.apple.com/design/human-interface-guidelines/carplay/
- Apple Human Interface Guidelines — Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility/
- Apple Human Interface Guidelines — Design principles: https://developer.apple.com/design/human-interface-guidelines/design-principles/

## 20 front-end rules

1. **Driving hierarchy is fixed:** maneuver → current speed → posted speed limit → primary hazard → secondary route context.
2. **One primary warning owns attention.** Connected-road and route notices must not visually compete with a critical collision warning.
3. **Warning-only boundary is visible in the product.** UI wording must never imply steering, braking, throttle, gear, torque, or CAN-write authority.
4. **Minimum automotive touch target is 52 px** for primary in-vehicle controls; 44 px is the absolute fallback for secondary controls.
5. **No critical driving text below 13 px.** Secondary labels should normally be 12–14 px; large speed and maneuver values remain dominant.
6. **Speed limit integrity is mandatory.** Never hard-code a posted limit when road context already supplies the current value.
7. **Color is semantic, not decorative.** Blue = navigation/action, green = ready/safe, yellow = caution, red = critical. Text/status labels must also communicate state so color is never the only signal.
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

## Back-end and edge engineering rules

Apple HIG does not prescribe a server architecture. KINGMAST translates the same product principles into back-end engineering constraints rather than claiming an “Apple backend standard.”

1. **Simple explicit contracts over implicit state.** Vehicle, perception, driver-assistance and HMI states cross service boundaries through typed contracts.
2. **Fail closed.** Missing, stale, replayed, untrusted or low-confidence data becomes `degraded`/`unavailable`; the server never invents a healthy state for visual continuity.
3. **Least privilege by default.** Edge sensor ingress and viewer APIs have separate authentication boundaries. AI tools are allowlisted and read-only; no brake, steering, throttle, gear, torque or generic CAN-write tool exists.
4. **Freshness is part of correctness.** Runtime status includes observation timestamps and bounded freshness windows. A feature can be software-ready but must not be labeled live without fresh validated data.
5. **Replay resistance is mandatory.** Sensor and assist ingress rejects stale, future-skewed or non-monotonic observations.
6. **Inputs are bounded and validated.** Public/native bridge payloads use schema validation, finite ranges, maximum array sizes and bounded text lengths before entering risk logic.
7. **Privacy is a runtime property.** DMS computes temporal attention state without storing raw cabin video in the assessment path; identity recognition is outside the feature boundary.
8. **Read operations must not gain actuator authority.** Navigation, AI explanation, analytics, fleet and partner capabilities cannot inherit vehicle-control permission.
9. **Degraded state is observable.** Health, freshness, runtime readiness and integration gates are visible to diagnostics and the HMI instead of being hidden behind optimistic success UI.
10. **Tests enforce safety contracts.** Unit, type, security-contract, UI-contract, production build and Chromium automotive HMI tests must pass before merge.

## Live driver-assistance runtime contract

LDW, DMS, the read-only AI assistant context and Camera 360 use a shared runtime snapshot carried with authenticated realtime telemetry. A card may display `Live` only when its runtime contract says `live`.

- **LDW:** fresh calibrated lane observations drive lateral-offset / TTLC assessment. Stale or unreliable lane models degrade or disappear instead of showing false lane confidence.
- **DMS:** temporal samples drive attentive, distracted, prolonged-distraction, suspected-drowsiness or unavailable states. Single-frame inference is not treated as a final DMS state.
- **AI assistant:** live means the read-only planner has fresh vehicle context. It does not imply free-form actuator execution or an external LLM provider is connected.
- **Camera 360:** live requires at least four synchronized, calibrated native camera observations within reprojection-error limits. Visualization never grants parking or steering authority.

## Startup sequence

The startup experience is intentionally short. It moves through GPS/sensor checking, route readiness, and a final `System self-check complete` state before handing the screen to Drive. It uses CSS-rendered horizon, road perspective, route trace, and vehicle depth so the first screen feels premium without coupling the product to a heavy background image asset.

## Motion policy

Normal mode uses a restrained reveal, route trace, horizon breathing, readiness-chip transition, button press feedback, and standard view transitions. No continuous radar sweep or distracting ambient animation should be introduced. Under `prefers-reduced-motion: reduce`, the startup completes quickly and decorative animations are disabled.

## Viewport verification

Automated Chromium checks cover:

- 1366×768: startup, no horizontal clipping, primary hierarchy, minimum control sizing and runtime assistance state.
- 1920×720: wide automotive cockpit hierarchy.
- 1280×480: short landscape compaction; the secondary driver-assistance rail is removed before safety-critical information.
- Reduced Motion: startup exits quickly and avoids decorative timing dependency.
- Primary navigation interactions: Drive/Navigate/Alerts remain reachable with large controls.

## Safety boundary

All changes remain SAE Level 0 / advisory-only. They do not add control authority, actuator commands, brake/steering/throttle logic, gear/torque control, or CAN writes.
