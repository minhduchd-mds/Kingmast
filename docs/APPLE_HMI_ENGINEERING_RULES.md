# Apple-inspired Automotive HMI Engineering Rules

KINGMAST borrows interaction qualities from Apple HIG/CarPlay without claiming official CarPlay compatibility.

1. **Glance first.** Primary speed, relevant gap, TTC/THW, severity and confidence occupy the strongest visual hierarchy.
2. **Driving means read-only UI.** No history browsing, calibration, retention changes or multi-step configuration while moving.
3. **One critical action sentence.** Critical overlays say what the driver should do; no secondary buttons compete for attention.
4. **Redundant semantics.** Encode severity with text, icon/shape, hierarchy and color. Never use color alone.
5. **Motion has meaning.** Use directional flow for closing objects, a restrained pulse for critical state, and state transitions under 300 ms. No decorative parallax in the driving view.
6. **Respect accessibility.** `prefers-reduced-motion` disables repeated motion. Maintain legible type at automotive viewing distance and sufficient contrast.
7. **Stable layout.** Numbers may change, but primary controls and labels do not jump position.
8. **Environment aware.** Dark/light adaptation should be automatic and validated for daylight, night, reflections and tinted glass.
9. **No fake certainty.** Degraded sensors reduce confidence and the UI says why.
10. **Platform boundary.** Do not market this web HMI as an Apple CarPlay application. Official CarPlay categories/templates/entitlements and OEM integration are separate work.

## Code rules
- Strict TypeScript; no `any` in safety domain code.
- Pure deterministic risk functions separated from rendering.
- State names are domain terms: `safe | caution | critical`, never raw color names.
- Animations must be CSS-transform/opacity based where possible and have reduced-motion fallbacks.
- No network fetch in a render path; isolate I/O behind services.
- No vehicle-control method exists in the MVP API surface.
