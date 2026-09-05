# KINGMAST HMI Benchmark — China Smart Cockpits (2026)

This note records product-design observations used to refine KINGMAST. It is a benchmark, not a visual copy specification. KINGMAST keeps an original interface, warning-only authority, and its own safety rules.

## Sources reviewed

- NIO smart cockpit / NOMI and driver-monitoring documentation.
- XPENG XOS cockpit and 2026 XOS release notes.
- Xiaomi SU7 / YU7 smart-cabin and HyperOS material.
- HUAWEI HiCar / HarmonySpace cockpit documentation.

## Patterns worth adopting

### 1. Graded warnings instead of simultaneous warnings
NIO documents multiple warning levels for driver distraction/drowsiness. The useful pattern for KINGMAST is escalation by severity, not copying the visual treatment.

KINGMAST decision:
- one primary textual driving alert owns attention;
- critical warnings pre-empt caution/status content;
- normal system readiness is not presented as a warning;
- secondary status is moved into the Alerts/Settings surfaces.

### 2. Persistent essentials, not persistent everything
XPENG keeps essential dock functions available while infotainment changes. The principle is stable access to a very small control set.

KINGMAST decision:
- retain the compact driver action dock;
- avoid adding more always-visible actions;
- keep critical safety information independent from media/settings surfaces;
- parked-only tools remain hidden/locked while moving.

### 3. Multi-screen / spatial hierarchy
Xiaomi and Huawei smart-cabin systems distribute information across central display, cluster/HUD, passenger or panoramic surfaces. The important lesson is role separation.

KINGMAST decision:
- driving screen: speed, limit, maneuver, road geometry, immediate hazard;
- secondary capability readiness: quiet/collapsed while moving;
- detailed diagnostics/history: Alerts, Vehicle and Settings while parked;
- future HUD/native-host output must receive a reduced driver-safe payload, not a mirrored desktop UI.

### 4. Voice as a low-friction channel, with arbitration
XPENG and Huawei both emphasize broad voice interaction. Voice is useful only when it does not compete with navigation or safety speech.

KINGMAST decision:
- global speech arbitration with priority;
- no narration for every speed-limit change;
- camera audio is limited to one useful preparation band;
- overspeed must persist before voice output;
- maneuver-now can pre-empt lower-priority speech;
- no actuator commands are added to the assistant.

### 5. Split-screen and contextual cards are secondary to driving focus
Huawei HarmonySpace supports split-screen layouts and contextual assistance. In KINGMAST these concepts are only suitable for parked/passenger/secondary contexts unless the information is directly useful to driving.

KINGMAST decision:
- no multi-card dashboard explosion in Drive;
- no entertainment card competes with a critical warning;
- connected-road context is a compact transient card;
- technical trust/certificate notices are deferred while moving.

## Production interaction policy

Priority order:

1. Critical collision / VRU / immediate cross-traffic / severe driver-attention event.
2. Immediate navigation maneuver and safety-relevant lane/spatial cue.
3. Caution such as persistent overspeed or relevant road hazard.
4. Noncritical connected-road context.
5. Connectivity, provider trust, calibration/readiness and other technical state.

Rules:

- Only one item from priority 1–3 is allowed to own the primary textual alert surface.
- Priority 4 is transient and visually compact.
- Priority 5 is deferred while moving unless loss of the input directly invalidates a primary safety function.
- Spatial blind-spot/lane cues may coexist because they communicate location rather than create another text notification.
- No flashing loops. Motion is one-shot, short and removed under reduced-motion preference.
- Critical warning color is reserved for critical state; normal readiness uses neutral material styling.

## Apple-inspired layer

KINGMAST also follows Apple CarPlay/HIG principles where they fit an original automotive HMI:

- glanceable, high-value information;
- minimal interaction while driving;
- primary content visually dominant;
- limited color palette;
- large touch targets;
- consistent hierarchy across screen sizes;
- reduced motion and high-contrast support.

KINGMAST does not claim to implement Apple CarPlay templates and does not copy Apple proprietary UI assets.

## What this benchmark changed in code

- moving assist rail collapses normal LDW/DMS/AI/360 readiness;
- at most two attention-relevant assist states remain visible;
- far camera chips are suppressed from the Drive surface;
- safe status is rendered as quiet state, not a warning card;
- critical warnings suppress secondary textual cards;
- noncritical sensor degradation becomes compact;
- connected-road HUD becomes a compact transient card;
- V2X certificate/trust notices are deferred while moving;
- voice output is serialized by priority with a global minimum gap;
- overspeed voice requires persistence;
- speed-limit changes remain visual rather than spoken.
