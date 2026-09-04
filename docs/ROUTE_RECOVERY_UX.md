# KINGMAST v0.0.6 — Route Recovery UX

KINGMAST remains a warning-only Level 0 driver-assistance HMI. Route recovery never creates steering, braking, throttle, drivetrain, gear, torque, or CAN-write authority.

## Apple-inspired automotive principles

The navigation recovery flow is designed around glanceability, explicit system state, reversibility, large touch targets, and a deterministic return to Drive. Recovery information must not displace current speed, posted speed limit, primary collision warnings, or the active maneuver hierarchy.

KINGMAST is an original OEM-style HMI and is not an official Apple CarPlay implementation.

## Offline navigation

- Loss of internet connectivity is shown explicitly as `Offline navigation`.
- New destination search is disabled instead of repeatedly issuing failing network requests.
- Existing route geometry can remain visible.
- Online rerouting and connected-road context pause until connectivity returns.
- Primary on-vehicle collision and vulnerable-road-user warnings remain active.
- The UI never implies that a cached route contains current closures or live traffic.

## Cached-route recovery

When a cached route is restored after provider failure, KINGMAST labels it `Cached route` and presents a recovery card. The driver is told that the route may not contain current closures. When connectivity returns and a destination is known, `Retry route` requests fresh guidance.

## Ending guidance

Ending an active route uses an explicit reversible confirmation:

1. Driver selects the close/end-route control.
2. KINGMAST asks `End route guidance?`.
3. `Keep guidance` returns immediately without changing navigation.
4. `End guidance` clears the active destination and route.

This confirmation is intentionally lightweight and does not become a full-screen modal that obscures driving information.

## Failure hierarchy

1. Critical collision / vulnerable-road-user warning.
2. Current maneuver, speed and posted limit.
3. Offline or cached-route recovery state.
4. Secondary route intelligence and connected-road metadata.

## Test gates

Automated UI tests verify that offline mode disables destination search while preserving the HMI, and that ending cached guidance requires an explicit reversible confirmation. Target-vehicle testing must still validate provider timeouts, offline-map availability, ignition cycles, poor-connectivity transitions, and physical controls.
