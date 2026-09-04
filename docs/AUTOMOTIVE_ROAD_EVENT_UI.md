# KINGMAST v0.0.6 — Road-event HMI rules

This batch keeps the product version at `v0.0.6` and extends the warning-only HMI. It does not add steering, braking, throttle, drivetrain or CAN-write authority.

## Rules

1. Emergency-vehicle context outranks construction, SPaT and arrival presentation.
2. Construction guidance uses available lane topology; it never invents a closed lane when the provider does not identify one.
3. Preferred lanes are highlighted, while posted temporary lane-control signs remain authoritative.
4. SPaT is shown only when a route-relevant advisory exists.
5. A SPaT countdown is displayed only when the timestamp is plausibly near the local clock; otherwise the UI shows phase state without a numeric countdown.
6. Physical traffic lights remain authoritative over connected signal context.
7. Emergency context requires an approaching vehicle and minimum confidence before specialist presentation.
8. Emergency warnings remain advisory: yield safely and follow applicable local law.
9. Arrival state starts only within the final 120 m straight-line destination horizon.
10. Route-complete presentation occurs within 25 m and does not imply the vehicle has parked.
11. Road-event motion is one-shot and does not flash continuously.
12. Critical events use semantic red only for the event surface, not the whole screen.
13. Construction uses caution yellow and calm lane topology cues.
14. Positive SPaT or arrival uses green without implying autonomous permission to proceed.
15. `prefers-reduced-motion` removes decorative transitions while preserving state text and icons.
16. `prefers-contrast: more` increases border emphasis.
17. Forced-colors mode keeps event boundaries visible.
18. Auto appearance uses a local-time day/night readability profile; explicit Day/Night user settings still take precedence inside the HMI.
19. Sunlight mode increases text/background separation instead of increasing decoration.
20. Short automotive displays remove secondary event details before shrinking speed, speed limit, maneuver or primary hazard information.
