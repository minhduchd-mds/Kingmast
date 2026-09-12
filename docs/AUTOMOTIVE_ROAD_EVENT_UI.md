# KINGMAST v0.0.8 — Road-event HMI rules

This document is part of the active `v0.0.8` software checkpoint and extends the warning-only HMI. It does not add steering, braking, throttle, drivetrain or CAN-write authority.

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
21. Product-owned road-event shell copy may be localized to Vietnamese, but provider-authored event text must remain source-authored unless a trusted translation path exists.
22. Assistant explanations may reference a grounded road event but must not alter its severity, dismiss the underlying warning, or claim vehicle-control authority.

Historical `V006` evidence remains bound to the v0.0.6 evidence cycle; these v0.0.8 HMI rules do not imply new physical validation.
