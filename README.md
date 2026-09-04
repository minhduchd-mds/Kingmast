# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The production boundary remains **warning-only Level 0 driver assistance**: speed, forward/rear gap, THW/TTC, surround awareness, GPS positioning, road-object detection, navigation context, speed-limit awareness, location-aware alerts, sensor health, event logging, and parked-only settings.

> Safety boundary: this repository does **not** issue steering, braking, throttle, or drivetrain commands. Vehicle adapters are read-only by design. Autonomous-driving work belongs in a separate simulation-only lab.

## V2.2 highlights
- Apple-inspired automotive system-app HMI with free Lucide outline icons.
- Realtime ESP32/GNSS + radar + camera metadata fusion with replay/freshness protection.
- Navigation routing through an OSRM-compatible provider.
- Current speed-limit awareness from map `maxspeed` metadata plus optional high-confidence local sign recognition.
- HMI speed-limit badge, over-limit warning state and route maneuver summary.
- Nearby traffic-camera metadata from OpenStreetMap plus explicitly authorized provider registries.
- Runtime camera-provider ingest for municipal/partner integrations.
- Camera metadata is contextual only: KINGMAST does not bypass protected CCTV authentication and does not claim complete global camera coverage.
- PostgreSQL storage model for traffic-camera sources, camera metadata, speed-limit observations and navigation routes.

## Monorepo
```text
apps/hmi/                  Next.js automotive HMI
services/risk-engine/      Fastify risk, fusion, road-context and realtime API
packages/contracts/        Shared typed telemetry/navigation contracts
edge/esp32/                GNSS/radar edge publisher reference firmware
edge/camera-detector/      Object + optional speed-sign metadata publishers
database/                  PostgreSQL migrations
safety/                    Safety policy and traceability
skills/ecc-plan/           Engineering Control & Compliance planning skill
docs/                      Architecture, HMI, navigation, GPS/object and ECU plans
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

The HMI falls back to a deterministic simulator when the edge WebSocket is unavailable. **Use device GPS** requests browser geolocation for bench/mobile preview only.

## Realtime and road-context API
- `POST /v3/edge/frame` — authenticated protocol-v1 ESP32 packet.
- `POST /v3/perception/radar` — radar tracks.
- `POST /v3/perception/camera` — camera class/bearing metadata; raw frames are not uploaded.
- `GET /v3/stream` — HMI WebSocket telemetry + heartbeat.
- `GET /v3/diagnostics` — edge source ages, clients and rejected-packet count.
- `GET /v3/events` — recent stable warning transitions.
- `GET /v4/road-context` — current mapped speed limit + nearby authorized/public traffic-camera metadata.
- `POST /v4/navigation/route` — OSRM-compatible route calculation.
- `POST /v4/perception/speed-sign` — authenticated high-confidence sign observation.
- `POST /v4/road-context/cameras` — authenticated provider camera registry ingest.
- `GET /v1/capabilities` — explicit warning-only capability boundary.

## Database
Run migrations in order:
```text
database/001_init.sql
database/002_location_object_detection.sql
database/003_edge_operations.sql
database/004_navigation_speed_context.sql
```

## Safety model
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only when the gap is closing. Safety decisions are timestamp/confidence aware; stale camera/radar/GNSS inputs are degraded or rejected. GPS, navigation, map speed limits and camera context never create vehicle-control authority.

See `docs/NAVIGATION_SPEED_LIMIT_CAMERAS.md` for V2.2 architecture, data-source rules and validation gates.

KINGMAST is not an official Apple CarPlay app, not AEB/ACC, and not a homologated safety product.
