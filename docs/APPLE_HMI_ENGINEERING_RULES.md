# Apple-inspired Automotive System UI Rules

KINGMAST uses Apple Human Interface Guidelines and CarPlay interaction principles as design constraints without claiming official CarPlay compatibility.

## Product boundary

KINGMAST is a warning-only Level 0 driver-assistance HMI. The driving interface is read-only. It does not expose steering, braking, throttle, or drivetrain commands. Official CarPlay apps use Apple-provided templates and entitlements; this custom HMI is an OEM-style research interface, not an official CarPlay app.

## System-app visual language

1. **One primary driving surface.** Never present the active driving experience as six equally weighted dashboard boxes. The road situation, speed, relevant gap, TTC, and current safety instruction form one dominant surface.
2. **System chrome is quiet.** Use a stable header and a small set of persistent navigation destinations. Brand chrome must not compete with safety content.
3. **Materials, not cyberpunk decoration.** Prefer restrained translucent system materials, soft separation, large corner radii, and sparse shadows. Avoid neon frames, decorative radar grids, excessive gradients, glowing borders, and numbered panels.
4. **Automotive spatial model.** The ego vehicle, relevant lead vehicle, lane geometry, and nearby targets must read as a coherent road scene instead of independent dashboard widgets.
5. **Glance first.** Primary speed, relevant gap, TTC/THW, severity, and confidence occupy the strongest visual hierarchy and must be understandable in one glance.
6. **Upper-half priority.** Place the most important driving content and immediate safety state in the upper half of the display whenever practical.
7. **Driving means read-only UI.** History, diagnostics, calibration, privacy, retention, and configuration are available only while parked.
8. **One critical instruction.** A critical state presents one concise action such as `Slow down`. Secondary actions do not compete with it.
9. **Redundant severity semantics.** Encode severity with text, icon/shape, hierarchy, and color. Never depend on color alone.
10. **Limited palette.** Use neutral system surfaces with a small semantic palette: system blue for interactive controls, green for ready/safe, yellow for caution, and red for critical.
11. **Interaction and noninteraction are visually distinct.** Interactive elements use system-blue affordances or clear pressed states; passive telemetry does not mimic buttons.
12. **Comfortable controls.** Interactive controls target at least 44 × 44 pt and include visible pressed/focus states. While driving, minimize the number of interactive controls shown.
13. **Meaningful motion only.** Motion communicates proximity, direction, state change, or continuity. Repeated critical pulse is reserved for critical states. Avoid decorative parallax or continuous glow.
14. **Fast safety transitions.** Safety-state changes appear immediately; visual easing may complete within roughly 300 ms but must never delay the text or warning itself.
15. **Natural state transitions.** Preserve spatial context when changing sections. Use subtle opacity/position transitions rather than dramatic scene changes.
16. **Typography behaves like a system app.** Use the platform system font stack, tabular numerals for live telemetry, short labels, strong hierarchy, and no condensed display type for body information.
17. **Dark and light environments.** The HMI supports dark/night and light/day appearances and can follow ambient conditions automatically.
18. **Accessibility is a release requirement.** Support reduced motion, sufficient contrast, visible focus, non-color severity cues, and semantic live regions for critical alerts.
19. **No fake certainty.** Degraded or stale sensors lower confidence and the interface explains the limitation in plain language.
20. **Stable layout.** Telemetry values can change without moving primary controls, changing card order, or causing layout jumps.

## Information architecture

The persistent system destinations are intentionally small:

- **Drive** — speed, current road scene, relevant gaps, TTC, and the single active safety instruction.
- **Around** — spatial proximity view for nearby vehicles and obstacles.
- **Trip** — parked-only session summary and safety events.
- **Vehicle** — sensor and integration health, with explicit warning-only capabilities.
- **Settings** — a parked-only system sheet, not another driving dashboard panel.

## Motion tokens

Use shared duration tokens rather than local arbitrary values:

- `instant`: ~80 ms — immediate visual acknowledgement.
- `quick`: ~160 ms — press, focus, icon, and semantic-color changes.
- `standard`: ~280 ms — normal state transitions.
- `emphasized`: ~420 ms — spatial telemetry interpolation and system sheets.
- ambient effects are slower and must never be required to understand safety state.

Prefer `transform` and `opacity`. Avoid large animated blur regions on production ECUs. Repeated animations must stop under `prefers-reduced-motion`.

## Code rules

- Strict TypeScript; no `any` in safety-domain code.
- Pure deterministic risk functions remain separate from rendering.
- State names use domain terms: `safe | caution | critical`, never raw color names.
- UI receives safety state; it does not recompute safety policy differently from the risk engine in production.
- No network fetch in a render path; isolate I/O behind services.
- No vehicle-control method exists in the MVP API surface.
- Driving controls and parked controls are separate components/states so parked-only behavior can be enforced centrally.
- Custom controls must expose keyboard/focus state for simulator testing and semantic roles for accessibility testing.
