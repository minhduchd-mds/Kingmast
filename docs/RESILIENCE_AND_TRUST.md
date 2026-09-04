# KINGMAST v0.0.6 — Runtime Resilience and Trust

KINGMAST remains warning-only SAE Level 0. This batch hardens the driver HMI around lifecycle recovery, sensor capability loss, connected-road provider trust and unit restoration without adding steering, braking, throttle, drivetrain, gear, torque or CAN-write authority.

## Runtime lifecycle

- A native host may expose `window.kingmastNative.lifecycle.getState()` and an optional `subscribe()` callback.
- Native lifecycle state can report ignition `off`, `accessory`, `on` or `unknown` and UI phase `active`, `sleeping`, `waking` or `recovering`.
- Browser-only preview never guesses ignition state; it reports host-managed / unknown ignition.
- Visibility sleep/wake and persisted-page restoration are handled without claiming that vehicle sensors or native safety services are ready.
- Crash/watchdog/power recovery restores the HMI independently from live telemetry. Cached route and preferences must never be treated as proof of live sensor readiness.

## Sensor capability loss

The driver HMI derives a non-dismissible capability notice from the live `SensorHealth` frame. A forward radar/camera loss, rear radar loss, positioning loss, CAN loss or safety-ECU loss explicitly describes which warning capability may be reduced or unavailable. KINGMAST does not claim that a warning remains available when its required sensing path is unavailable.

Critical road/object alerts retain display priority. Sensor-loss presentation is a separate capability warning and does not create a control command or hide an active collision warning.

## Connected-road / V2X trust

`ConnectedRoadProviderSnapshot` can include provider security metadata: transport, trust status, certificate expiry, verification time and diagnostic detail.

Live data whose source is `v2x-provider` fails closed unless the provider is `verified` or explicitly `expiring` and its certificate has not expired. Missing, expired, revoked or untrusted V2X security prevents that provider's live SPaT and emergency-vehicle state from entering driver advisories. Other authorized non-V2X road context can continue independently.

`GET /connected-road/status` exposes provider health for HMI diagnostics. The HMI shows degraded trust but continues to instruct the driver to rely on physical signs, signals, emergency vehicles and direct observation. Public-map data is never promoted to live SPaT state.

## Atomic driver unit restoration

The driver profile persists Metric or Imperial preference. v0.0.6 now converts driver-facing speed and distance surfaces together:

- Drive speed and speed limit
- following gap and object distance
- navigation maneuver and remaining distance
- route options and route-intelligence distance
- camera warning distance and limit
- driver alert distance/message text
- map speed/distance summaries
- connected-road advisory and exit distance
- GNSS accuracy and charging detour distance

Internal risk, routing and sensor calculations remain in SI (`m`, `m/s`, `km/h` where existing contracts define it). Conversion is presentation-only so TTC/risk thresholds are not changed by display preference.

EV consumption configuration remains an internal `Wh/km` model in v0.0.6. It is a parked engineering parameter rather than a moving safety readout; converting that model requires a separate data-model migration rather than relabeling the same numeric value.

## Production gates

1. Map native ignition/sleep/wake semantics to the selected vehicle host and validate power-state transitions on target hardware.
2. Define watchdog, process restart and interrupted-update recovery ownership outside the browser UI.
3. Build a sensor-to-capability matrix from actual radar/camera/GNSS/ECU hardware and validate degraded combinations on a test vehicle.
4. Provision V2X trust anchors, certificate rotation, revocation and clock-integrity handling in the native/provider adapter.
5. Add signed provider-message verification where required by the selected V2X profile; transport trust alone is not equivalent to message authenticity.
6. Validate Metric/Imperial presentation on every target display and localization before production release.
7. Keep posted signs, physical signals, road conditions and driver observation authoritative over connected/map context.
