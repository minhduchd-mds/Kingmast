---
name: kingmast-hmi-uiux
description: Apple-inspired automotive HMI and UX workflow for KINGMAST. This skill should be used for driver screens, alerts, navigation, interaction hierarchy, accessibility, motion, density, responsive automotive layouts, and visual-system changes.
user-invocable: true
---

# KINGMAST HMI UI/UX

## Goal

Create original, calm, highly legible automotive UI inspired by Apple HIG principles without copying Apple layouts, assets or proprietary templates.

## Workflow

1. Read `docs/HMI_UI_RULES_V006.md`, `docs/APPLE_HMI_ENGINEERING_RULES.md` and `docs/AUTOMOTIVE_MOTION_RULES.md` when relevant.
2. Inspect the current component/CSS/test implementation before redesigning.
3. Preserve driver hierarchy: maneuver → speed → speed limit → primary hazard → secondary route context.
4. Let one primary warning own attention. Hide/de-emphasize secondary status before shrinking critical information.
5. Keep primary touch targets at 52 px where possible and never below the established compact floor; do not reduce critical text below established limits.
6. Use semantic state plus text, not color alone. Keep glass, blur, glow and motion restrained.
7. Support reduced motion, high contrast, visible focus and keyboard/assistive interaction.
8. Validate at 1366×768, 1920×720 and 1280×480; wide layouts gain breathing room, not extra clutter.
9. Never label a hardware/provider feature live unless the runtime contract proves it.
10. Update UI contract checks and Playwright regression coverage with the implementation.

## Output standard

Prefer a small number of strong surfaces, progressive disclosure, short driver-facing copy, consistent control geometry and explicit degraded/offline states.
