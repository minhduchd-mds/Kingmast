# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The production boundary remains **warning-only Level 0 driver assistance**: speed, forward/rear gap, THW/TTC, surround awareness, GPS positioning, road-object detection, location-aware alerts, sensor health, event logging, and parked-only settings.

> Safety boundary: this repository does **not** issue steering, braking, throttle, or drivetrain commands. Vehicle adapters are read-only by design. Autonomous-driving work belongs in a separate simulation-only lab.

## V2.1 highlights
- Apple-inspired automotive system-app information architecture with free Lucide outline icons.
- Drive, Map, Objects, Alerts, Trip and Vehicle surfaces with GNSS/device-GPS positioning.
- Camera + radar fusion for person, car, motorcycle, bicycle, truck, bus, obstacle and unknown objects.
- Object range/bearing projected to GPS coordinates for map and location-aware warnings.
- Realtime ESP32/GNSS + radar ingestion and camera detection publisher.
- Protocol v1, boot-session identity, replay protection, epoch clock validation and sensor freshness gates.
- Stable alert IDs with short hysteresis to reduce warning flicker.
- WebSocket heartbeat, reconnect jitter, sequence/session guard and stream-quality diagnostics in the HMI.
- Optional `KINGMAST_EDGE_TOKEN` authentication for edge ingestion.
- Diagnostics, event-history and runtime geofence APIs.
- CI warning-only source gate that rejects actuator-command APIs.

## Monorepo
```text
apps/hmi/                  Next.js automotive HMI
services/risk-engine/      Fastify risk, fusion, alert and realtime API
packages/contracts/        Shared typed telemetry contracts
edge/esp32/                GNSS/radar edge publisher reference firmware
edge/camera-detector/      Camera object metadata publisher
database/                  PostgreSQL migrations
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

The HMI falls back to a deterministic simulator when the edge WebSocket is unavailable. **Use device GPS** requests browser geolocation for bench/mobile preview only.

## Realtime API
- `POST /v3/edge/frame` — authenticated protocol-v1 ESP32 packet.
- `POST /v3/perception/radar` — radar tracks.
- `POST /v3/perception/camera` — camera class/bearing metadata; raw frames are not uploaded.
- `GET /v3/stream` — HMI WebSocket telemetry + heartbeat.
- `GET /v3/diagnostics` — edge source ages, clients and rejected-packet count.
- `GET /v3/events` — recent stable warning transitions.
- `GET /v3/geofences` / `POST /v3/geofences` — active location warning zones.
- `GET /v1/capabilities` — explicit warning-only capability boundary.

## Database
Run migrations in order:
```text
database/001_init.sql
database/002_location_object_detection.sql
database/003_edge_operations.sql
```

## Safety model
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only when the gap is closing. Safety decisions are timestamp/confidence aware; stale camera/radar/GNSS inputs are degraded or rejected. GPS context never creates vehicle-control authority.

See `docs/NEXT_20_PR_BATCH.md` for the consolidated V2.1 upgrade batch and verification gates.

KINGMAST is not an official Apple CarPlay app, not AEB/ACC, and not a homologated safety product.
