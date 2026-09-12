---
name: kingmast-hmi-uiux
description: Production frontend workflow for KINGMAST automotive HMI. Use for cockpit screens, navigation, alerts, surround visualization, ESP32 bench integration, right-side context panels, accessibility, motion, responsive automotive layouts, and visual-system changes.
user-invocable: true
---

# KINGMAST HMI UI/UX — Frontend Skill

## Mission

Build an original premium automotive cockpit UI for KINGMAST: dark, precise, high-contrast, information-rich, visually sharp and motion-rich without becoming an admin dashboard. The driver must understand speed, route, hazard, TTC, sensor health and degraded state at a glance.

KINGMAST remains SAE Level 0 / warning-only. This skill never grants steering, braking, throttle, gear, torque or CAN-write authority.

## Always load with

- `kingmast-safety` when the change touches telemetry, sensors, warnings, ADAS state or ESP32 hardware.
- `kingmast-quality` before completion when code/tests are changed.

## Required source-of-truth reading

1. Read `CLAUDE.md`.
2. Read `docs/HMI_UI_RULES_V006.md`, `docs/APPLE_HMI_ENGINEERING_RULES.md` and `docs/AUTOMOTIVE_MOTION_RULES.md` when relevant.
3. Inspect the current component, CSS, contracts and tests before changing UI architecture.
4. Reuse established `TelemetryFrame`, sensor health, realtime events and existing KINGMAST assets instead of inventing parallel state.

## Workflow

### Flow 1 — Audit before coding

- Capture current layout hierarchy and identify the exact screen being changed.
- List the live inputs: speed, limit, objects, TTC, sensors, route, device connection, alerts.
- Identify which values are simulated versus runtime-proven.
- Locate reusable assets under `apps/hmi/public/assets/kingmast/`.
- Do not start by replacing everything blindly; preserve working telemetry and contracts.

### Flow 2 — Establish cockpit hierarchy

Attention order is:
1. critical hazard / maneuver,
2. speed and speed limit,
3. object distance / TTC,
4. route guidance,
5. sensor/device health,
6. secondary trip/energy information.

One primary warning owns attention. When danger increases, de-emphasize map and secondary cards before shrinking critical information.

### Flow 3 — Build the six-region shell

Required regions:
- top bar,
- left navigation rail,
- vehicle status column,
- central drive/surround canvas,
- right context/quick-info panel,
- bottom action dock with SOS and AI.

Reference desktop geometry:
- top bar: ~72 px,
- left rail: ~160 px,
- vehicle status: ~280 px,
- center drive canvas: flexible and largest,
- right context panel: ~420 px,
- bottom dock: ~84 px.

Base spacing: 8 / 12 / 16 / 20 / 24 px.
Card radius: 16 px. Large panel radius: 18–20 px. Chip radius: 12 px.

### Flow 4 — Apply visual tokens

Core colors:
- background `#07111F`
- surface `#0D1B2E`
- elevated surface `#10233B`
- primary blue `#1EA7FF`
- cyan glow `#4FE4FF`
- success `#1FE38A`
- warning `#FFC247`
- danger `#FF4D57`
- primary text `#F5F8FF`
- secondary text `#9AB1C9`
- muted text `rgba(245,248,255,.65)`

Use red only for genuine danger. Use blue/cyan for active focus and technology state. Use amber for watch/caution. Do not make every card glow.

Typography target:
- primary speed: 72–96 / 700,
- large warning: 36–44 / 700,
- card title: 20–24 / 600,
- main content: 15–16 / 500,
- supporting content: 12–13 / 400,
- captions: 10–11 / 400.

Preferred font stack: Inter / SF Pro Display / Segoe UI / system sans-serif.

### Flow 5 — Build each region completely

#### Top bar
Must support KINGMAST brand, current route/location, weather/context, GPS, network, cloud/device status and clock. Use dark glass, thin blue border and subtle glow.

#### Left navigation
Required primary destinations: Drive, Navigate, Alerts, Camera, Objects, Trip, Energy, Vehicle, Settings. Active item uses blue glow. Inactive items stay calm. Alert count uses red badge. Keep a separated KINGMAST AI/system status block at the bottom.

#### Vehicle status column
Must include:
- large speed gauge,
- speed-limit sign,
- PRND with current gear,
- READY/ECO state,
- trip summary,
- sensor status list.

Do not reduce the speed gauge to a normal KPI card.

#### Central drive canvas
This is the visual focal point. Include:
- road/lane perspective,
- main vehicle,
- sensor/radar arcs,
- target/object markers,
- left/right/rear distance zones,
- 2D/3D mode,
- lane/advisory state,
- primary alert banner when needed.

If no photographic road asset exists, build depth with CSS/SVG gradients, lane geometry, glow and overlays rather than inserting random stock art.

