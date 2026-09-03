# KINGMAST HMI Motion System V1

This motion system exists to communicate vehicle state, direction, proximity, confidence and system transitions. It is not decorative animation.

## Motion tokens

| Token | Duration | Use |
| --- | ---: | --- |
| `instant` | 80 ms | immediate safety-state acknowledgement |
| `quick` | 160 ms | color, icon and compact state changes |
| `standard` | 280 ms | controls, numeric interpolation and sensor state |
| `emphasized` | 420 ms | proximity movement and major state transitions |
| `ambient` | 1200 ms | environment/theme adaptation only |

The TypeScript source of truth is `apps/hmi/lib/motion.ts`; matching CSS variables live in `apps/hmi/app/globals.css`.

## Driving-view rules

1. Safety information appears immediately; animation never gates or delays a warning.
2. Vehicle and target movement represents telemetry changes using position/scale interpolation.
3. Road flow communicates ego motion; it must stop when vehicle speed is zero in a production telemetry integration.
4. `safe → caution → critical` changes color, text, icon hierarchy and motion intensity together.
5. Critical pulse is reserved for the active hazard. Safe states do not continuously pulse.
6. Radar sweep is contextual system feedback; tracked targets move independently from the sweep.
7. Sensor transitions animate once when health changes. `OK` does not demand attention.
8. Charts and trip-history reveal animations are parked/non-critical content and must never compete with a live critical warning.

## Accessibility and comfort

- `prefers-reduced-motion: reduce` disables repeated movement and compresses transitions to effectively instant changes.
- Never use flashing, rapid luminance oscillation or motion that can obscure speed, TTC, distance or warning text.
- Severity always uses redundant coding: text + icon/shape + hierarchy + color.
- Numbers use tabular figures and stable containers so telemetry changes do not cause layout shift.

## Performance budget

- Target 60 FPS on the HMI simulator and automotive target hardware where supported.
- Prefer `transform` and `opacity` for repeated animations.
- Keep filters/glows restrained and limited to small warning targets.
- No layout-dependent animation loops in JavaScript.
- Numeric tweening uses `requestAnimationFrame` and cancels its frame on state change/unmount.
- Run a reduced-motion path, CPU-throttled browser test and day/night visual test before release.

## Current implemented motion

- Startup/self-check reveal.
- Staggered panel entry.
- Smooth speed, gap, TTC, rear/side-distance interpolation.
- Lead-vehicle proximity movement and scale.
- Road-flow and distance-wave direction feedback.
- Severity-aware warning copy, halo, pulse and closing chevrons.
- Radar sweep and tracked-target interpolation.
- Sensor health transition and degraded-mode banner.
- Safety-score, timeline, donut and chart reveal.
- Parked segmented controls, privacy toggle and focus/press micro-interactions.
- Automatic day/night theme with parked override.
- Global reduced-motion fallback.

## Integration boundary

The simulator currently cycles deterministic telemetry scenarios to demonstrate motion behavior. Production vehicle integration must replace that scenario source with timestamped, validated read-only telemetry. This UI does not add brake, steering, throttle or CAN-write capabilities.
