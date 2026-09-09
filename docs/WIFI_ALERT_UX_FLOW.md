# KINGMAST v0.0.7 — Wi-Fi and Alert UX Flow

KINGMAST remains a warning-only Level 0 driver-assistance HMI. This flow does not add steering, braking, throttle, drivetrain, gear, torque, or CAN-write authority.

## Design intent

The HMI follows Apple-inspired automotive principles: keep driving tasks glanceable, move setup to parked-only contexts, prefer one obvious action, preserve reversibility, report degraded states clearly, and never ask the driver to use a phone to recover from an in-vehicle error.

KINGMAST is not an official Apple CarPlay implementation. Official CarPlay apps use Apple templates, entitlements, and OEM integration.

## Optional advisory flow

1. Settings is available only while parked.
2. `Optional road advisories` controls interruptive camera, speed-camera, and connected-road advisory presentation.
3. Turning the setting off requires an explicit confirmation step.
4. Camera and speed-camera child controls are disabled while the master advisory setting is off.
5. Connected-road polling stops while optional road advisories are off.
6. A persistent status pill tells the driver that optional advisories are off.
7. Critical collision and vulnerable-road-user safety warnings remain available and cannot be disabled by this setting.
8. Posted signs, traffic signals, direct road observation, and applicable law remain authoritative.

## Wi-Fi flow

Wi-Fi network selection and credential entry are parked-only.

On a native vehicle host, KINGMAST expects a host bridge at `window.kingmastNative.wifi` with these methods:

- `getState()`
- `setEnabled(enabled)`
- `scan()`
- `connect({ ssid, password? })`
- `disconnect()`

The web UI never persists a Wi-Fi password. Credentials are passed only to the native host network service for the connection attempt.

In a normal web/Vercel preview, the browser cannot control the operating system Wi-Fi radio or enumerate nearby SSIDs. KINGMAST therefore shows `Managed by host device` and does not fabricate Wi-Fi networks or pretend that browser online status is an SSID connection.

## Flow audit

The current v0.0.7 driving loop covers startup/self-check, bilingual first-run, Drive, navigation, route alternatives, active alerts, optional advisory settings, Wi-Fi host integration, parked settings, degraded connected-road state, sensor fallback, camera warning interaction, reroute interaction, voice mute, route arrival, Vietnamese Assistant/voice surfaces, and reduced-motion/high-contrast modes.

The following flows are still required before calling the UX complete for an embedded vehicle product:

1. Native target validation for location, network, microphone/voice, and diagnostic permissions.
2. Wi-Fi wrong-password, captive-portal, no-internet, reconnect, saved-network, and forget-network flows on target hardware.
3. Sensor calibration and sensor-replacement onboarding on target hardware.
4. Firmware/software update validation with parked-only install, rollback, and interrupted-update recovery.
5. Backend identity/account-level privacy deletion only when an account backend actually exists.
6. Target-display validation for locale, units, accessibility, sunlight, glare, night luminance and physical input.
7. Route provider timeout, offline-map and destination-unreachable recovery on target integrations.
8. Backend/V2X credential expiry, provider outage, stale-data, and certificate rotation messaging on authorized providers.
9. Emergency fallback when GNSS, camera, radar, or network availability changes during a trip.
10. Power-off, reboot, sleep/wake, ignition-cycle, and crash-recovery flows.
11. Legal/regional feature policy for camera warnings, data sharing, voice and connected-road services.

## UX completion gate

Do not label the embedded-vehicle HMI UX complete until every required target flow above has a success state, loading state, empty state, permission-denied state, recoverable error state, unrecoverable/degraded state, and a deterministic return path to Drive.
