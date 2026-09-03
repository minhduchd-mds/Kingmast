# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The production boundary remains **warning-only Level 0 driver assistance**: speed, forward/rear gap, THW/TTC, surround awareness, GPS positioning, road-object detection, location-aware alerts, sensor health, event logging, and parked-only settings.

> Safety boundary: this repository does **not** issue steering, braking, throttle, or drivetrain commands. Vehicle adapters are read-only by design. Autonomous-driving work belongs in a separate simulation-only lab.

## V2 highlights
- Apple-inspired automotive **system app** information architecture rather than a dashboard wall.
- Free MIT-licensed **Lucide outline icons** across the HMI; vehicle functions use vehicle-specific icons.
- Drive, Map, Objects, Alerts, Trip, Vehicle and parked-only Settings surfaces.
- GNSS/device GPS positioning with heading and accuracy.
- OpenStreetMap preview basemap with KINGMAST safety markers layered on top.
- Object classes: person, car, motorcycle, bicycle, truck, bus, obstacle and unknown.
- Camera/radar object tracks projected to GPS coordinates from range + bearing.
- Location-aware pedestrian, close-vehicle, vulnerable-road-user, geofence and degraded-sensor alerts.
- PostgreSQL persistence for positions, detected objects, geofences and location alerts.
- Deterministic backend rules and tests for safety traceability.

## Product principles
- One dominant driving surface with glanceable speed, gap, TTC and the highest-priority warning.
- Critical information uses text + outline icon + shape + color, never color alone.
- Motion communicates state, direction and proximity; it never delays safety information and respects reduced-motion.
- Settings, history, calibration and retention controls are parked-only.
- Safety code is deterministic, timestamp-aware and fail-safe under degradation.
- GPS/object information provides warning and event context only; it does not create vehicle-control authority.

## Monorepo
```text
apps/hmi/                  Next.js automotive HMI simulator
services/risk-engine/      Fastify risk, GPS and location-alert API
packages/contracts/        Shared domain contracts
database/                  PostgreSQL migrations + seed
safety/                    Safety policy and traceability
skills/ecc-plan/           Engineering Control & Compliance planning skill
docs/                      Architecture, HMI, GPS/object and ECU plans
tests/scenarios/           Deterministic ADAS scenarios
autonomy-lab/              Simulation-only R&D boundary
```

## Quick start
Requires Node.js 22+, pnpm 10+, PostgreSQL 16+.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

HMI: http://localhost:3000  
Risk API: http://localhost:4000

The HMI runs with a deterministic telemetry simulator by default. In the Map view, **Use device GPS** requests browser geolocation for preview/bench testing. The UI falls back to the simulator if GPS permission is unavailable.

## V2 API
- `POST /v1/risk` — TTC/THW warning assessment.
- `POST /v2/telemetry/evaluate` — validate GPS + sensors + objects + optional geofences and return location alerts.
- `POST /v2/geo/project` — project an object coordinate from vehicle origin, bearing and range.
- `GET /v1/capabilities` — explicit control and sensing capability boundary.

## Database
Run migrations in order:

```text
database/001_init.sql
database/002_location_object_detection.sql
```

V2 adds `gps_positions`, `detected_objects`, `geofences` and `location_alerts`.

## Safety model
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only when the gap is closing. Severity combines TTC/THW, distance, confidence, closing speed and sensor-health gates. Stale/frozen data is rejected.

For GPS and road-object architecture, see `docs/KINGMAST_V2_GPS_OBJECT_DETECTION.md`.

KINGMAST is not an official Apple CarPlay app, not AEB/ACC, and not a homologated safety product.
