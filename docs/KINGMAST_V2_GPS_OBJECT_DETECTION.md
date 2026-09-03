# KINGMAST V2 — GPS, Object Detection and Automotive HMI

## Product boundary

KINGMAST V2 remains a **warning-only ADAS product**. It may read vehicle telemetry and sensing inputs, calculate risk, project object positions, render map alerts and store safety events. It does not command braking, steering, throttle or other actuation.

## V2 HMI information architecture

The HMI is organized as a system application rather than a dashboard wall:

- **Drive** — one primary driving surface with speed, road model, lead object, gap, TTC and the single highest-priority warning.
- **Map** — live vehicle GPS/GNSS position with nearby detected objects and location-aware alerts.
- **Objects** — tracked person, car, motorcycle, bicycle, truck, bus, obstacle and unknown-object cards with distance, bearing, confidence and projected coordinates.
- **Alerts** — prioritized warnings with severity, message, distance and map position.
- **Trip** — route context and safety-event timeline.
- **Vehicle** — sensor health and explicit warning-only capability boundary.
- **Settings** — parked-only configuration sheet.

## Icon system

The UI uses the free MIT-licensed **Lucide** outline icon set. Vehicle concepts use vehicle-specific outline icons such as `CarFront`, `Truck` and `BusFront`. Other concepts use matching outline icons for map, GPS, radar, camera, alerts, settings and sensor health.

Rules:

1. Do not mix filled and outline icon families.
2. Keep the default stroke light enough to remain calm on an automotive display.
3. Use icon + text for safety states; never rely on color alone.
4. Vehicle markers must visually read as vehicles rather than generic dots.

## GPS positioning

The HMI supports two sources:

- `gnss` / `simulator` for the development pipeline.
- `device-gps` through the browser Geolocation API for preview and bench testing.

`VehiclePosition` carries latitude, longitude, speed, heading, accuracy, timestamp and source.

The map view uses OpenStreetMap's embed surface for the preview basemap. Safety markers are rendered by KINGMAST on top of the basemap. Production deployments should use an approved commercial or self-hosted tile service with an offline strategy appropriate to the target ECU.

## Object geolocation

A tracked road object contains:

- class (`person`, `car`, `motorcycle`, `bicycle`, `truck`, `bus`, `obstacle`, `unknown`)
- confidence
- distance
- absolute bearing
- relative zone
- relative speed
- semantic severity
- projected GPS coordinate

The projected coordinate is calculated from the vehicle coordinate, object bearing and range using a spherical Earth projection. This is location context for driver alerts and event logging; it is not a substitute for a high-precision localization stack.

## Alert rules

Initial V2 rules intentionally remain deterministic and inspectable:

- pedestrian in the forward sector within 22 m → caution; within 10 m → critical
- vehicle in the forward sector within 16 m → caution; within 8 m → critical
- vulnerable road user within 12 m → caution; within 6 m → critical
- critical object inside the immediate danger zone → critical alert
- active geofence entry → configured caution or critical alert
- degraded sensor → caution with reduced-confidence explanation

Every alert includes a GPS coordinate and timestamp.

## Backend endpoints

### `POST /v2/telemetry/evaluate`

Validates a vehicle position, sensor health, detected objects and optional geofences. Returns prioritized location alerts while retaining `controlAuthority: none`.

### `POST /v2/geo/project`

Projects a point from origin + bearing + distance. Intended for tests and integration tooling.

### `GET /v1/capabilities`

Explicitly reports:

- vehicle control: false
- CAN write: false
- brake: false
- steer: false
- throttle: false
- GPS positioning: true
- object detection: true
- geofence alerts: true
- map alerts: true

## Database

Migration `database/002_location_object_detection.sql` adds:

- `gps_positions`
- `detected_objects`
- `geofences`
- `location_alerts`

All tables retain trip linkage and timestamps for safety traceability.

## Apple-inspired automotive UI rules

KINGMAST applies Apple-style system-app principles without claiming to be an official CarPlay application:

- one dominant driving surface
- clear hierarchy before decoration
- large glanceable values
- calm translucent system materials
- short warning copy
- minimum interaction while moving
- parked-only configuration
- semantic safe / caution / critical state model
- restrained motion used only for state, direction and proximity
- reduced-motion accessibility support
- high contrast and icon + text redundancy

## Integration sequence

1. Use V2 simulator and CI for UI/risk validation.
2. Attach real GNSS/IMU input on bench.
3. Attach camera/radar object tracks with timestamps.
4. Calibrate object bearing/range against the vehicle frame.
5. Compare projected object positions against test-track ground truth.
6. Store GPS/object/alert rows in PostgreSQL.
7. Run fault injection for GNSS loss, camera loss, radar loss and timestamp drift.
8. Promote only after safety evidence is reviewed through the ECC plan.
