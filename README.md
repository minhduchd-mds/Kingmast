# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The production boundary remains **warning-only Level 0 driver assistance**: speed, forward/rear gap, THW/TTC, surround awareness, GPS positioning, road-object detection, location-aware alerts, navigation context, sensor health and event logging.

> Safety boundary: this repository does **not** issue steering, braking, throttle or drivetrain commands. Vehicle adapters are read-only by design. Autonomous-driving work belongs in a separate simulation-only lab.

## V2.4 highlights
- Apple-inspired automotive HMI with a navigation-first driver hierarchy.
- Native MapLibre map rendering with configurable production style provider and OSM demo fallback.
- Route geometry, destination, vehicle, camera and object markers in one map coordinate system.
- Route-aware traffic-camera matching with direction filtering when metadata is available.
- Camera warning bands around 1 km / 500 m / 300 m / immediate.
- Current speed-limit awareness fused from mapped road metadata and high-confidence sign vision.
- Turn-by-turn maneuver urgency, advisory lane hint, route progress, remaining distance and dynamic ETA.
- Sustained off-route detection with cooldown-protected rerouting.
- Optional short voice prompts for turns, camera context, speed limits and rerouting.
- Moving destination-edit lock for real vehicle sources.
- Short-lived route cache and recent destinations for degraded/offline continuity.
- Auto / Day / Night appearance modes and reduced-motion support.
- Realtime ESP32/GNSS + radar ingestion and camera detection publisher.
- Camera + radar fusion for person, car, motorcycle, bicycle, truck, bus and obstacles.
- Warning-only CI safety gate that rejects actuator-command APIs.

## Monorepo
```text
apps/hmi/                  Next.js automotive HMI
services/risk-engine/      Fastify risk, fusion, road-context and realtime API
packages/contracts/        Shared typed telemetry/navigation contracts
edge/esp32/                GNSS/radar edge publisher reference firmware
edge/camera-detector/      Camera object/speed-sign metadata publisher
database/                  PostgreSQL migrations
safety/                    Safety policy and traceability
skills/ecc-plan/           Engineering Control & Compliance planning skill
docs/                      Architecture, HMI, navigation and ECU plans
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

## Navigation and road-context API
- `GET /v4/road-context` — current posted-speed and camera context.
- `GET /v4/navigation/search` — configurable Nominatim-compatible place search.
- `POST /v4/navigation/route` — OSRM-compatible route calculation.
- `POST /v4/perception/speed-sign` — authenticated high-confidence local speed-sign observation.
- `POST /v4/road-context/cameras` — authenticated runtime camera-provider metadata.
- `GET /v4/road-context/providers` — provider/coverage policy.

## Realtime API
- `POST /v3/edge/frame` — authenticated protocol-v1 ESP32 packet.
- `POST /v3/perception/radar` — radar tracks.
- `POST /v3/perception/camera` — camera class/bearing metadata; raw frames are not uploaded.
- `GET /v3/stream` — HMI WebSocket telemetry + heartbeat.
- `GET /v3/diagnostics` — edge source ages, clients and rejected-packet count.
- `GET /v3/events` — recent stable warning transitions.
- `GET /v3/geofences` / `POST /v3/geofences` — active location warning zones.
- `GET /v1/capabilities` — explicit warning-only capability boundary.

## Map configuration
For production, configure an approved vector style with:
```text
NEXT_PUBLIC_MAP_STYLE_URL=https://your-approved-style/style.json
```
If blank, KINGMAST falls back to `NEXT_PUBLIC_MAP_RASTER_TILE_URL` for demo use. Public tile endpoints must not be treated as a production SLA.

## Database
Run migrations in order:
```text
database/001_init.sql
database/002_location_object_detection.sql
database/003_edge_operations.sql
```

## Safety model
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only when the gap is closing. Safety decisions are timestamp/confidence aware; stale camera/radar/GNSS inputs are degraded or rejected. GPS, map and navigation context never create vehicle-control authority.

See `docs/APPLE_AUTOMOTIVE_HMI_V4.md` for the consolidated V2.4 HMI/navigation upgrade and verification gates.

KINGMAST is Apple-inspired but is not an official Apple CarPlay app, not AEB/ACC and not a homologated safety product.
