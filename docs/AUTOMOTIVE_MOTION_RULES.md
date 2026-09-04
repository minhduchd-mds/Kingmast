# KINGMAST v0.0.6 — Automotive Motion & Interaction Rules

Status: development guidance for the warning-only HMI. This document does not define an official Apple CarPlay implementation. KINGMAST is an original OEM-style automotive interface inspired by Apple HIG principles such as clarity, hierarchy, restraint, accessibility, and predictable interaction.

## Motion principles

1. Motion must explain a state change, not decorate the driving screen.
2. Primary driving information must not move during theme changes.
3. Driving motion uses short durations: 160 ms fast, 240 ms standard, 320 ms emphasized.
4. Use the non-overshooting `cubic-bezier(.16,1,.3,1)` curve for emphasized transitions.
5. Caution and critical escalation may use one-shot attention motion only.
6. Continuous flashing is prohibited for warning presentation.
7. A critical warning cannot be hidden, muted, or disabled by visual preferences.
8. Speed, speed limit, maneuver, and primary hazard remain visually stable during secondary transitions.
9. Maneuver urgency uses small optical emphasis; it must not bounce continuously.
10. Camera warning emphasis increases by route-distance band: 1 km, 500 m, 300 m, immediate.
11. Acknowledging a camera warning reduces duplicate interaction prominence but keeps route context visible.
12. Route loading may use a purposeful busy indicator only while a route request is in progress.
13. Route success/failure must return a short, non-blocking status message.
14. Temporary voice mute must show duration and restore automatically.
15. Day/night changes cross-fade materials and contrast; layout geometry remains stable.
16. Action sheets enter from the driver action region and return keyboard focus to the initiating control.
17. Modal sheets contain keyboard focus until dismissed and support Escape.
18. `prefers-reduced-motion: reduce` removes animation and transition without removing information or interaction results.
19. High-contrast mode keeps explicit borders, labels, and icon/text redundancy.
20. Secondary connected-road motion must never override collision, vulnerable-road-user, or immediate hazard priority.

## Driver interaction hierarchy

The driving sequence remains:

`Maneuver → current speed → posted speed limit → primary hazard → route/camera context → secondary connected-road context`

Quick actions are intentionally limited to five high-frequency operations:

`Voice · Camera · Route · Alerts · More`

`More` is parked-only. Camera and navigation actions are advisory and do not write vehicle control commands.

## Warning transition policy

- `safe → caution`: one short upward/fade emphasis.
- `caution → critical`: one short scale/border attention cue; no repeating pulse.
- `critical → safe`: status feedback may state that road context is clear.
- Camera distance band changes may provide one non-blocking route-context notification.
- Critical warning content always remains readable without motion.

## Action sheet policy

Driver action sheets are modal at the UI level but non-destructive at the vehicle level. They may offer route decisions, acknowledgment, visual navigation, or temporary voice changes. They do not offer brake, steering, throttle, drivetrain, torque, or CAN-write controls.

## Verification

CI must verify:

- safety boundary check;
- TypeScript typecheck;
- unit tests;
- production build;
- Chromium Playwright HMI tests;
- 1366×768, 1920×720, and 1280×480 layout behavior;
- touch target sizing;
- dialog focus containment and Escape behavior;
- reduced-motion behavior;
- non-blocking interaction feedback.

Real-vehicle validation remains separate and must include sunlight/night readability, touch reach, vibration, network degradation, sensor staleness, and driver-distraction testing before any production claim.
