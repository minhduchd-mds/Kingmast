# KINGMAST v0.0.6 — Automotive Interaction Rules

This document defines the interaction layer for the development HMI. KINGMAST remains warning-only and does not command steering, braking, throttle, drivetrain or CAN writes.

## Driver interaction hierarchy

1. Maneuver and road guidance remain visually dominant.
2. Current speed and posted/advisory speed limit stay readable at a glance.
3. One primary hazard is surfaced before secondary connected-road context.
4. The bottom quick-action dock exposes only Voice, Camera, Route, Alerts and More.
5. Settings and detailed tools are available only while parked on real vehicle telemetry.
6. Critical collision and vulnerable-road-user alerts cannot be disabled from HMI preferences.

## Action sheets

Alert and camera interactions use a non-destructive bottom sheet. Acknowledging or closing a sheet never suppresses the underlying safety state. Reroute only calls navigation routing and never actuates the vehicle. Voice mute is temporary and visual warnings remain visible.

## Camera policy

Camera warnings are route-relevant advisory context only. Speed-camera warnings can be disabled separately because legality varies by region. The feature does not bypass private feeds or camera authentication.

## Touch and motion

Primary driving controls target at least 52 px, with the quick-action dock using 56 px controls at normal automotive viewports. Reduced-motion mode removes decorative transitions. High-contrast mode increases border clarity and control weight.

## Short displays

At 1280x480-class viewports, secondary connected-road metadata is removed before primary maneuver, speed, limit and hazard information. The quick-action dock remains available.

## Verification

Playwright verifies startup completion, quick-action routing, parked settings interaction, hazard action sheets, touch target sizing, 1366x768 / 1920x720 / 1280x480 layouts, horizontal overflow and reduced-motion startup behavior.
