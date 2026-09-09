# KINGMAST v0.0.7 — Route Recovery UX

KINGMAST remains a warning-only Level 0 driver-assistance HMI. Route recovery never creates steering, braking, throttle, drivetrain, gear, torque, or CAN-write authority.

## Apple-inspired automotive principles

The navigation recovery flow is designed around glanceability, explicit system state, reversibility, large touch targets, localization and a deterministic return to Drive. Recovery information must not displace current speed, posted speed limit, primary collision warnings, or the active maneuver hierarchy.

KINGMAST is an original OEM-style HMI and is not an official Apple CarPlay implementation.

## Offline navigation

- Loss of internet connectivity is shown explicitly as `Offline navigation` / `Dẫn đường ngoại tuyến` according to driver locale.
- New destination search is disabled instead of repeatedly issuing failing network requests.
- Existing route geometry can remain visible.
- Online rerouting and connected-road context pause until connectivity returns.
- Primary on-vehicle collision and vulnerable-road-user warnings remain active.
- The UI never implies that a cached route contains current closures or live traffic.
- Assistant fallback may explain locally available device state but must not invent route or road conditions while live context is unavailable.

## Cached-route recovery

When a cached route is restored after provider failure, KINGMAST labels it as cached guidance and presents a recovery card. The driver is told that the route may not contain current closures. When connectivity returns and a destination is known, `Retry route` requests fresh guidance.

## Ending guidance

Ending an active route uses an explicit reversible confirmation:

1. Driver selects the close/end-route control.
2. KINGMAST asks whether to end route guidance.
3. `Keep guidance` returns immediately without changing navigation.
4. `End guidance` clears the active destination and route.

This confirmation is intentionally lightweight and does not become a full-screen modal that obscures driving information.

## Failure hierarchy

1. Critical collision / vulnerable-road-user warning.
2. Current maneuver, speed and posted limit.
3. Offline or cached-route recovery state.
4. Secondary route intelligence and connected-road metadata.
5. Assistant/contextual explanation.

## Localization boundary

Product-owned recovery labels and actions are available in English and Vietnamese. Provider-authored road names, route instructions and external notices remain source-authored when no trusted translation exists. Localization must not change route authority or safety severity.

## Test gates

Automated UI tests verify that offline mode disables destination search while preserving the HMI, that ending cached guidance requires an explicit reversible confirmation, and that bilingual recovery surfaces preserve the same safety behavior. Target-vehicle testing must still validate provider timeouts, offline-map availability, ignition cycles, poor-connectivity transitions, and physical controls.

Historical v0.0.6 physical/HIL evidence is not promoted by this v0.0.7 UX checkpoint.
