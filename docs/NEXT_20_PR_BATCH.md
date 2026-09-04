# KINGMAST Next 20 PR Batch — V2.1 Edge Reliability

This batch deliberately combines twenty PR-equivalent upgrades into one reviewed commit/push to `main`. The vehicle-control boundary remains warning-only with no brake, steering, throttle or drivetrain authority.

1. **Edge protocol versioning** — protocol v1 is explicit in every ESP32 frame.
2. **Boot-session identity** — each ESP32 boot emits a unique `bootId` so sequence reset is distinguishable from replay.
3. **Replay protection** — backend rejects non-increasing sequence numbers inside the same device/boot session.
4. **Wall-clock validation** — backend rejects excessive packet clock skew and clock regression.
5. **NTP epoch time on ESP32** — edge timestamps now use Unix epoch milliseconds rather than MCU uptime.
6. **GNSS quality gating** — accuracy and age drive `ok / degraded / unavailable` state without suppressing non-location safety warnings.
7. **Sensor freshness gating** — stale radar/camera frames become unavailable instead of being reused.
8. **Fusion provenance** — every fused object can report `radar-camera`, `radar-only`, or `camera-only` provenance.
9. **Stable alert identity** — alert keys no longer change every sensor frame.
10. **Alert hysteresis** — short dropouts and immediate critical→caution oscillation are held briefly to reduce HMI flicker.
11. **Edge event ring buffer** — alert transitions are deduplicated and retained in a bounded in-memory event history.
12. **Diagnostics API** — `/v3/diagnostics` exposes source ages, stream clients, rejected packets and edge session state.
13. **Event history API** — `/v3/events` exposes recent warning transitions with optional severity filter.
14. **Runtime geofence API** — `/v3/geofences` supports read and authenticated replacement of the active geofence set.
15. **Optional edge ingestion authentication** — `KINGMAST_EDGE_TOKEN` protects ESP32/camera/radar ingestion when configured.
16. **WebSocket heartbeat** — one-second heartbeat distinguishes a connected stream from stale telemetry.
17. **HMI reconnect hardening** — online/offline handling plus exponential reconnect with jitter.
18. **HMI sequence/session guard** — regressing frames are ignored unless a new edge boot session is observed; Vehicle view exposes stream quality and diagnostics.
19. **Edge publisher hardening** — ESP32 adds radar freshness, HTTP retry/status handling and auth; camera publisher adds retry, auth, confidence and max-detection controls.
20. **CI safety gates** — Python syntax check plus a source scan that fails if actuator command APIs are introduced into edge/service code.

## Verification

The normal GitHub CI must pass `safety:boundary`, Python syntax, TypeScript typecheck, Vitest, and production build. New unit tests cover packet replay/clock rejection, GNSS/sensor freshness, alert stabilization and event deduplication.

## Persistence follow-up

`database/003_edge_operations.sql` adds schemas for edge sessions, ingress audit evidence and stable alert transitions. Runtime DB persistence is intentionally kept separate from this warning-only reliability batch so a database outage cannot become a dependency of the live warning path.