#### Right context panel
Use progressive disclosure. Include navigation/map at top, then quick tabs:
- Objects,
- Device,
- Alerts,
- Energy.

Panels must support hide, collapse, expand and pin. Switching tabs must preserve important safety state. Diagnostics are hidden by default.

Object list rows should expose type, distance, relative speed and semantic status. Device view should expose ESP32-C3/edge status, endpoint, latency/freshness and live/offline truth.

#### Bottom dock
Required actions: Voice, Camera, Record, Capture, Night mode. SOS is visually separate and red. AI assistant is separate on the far right. Active controls use a controlled cyan glow.

### Flow 6 — State behavior

#### SAFE
- no large hazard banner,
- route remains prominent,
- object highlighting stays subtle.

#### WATCH
- blue/cyan object emphasis,
- object panel becomes more prominent,
- no alarming red treatment.

#### WARNING
- amber/red caution surface,
- increase TTC and distance prominence,
- map starts losing visual priority.

#### DANGER
- one large red alert banner,
- front target is visually dominant,
- TTC and distance become primary,
- secondary route content is dimmed,
- danger pulse may run at 1.2 s.

#### SENSOR_LOST / degraded sensing
- show degraded-sensing state explicitly,
- automatically prioritize Device/Sensor context,
- never display stale distance/TTC as if healthy,
- unavailable values become `--` or explicit unavailable text.

#### OFFLINE / stale
- show truthful connectivity degradation,
- never synthesize `LIVE`, `READY` or healthy sensors just for visual continuity.

### Flow 7 — Motion and effects

Required motion vocabulary:
- active-tab glow,
- radar pulse,
- warning pulse,
- map focus transition,
- button hover/press,
- panel expand/collapse.

Timing:
- standard transition 220–300 ms ease-out,
- hover 150–200 ms,
- card expand/collapse ~240 ms ease,
- danger pulse 1.2 s,
- radar loop ~2.2 s linear.

Rules:
- glow only for active/critical elements,
- motion must never reduce legibility,
- respect `prefers-reduced-motion`,
- use transforms/opacity where possible for performance.

### Flow 8 — Component architecture

Prefer explicit components:
- `TopBar`
- `Sidebar`
- `VehicleStatusPanel`
- `DriveCanvas`
- `AlertBanner`
- `NavigationMapPanel`
- `QuickInfoTabs`
- `ObjectListPanel`
- `DeviceStatusPanel`
- `BottomDock`
- `SOSButton`
- `AIAssistantButton`

Keep state derivation separate from presentation. Do not build a second telemetry model when `TelemetryFrame` already exists.

### Flow 9 — Asset handling

- Reuse transparent KINGMAST vehicle/icon assets where available.
- Preserve aspect ratio.
- Transparent PNG edges must remain clean.
- Do not fake transparency by placing black rectangles behind assets.
- Decorative/generated assets must not carry runtime truth; runtime labels and status remain code-driven.

### Flow 10 — Responsive rules

Primary targets: 1366×768, 1440×900, 1920×720 and 1280×480.
- Center drive region remains the visual priority.
- Right panels may collapse before critical drive information shrinks.
- Sidebar may compact on constrained widths.
- Never allow critical text overlap, clipped TTC, or broken warning banners.
- Wide screens gain breathing room, not extra clutter.

### Flow 11 — Accessibility and driver usability

- Primary touch targets should target 52 px where practical.
- Keep visible keyboard focus.
- State must be expressed by text/icon plus color, not color alone.
- Use sufficient contrast for night UI.
- Keep driver copy short and direct.
- Respect reduced motion and high contrast modes.

### Flow 12 — Verification before completion

Before declaring complete:
1. run typecheck,
2. run HMI/UI contract checks,
3. run relevant Playwright tests,
4. run safety boundary checks if telemetry/warnings changed,
5. inspect 1366×768 and at least one wide layout,
6. verify SAFE, WATCH, WARNING, DANGER, SENSOR_LOST and offline states,
7. verify hide/collapse/pin behavior of right panels,
8. verify no runtime-unproven feature is labeled LIVE.

## Implementation guardrails

- Do not turn KINGMAST into a generic admin dashboard.
- Do not use a white-dominant driving screen.
- Do not remove radar/glow/warning depth merely to make the code simpler.
- Do not replace detailed cockpit hierarchy with a collection of equal KPI cards.
- Do not make the right panel permanently rigid; it must be context-adaptive.
- Do not show more than two alerts competing at the same priority.
- Do not change established product copy, colors or contracts without reason.
- Do not add actuator authority.

## Completion definition

The implementation is complete only when it is visually recognisable as the KINGMAST cockpit: premium dark automotive HMI, sharp hierarchy, rich but disciplined effects, full detail, dynamic right-side context, clear danger/degraded states, responsive layout, and clean reusable frontend components.