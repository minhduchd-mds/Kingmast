# KINGMAST ECC Plan Skill

**ECC = Engineering Control & Compliance Plan.** Use this skill to turn a KINGMAST feature request into an evidence-driven implementation plan.

## Inputs
Feature, target vehicle, ODD, sensor set, data access, intended release stage and whether any actuator/control behavior is proposed.

## Procedure
1. Classify scope: HMI, data, perception, risk, ECU, cloud, security or autonomy-lab.
2. Re-state the safety boundary. If control of brake/steer/throttle is requested, stop the MVP plan and route to a new safety item review.
3. Map hazards and misuse cases; list degraded states.
4. Define data contracts including units, timestamps, confidence, validity and timeout.
5. Define deterministic acceptance criteria and scenario fixtures.
6. Map evidence to ISO 26262 / SOTIF / ISO-SAE 21434 / ISO 24089 as applicable.
7. Add cybersecurity controls: least privilege, read-only CAN gateway, secure boot, signed update, rollback, secrets isolation.
8. Add HMI checks: glanceability, parked-only interaction, redundant severity coding, reduced-motion, day/night legibility.
9. Produce traceability: hazard -> requirement -> component -> test -> artifact.
10. Define release gate: simulation -> replay -> SIL -> HIL -> closed track -> OEM readiness. Never skip directly to public-road control.

## Output template
- Scope and non-goals
- ODD assumptions
- Hazards / misuse
- Architecture impact
- Data contracts
- Safety/security controls
- HMI/motion rules
- Verification scenarios and KPIs
- Evidence artifacts
- Release gate and rollback
- Open decisions / owner
