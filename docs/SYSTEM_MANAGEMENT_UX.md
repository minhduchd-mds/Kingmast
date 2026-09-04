# KINGMAST v0.0.6 — Parked System Management UX

KINGMAST remains warning-only Level 0. These flows add service, update, privacy, profile and accessibility management without adding steering, braking, throttle, drivetrain, gear, torque or CAN-write authority.

## Apple-inspired design rules

1. Detailed setup and service actions are parked-only.
2. Settings uses progressive disclosure: Assistance, Connectivity, Vehicle & updates, Privacy and Profile.
3. Primary driving warnings never depend on optional cloud or settings services.
4. Sensor calibration success is accepted only from the native vehicle maintenance service.
5. The web preview never fabricates calibration, replacement or hardware readiness.
6. Replacement verification never bypasses physical inspection or required recalibration.
7. Calibration actions use explicit confirmation and recoverable errors.
8. Firmware/software packages are never fetched from arbitrary URLs by the HMI web layer.
9. Installation requires a native host to verify a signed package and compatibility.
10. Install and rollback require parked state, stable power and native recovery support.
11. Interrupted-update recovery belongs to the native updater/boot slot design, not the browser UI.
12. Privacy defaults are opt-in for trip retention, location history and diagnostic upload.
13. Destructive history clearing requires confirmation and preserves safety preferences.
14. Wi-Fi passwords remain outside web UI persistence.
15. Driver profile preferences restore at startup through a root runtime.
16. Large text, high contrast and reduced motion apply independently from opening Settings.
17. Unit preference is persisted, but v0.0.6 avoids partial unit conversion: safety readouts remain metric until all driving surfaces can switch atomically.
18. Locale preference is persisted without claiming translation coverage that is not implemented.
19. Accessibility and service controls maintain large touch targets, focus-visible states, Reduced Motion and Forced Colors support.
20. Every service/update failure has a deterministic return path to the normal parked Settings screen and cannot suppress critical collision/VRU warnings.

## Native host bridges

### Sensor maintenance

The embedded host may expose `window.kingmastNative.maintenance` with `getState()`, `calibrate(sensorId)` and `verifyReplacement(sensorId)`. The host is responsible for stationary-state validation, calibration prerequisites, device identity and service logs.

### Software updates

The embedded host may expose `window.kingmastNative.updates` with `getState()`, `check()`, `download()`, `install()` and `rollback()`. The host owns signature verification, compatibility checks, power checks, rollback slots and interrupted-update recovery.

## Remaining production gates

- Validate actual radar/camera/GNSS calibration procedures against the selected hardware datasheets and OEM mounting tolerances.
- Add signed update manifest format, trust anchors, secure boot/rollback design and hardware-backed key storage.
- Wire privacy choices to the real backend retention policy once a backend/account model exists.
- Convert all safety-critical units atomically before enabling Imperial display mode.
- Complete localization before changing the runtime document language.
- Validate all flows on the target automotive display for sunlight, night luminance, glove/knob input and distraction limits.
