---
name: kingmast-adas-runtime
description: Runtime ADAS and perception workflow for KINGMAST. This skill should be used for LDW, DMS, Camera 360, object alerts, edge perception, telemetry freshness, calibration readiness, and driver-assistance runtime status.
user-invocable: true
---

# KINGMAST ADAS runtime

## Goal

Turn perception observations into truthful driver advisories without overstating confidence, calibration or hardware integration.

## Workflow

1. Apply `kingmast-safety` together with this skill.
2. Inspect `services/risk-engine/src/driver-assist-runtime.ts`, lane/DMS modules, shared contracts and driver-capability UI before changing runtime semantics.
3. Keep producers and consumers explicit: perception produces observations; risk/runtime modules assess them; HMI presents status/advisories.
4. Preserve freshness windows and fail-closed transitions. Live state requires fresh validated observations.
5. LDW requires calibrated/reliable lane observations; stale or unreliable lane state degrades.
6. DMS uses temporal evidence rather than treating one frame as a final attention state; preserve raw-video non-retention.
7. Camera 360 readiness requires synchronized calibrated native cameras and acceptable calibration error; visualization does not imply parking control.
8. AI assistant runtime remains contextual/read-only and must reject actuator intent.
9. Keep thresholds documented and covered by deterministic tests; do not tune safety thresholds only to make a demo look better.
10. Validate end-to-end propagation from typed contract → runtime snapshot → realtime HMI state.

## Hardware truth

A software implementation can be complete while the feature remains `software-ready` or `requires-integration`. Promote capability status only after real native/hardware validation supports it.
