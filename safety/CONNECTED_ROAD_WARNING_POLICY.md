# Connected-road warning safety policy

KINGMAST v0.0.8 connected-road features are advisory only. Historical `V006` and prior v0.0.7 evidence remain bound to their original evidence campaigns.

## Priority
1. Existing collision-critical / vulnerable-road-user warnings.
2. Approaching emergency vehicle.
3. SPaT caution for a relevant approach.
4. Specific road hazard.
5. Construction zone.
6. School zone.
7. Highway exit guidance.
8. Lane guidance.
9. General weather context.
10. Grounded Assistant explanation.

If a collision-critical warning is active, connected-road advisories and Assistant explanation must not compete for the primary driver-attention surface.

## Prohibited behavior
- No steering, braking, throttle, torque, drivetrain or gear command.
- No CAN writes.
- No automatic lane change or emergency yielding maneuver.
- No treating public-map signal metadata as live SPaT.
- No claiming school/construction restrictions when source confidence or activity state is unknown.
- No bypassing protected V2X, traffic-control, dispatch or camera-provider authentication.
- No allowing an AI/provider response to alter alert severity, suppress an underlying warning, or create actuator authority.

## Freshness
- SPaT: 5 s maximum age.
- Emergency vehicle: 8 s maximum age.
- Weather: 15 min maximum age.
- Lane/exit topology: 30 min maximum age.
- Zone provider snapshot: 6 h maximum age unless an explicit end time expires sooner.

## Degradation
Stale or missing provider data degrades to unavailable. The HMI must keep ordinary navigation and perception warnings functional without connected-road data. Assistant output must state missing live context rather than invent road state.

## Driver wording and localization
Connected-road messages use advisory language such as `Signal ahead`, `School zone ahead`, `Road works ahead`, `Emergency vehicle approaching`, and `Verify posted signs`. Product-owned shell copy may be localized to Vietnamese, but provider-authored road/safety content remains source-authored when no trusted translation path exists. Localization must not change safety severity or vehicle-control authority.
