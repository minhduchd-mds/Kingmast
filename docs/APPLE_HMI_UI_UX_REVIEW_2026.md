# KINGMAST Apple-style HMI UI/UX Review — 2026

Status: implementation review for the warning-only KINGMAST OEM HMI. This is Apple-inspired design guidance, not an official CarPlay implementation or Apple certification.

## Executive assessment

The previous front end had solid safety intent but too much visible chrome. The dominant UX problems were density inflation, repeated safety copy, oversized utility controls, card-on-card composition, and action sheets that exposed controls unrelated to the current driver task.

### Expert score before this pass

| Area | Score | Main issue |
| --- | ---: | --- |
| Glanceability | 6/10 | Too many surfaces and repeated labels compete with the road scene. |
| Hierarchy | 6/10 | Utility/status controls often carry the same visual weight as primary driving content. |
| Spacing discipline | 5/10 | Large padding and wide cards waste horizontal automotive display area. |
| Progressive disclosure | 4/10 | Hazard sheets exposed up to four actions, including redundant route and voice controls. |
| Consistency | 7/10 | Control geometry is now normalized, but the previous scale was visually too large. |
| Safety focus | 8/10 | Warning hierarchy is strong, but secondary UI can still distract from it. |
| Accessibility | 8/10 | 44px touch floor, contrast modes and reduced motion are already enforced. |

## Design principles used

1. **Purpose first** — every visible element needs a current driver task.
2. **Glanceable content** — the road, speed, maneuver and real hazard remain visually dominant.
3. **Progressive disclosure** — secondary actions appear only after intent, and a sheet exposes at most two contextual actions.
4. **No stale context** — a hazard sheet automatically disappears when the hazard returns to safe; a camera sheet closes if the camera context disappears.
5. **Stable placement** — the top utility cluster remains predictable, but its geometry is reduced to a 44px automotive touch floor instead of oversized 52px controls.
6. **Fewer layers** — reduce card-on-card surfaces, heavy gradients, oversized shadows, repeated footer copy and fake drag affordances.
7. **Touch without visual bulk** — maintain >=44px touch targets while reducing decorative padding and container size.
8. **Driver task over configuration** — settings, parked tools and advisory controls never receive the same visual emphasis as Drive/Navigate/Alerts.

## Implemented front-end changes

### Header
- Removed the repeated `DRIVER ASSIST` eyebrow.
- Removed the visible build version from the driver-facing top bar.
- Reduced top-bar height to ~58px.
- Reduced Demo / Voice / GPS controls from the previous 148x52 visual scale to a common 124x44 scale on wide displays.
- Kept time as text, not another button-like surface.

### Sidebar
- Reduced main navigation rail from ~188px to 164px on wide screens.
- Reduced item height from 52–56px to 48px while preserving the >=44px touch floor.
- Reduced item gaps and decorative padding.
- Removed the duplicate `Navigation safety` brand subtitle.
- Parked-tool grouping remains semantically separated from primary driving navigation.

### Workspace and surfaces
- Reduced wide-screen workspace padding instead of increasing it at >=1500px.
- Reduced card gaps and surface padding.
- Reduced shadow depth so panels feel like a coherent system rather than stacked cards.
- Alerts surface is capped to a readable content width instead of stretching across an empty ultrawide canvas.

### Driver quick actions
- Converted the bottom dock from a nearly full-width bar to a compact floating toolbar capped around 880px.
- Reduced button geometry while preserving touch size.
- Kept five stable commands because they are already learned positions, but reduced their visual dominance.

### Hazard / camera sheets
- Removed the non-functional drag handle.
- Reduced sheet width from ~1180px to ~720px.
- Reduced sheet header/icon/close-button size.
- Hazard sheet now exposes at most two actions:
  - keep/close current context;
  - route options only when a route exists.
- Camera sheet now exposes only:
  - acknowledge;
  - open map.
- Removed `Mute voice` from contextual safety sheets because Voice already has a persistent dock control.
- Removed repeated safety footer copy from the sheet.
- Added stale-context closure: safe state cannot continue showing a `DRIVER ALERT` dialog.

## Spacing scale

Use only the following practical UI rhythm for new HMI work:
- micro: 4px
- compact: 6–8px
- standard: 10–12px
- section: 14–16px
- large separation: 20–24px only when changing information groups

Avoid 28–40px interior padding in driver-facing surfaces unless a large empty state or full-screen parked experience explicitly requires it.

## Control scale

- Minimum touch target: 44px
- Compact utility: 44px
- Primary navigation item: 48px
- Large driver control: 48–52px only when it is truly primary
- Icon: 17–21px for utility/navigation; 24px+ only for primary warning or spatial visualization

## Content policy

Show while driving:
- speed / legal limit;
- next maneuver;
- immediate route context;
- one dominant warning;
- spatial left/right cues in the vehicle view;
- essential Voice / Route / Alerts commands.

Do not repeat while driving:
- software version;
- generic `system ready` explanations;
- persistent explanatory safety copy already established elsewhere;
- duplicate route actions in the same sheet;
- voice mute inside an alert sheet when Voice is permanently available in the dock;
- safe-state alert dialogs;
- left/right object prose when the same spatial information is already encoded around the vehicle visualization.

## Acceptance criteria

- Wide header utility controls are equal and <=128px wide.
- Driver utility controls preserve >=44px touch height.
- Wide sidebar <=170px.
- Bottom quick-action dock <=900px on ultrawide displays.
- Hazard/camera action sheet <=740px.
- Context sheet exposes no more than two actions.
- No `Mute voice` inside contextual alert/camera sheets.
- No repeated sheet safety footer.
- No horizontal overflow at 1778x900, 1366x768 or 1280x480.
- Safe state cannot retain an open hazard sheet.

## Safety boundary

These changes are presentation and interaction-hierarchy changes only. They do not change collision thresholds, sensor interpretation, actuator authority, lane/DMS logic, realtime contracts or the warning-only Level 0 safety boundary.
