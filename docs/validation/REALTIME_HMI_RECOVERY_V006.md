# KINGMAST realtime HMI recovery evidence — v0.0.6

## Scope

This evidence layer closes a software-observability gap between edge publication and the driver HMI. The browser client and deterministic recovery runner share `RealtimeLinkAccumulator`, a fixed-cardinality accumulator for connection epochs, reconnects, session changes, same-session sequence regressions, malformed messages, clock anomalies and bounded latency buckets.

The HMI observes two timing intervals when timestamps are available:

- server envelope timestamp -> browser receive timestamp;
- last edge ingress timestamp -> browser receive timestamp.

Only counters, last/max values and fixed latency buckets are retained. There is no unbounded per-frame latency history.

## Recovery semantics

A sequence regression within the same `deviceId:bootId` session is rejected. A sequence reset is accepted only after the boot/session identity changes. Reconnect attempts use bounded exponential backoff with jitter and the driver HMI continues to distinguish live, stale and offline states.

Two software evidence levels run in CI:

1. a deterministic accumulator-level recovery scenario that proves reconnect/session/sequence invariants; and
2. a loopback process integration that starts the real Fastify risk engine, connects to `/v3/stream`, sends a real `/v3/edge/frame`, confirms same-boot sequence regression rejection, restarts the process, reconnects and verifies a new-boot sequence reset plus telemetry delivery.

The loopback layer measures the real server ingress/WebSocket path on the CI host, but it still does not include a vehicle network, production controller or browser render pipeline.

These reports are **not a physical HIL result** and they do not qualify target hardware. They also do not establish a vehicle timing budget.

## Physical evidence still required

HIL-011 and target-controller qualification still require real controller identity, network topology, software commit, configuration/calibration hashes where applicable, restart/reconnect traces, 1 h / 4 h / 8 h soak evidence, CPU/memory/thermal/power observations, sensor I/O behavior and independent review. A synthetic or loopback CI report cannot satisfy those requirements.

## Safety and privacy boundary

Realtime health data is observability-only and must never become an input to steering, braking, throttle, gear or torque. The snapshot contains no raw camera frames, cabin video, full route history, credentials or private keys. KINGMAST remains warning-only Level 0 with `controlAuthority: none`.
