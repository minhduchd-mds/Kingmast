# KINGMAST end-to-end telemetry latency plan — v0.0.6

## Goal

Measure the real warning-display transport path on a target vehicle computer without converting shared-CI timing into an automotive timing claim.

The measurement path is:

`edge ingress -> risk/fusion publish -> WebSocket envelope -> browser receive -> HMI state update/render observation`

## Clock discipline

End-to-end latency is meaningful only with synchronized clocks or a single monotonic timing domain. Target-controller/HIL runs must record the clock source, synchronization method, measured clock offset/error and any resynchronization event. Unsynchronized wall clocks must not be used to claim latency acceptance.

## Metrics

For each defined workload collect at least:

- p50, p95, p99 and max edge-ingress-to-browser latency;
- p50, p95, p99 and max server-envelope-to-browser latency;
- publish frequency and accepted frame count;
- dropped/rejected sequence count;
- disconnect count, reconnect attempts, successful reconnects and recovery time;
- session/boot changes and clock anomalies;
- CPU, RSS/heap, temperature and power context on target hardware;
- HMI render/update observation where instrumentation is available.

Raw traces may be retained in the physical evidence store, but runtime HMI diagnostics should expose only bounded counters/buckets.

## Qualification sequence

1. Bench smoke run with synchronized timestamps and controlled telemetry.
2. 1-hour target-controller run with normal sensor traffic.
3. 4-hour run with planned disconnect/reconnect and process restart.
4. 8-hour soak including thermal/power observation and repeated network recovery.
5. Closed-track replay of safety-relevant scenarios after the bench/HIL gates are accepted.

Acceptance budgets for the vehicle computer must be derived from the selected hardware, display stack, warning concept and safety analysis. **CI regression budgets must not be used as a vehicle timing specification or target-hardware acceptance threshold.**

## Evidence package

A claimed result must identify controller and bench, full 40-character software commit, test interval, operator, independent reviewer, network/topology revision, configuration/calibration hashes when relevant and SHA-256 references to the captured evidence.

## Boundary

This plan is warning-only Level 0. It introduces no steering, braking, throttle, gear, torque or generic CAN-write authority. CI and synthetic software recovery evidence remain non-HIL evidence.
