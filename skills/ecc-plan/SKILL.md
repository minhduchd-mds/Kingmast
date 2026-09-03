# KINGMAST ECC Plan Skill

**ECC = Engineering Control & Compliance Plan.** Use this skill to turn a KINGMAST feature request into an evidence-driven implementation plan.

## Inputs
Feature, target vehicle, ODD, sensor set, data access, intended release stage, positioning source, perception classes, storage requirements and whether any actuator/control behavior is proposed.

## Procedure
1. Classify scope: HMI, data, perception, positioning, risk, ECU, cloud, security or autonomy-lab.
2. Re-state the safety boundary. If control of brake/steer/throttle is requested, stop the MVP plan and route to a new safety item review.
3. Map hazards and misuse cases; list degraded states.
4. Define data contracts including units, timestamps, confidence, validity, timeout, coordinate reference and source provenance.
5. For GPS/GNSS features, define accuracy budget, stale-position timeout, loss-of-fix behavior, drift/spoofing response, privacy retention and offline-map behavior.
6. For object detection, define supported classes, range/bearing accuracy, confidence gates, track lifetime, duplicate suppression and vulnerable-road-user rules.
7. For projected object locations, define the acceptable position error and state explicitly that projected coordinates are warning/event context, not precision localization.
8. Define deterministic acceptance criteria and scenario fixtures.
9. Map evidence to ISO 26262 / SOTIF / ISO-SAE 21434 / ISO 24089 as applicable.
10. Add cybersecurity controls: least privilege, read-only CAN gateway, secure boot, signed update, rollback, secrets isolation and protection against malformed telemetry.
11. Add HMI checks: one primary driving surface, glanceability, parked-only interaction, redundant severity coding, reduced-motion, day/night legibility and no safety information hidden behind animation.
12. Add map checks: attribution, tile-source approval, offline fallback, no map interaction required for a critical warning and no navigation instruction that implies vehicle-control authority.
13. Produce traceability: hazard -> requirement -> component -> test -> artifact.
14. Define release gate: simulation -> replay -> SIL -> HIL -> closed track -> OEM readiness. Never skip directly to public-road control.

## V2 mandatory scenarios
- GPS unavailable at startup
- GPS accuracy degrades beyond threshold
- stale GPS timestamp
- GNSS drift or unrealistic position jump
- camera degraded while radar remains available
- radar degraded while camera remains available
- pedestrian appears in the forward sector
- bicycle or motorcycle enters a side danger zone
- lead vehicle closes rapidly
- object confidence oscillates around the alert threshold
- duplicate tracks refer to the same road user
- projected object position falls outside the configured accuracy budget
- geofence entry and exit
- map tile/network unavailable
- reduced-motion enabled

## Output template
- Scope and non-goals
- ODD assumptions
- Hazards / misuse
- Architecture impact
- Data contracts
- Positioning/perception accuracy budgets
- Safety/security controls
- HMI/motion/map rules
- Verification scenarios and KPIs
- Evidence artifacts
- Release gate and rollback
- Open decisions / owner
