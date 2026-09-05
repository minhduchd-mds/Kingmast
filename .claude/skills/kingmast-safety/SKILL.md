---
name: kingmast-safety
description: Safety authority and fail-closed rules for KINGMAST. This skill should be used whenever work touches vehicle state, ADAS, edge sensors, alerts, AI actions, native bridges, CAN, ESP32 hardware, or any feature that could imply vehicle control.
user-invocable: true
---

# KINGMAST safety

## Goal

Preserve KINGMAST as a truthful SAE Level 0 warning-only system while allowing useful sensing, analysis, visualization and driver advisories.

## Workflow

1. Read `safety/SAFETY_POLICY.md` and `docs/HMI_UI_RULES_V006.md` before modifying safety-relevant behavior.
2. Identify every input, output and authority boundary changed by the task.
3. Keep all actuation out of scope: no steering, brake, throttle, gear, torque, generic CAN-write or equivalent command path.
4. Treat missing, stale, replayed, untrusted, future-skewed or low-confidence input as degraded/unavailable.
5. Keep sensor ingress, viewer APIs, AI tools and native bridges least-privileged and separately authenticated where applicable.
6. Preserve explicit freshness timestamps, bounded schemas and replay resistance for realtime data.
7. Preserve privacy: DMS assessment must not require raw cabin-video retention or identity recognition.
8. Make safety state observable in diagnostics and HMI; never hide degraded state behind optimistic UI.
9. Add or update tests that prove the boundary, not only the happy path.
10. Run `pnpm safety:boundary`, `pnpm skills:validate`, typecheck, tests and relevant UI tests before completion.

## Completion criteria

A change is not complete if wording, API shape, UI state or documentation could reasonably make a staged/read-only capability look like vehicle control or validated hardware integration.
