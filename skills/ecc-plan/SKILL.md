# KINGMAST ECC Plan Skill

**ECC = Engineering Control & Compliance Plan.** Use this skill to turn a KINGMAST feature request into an evidence-driven implementation plan.

## Inputs
Feature, target vehicle, ODD, sensor set, data access, intended release stage, positioning source, perception classes, storage requirements, connected-road provider assumptions and whether any actuator/control behavior is proposed.

## Procedure
1. Classify scope: HMI, data, perception, positioning, risk, ECU, connected-road/V2X, cloud, security or autonomy-lab.
2. Re-state the safety boundary. If control of brake/steer/throttle is requested, stop the MVP plan and route to a new safety item review.
3. Map hazards and misuse cases; list degraded states.
4. Define data contracts including units, timestamps, confidence, validity, timeout, coordinate reference and source provenance.
5. For GPS/GNSS features, define accuracy budget, stale-position timeout, loss-of-fix behavior, drift/spoofing response, privacy retention and offline-map behavior.
6. For object detection, define supported classes, range/bearing accuracy, confidence gates, track lifetime, duplicate suppression and vulnerable-road-user rules.
7. For projected object locations, define the acceptable position error and state explicitly that projected coordinates are warning/event context, not precision localization.
8. For V2X/SPaT, define provider identity, message profile, signal-group mapping, approach relevance, clock source, freshness budget, confidence, unavailable state and explicit proof that map metadata cannot masquerade as live signal state.
9. For school/construction zones, require an activity state or validated schedule/source; never infer a regulatory restriction solely from a nearby POI.
10. For weather/road-hazard context, define source age, hazard expiry, location uncertainty, duplicate suppression and the hierarchy between a generic weather notice and a specific road hazard.
11. For emergency-vehicle context, define provenance, approach/recede logic, stale timeout, privacy boundaries and wording that advises yielding without commanding a maneuver.
12. For lane topology/highway exits, define lane-index convention, driving side, route-to-lane matching, source confidence, topology expiry and degradation to ordinary turn-by-turn navigation.
13. Define deterministic acceptance criteria and scenario fixtures.
14. Map evidence to ISO 26262 / SOTIF / ISO-SAE 21434 / ISO 24089 as applicable.
15. Add cybersecurity controls: least privilege, read-only CAN gateway, secure boot, signed update, rollback, secrets isolation and protection against malformed telemetry/provider payloads.
16. Add HMI checks: one primary driving surface, glanceability, parked-only interaction, redundant severity coding, reduced-motion, day/night legibility and no safety information hidden behind animation.
17. Add map checks: attribution, tile-source approval, offline fallback, no map interaction required for a critical warning and no navigation instruction that implies vehicle-control authority.
18. Add alert-arbitration checks: collision-critical perception warnings must preempt connected-road notices; deduplicate repeated context; cap simultaneous driver advisories; record suppression reason for diagnostics.
19. Produce traceability: hazard -> requirement -> component -> test -> artifact.
20. Define release gate: simulation -> replay -> SIL -> HIL -> closed track -> OEM readiness. Never skip directly to public-road control.

## Mandatory scenarios
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
- SPaT provider unavailable
- SPaT timestamp stale or clock-skewed
- SPaT approach heading does not match the vehicle approach
- red SPaT arrives while a collision-critical warning is active
- school-zone activity window starts/ends
- construction-zone provider sends duplicate or conflicting zones
- heavy rain plus a specific flooding hazard: flooding must outrank generic weather
- emergency vehicle transitions approaching -> receding
- emergency-vehicle message becomes stale
- lane topology lane count conflicts with route guidance
- highway-exit topology is missing or stale
- connected-road provider payload fails authentication or validation
- more than three connected-road advisories compete for driver attention

## Output template
- Scope and non-goals
- ODD assumptions
- Hazards / misuse
- Architecture impact
- Data contracts
- Positioning/perception/connected-road accuracy and freshness budgets
- Safety/security controls
- HMI/motion/map/alert-arbitration rules
- Verification scenarios and KPIs
- Evidence artifacts
- Release gate and rollback
- Open decisions / owner
