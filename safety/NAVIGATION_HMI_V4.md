# Navigation HMI V2.4 safety constraints

- Driver-facing navigation is advisory only.
- Map, route, camera and speed-limit data never create actuator authority.
- Collision-critical warnings outrank navigation, camera and overspeed notices.
- Destination editing is blocked while a real vehicle source is moving at or above 5 km/h.
- A single GNSS deviation sample cannot trigger rerouting; sustained deviation is required.
- Rerouting uses a cooldown to prevent repeated network requests and driver-facing churn.
- Camera warnings require active-route relevance and use travel-direction metadata when available.
- Public/authorized camera coverage is explicitly non-exhaustive.
- Cached routes are labeled as cached guidance and expire after a short interval.
- Voice prompts are optional, short, deduplicated and can be muted with one large control.
- Advisory lane hints are inferred from route maneuvers and must not be presented as lane-level perception.
- Posted roadside signs remain the authority when map/sign-vision context is missing, stale or conflicting.
- Auto/Day/Night themes require physical-display validation before vehicle deployment.
- Reduced-motion mode must not remove safety state changes; it only removes nonessential animation.
