# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The production boundary remains **warning-only Level 0 driver assistance**. It does not issue steering, braking, throttle, drivetrain or CAN-write commands.

## V2.3 — Apple-inspired automotive HMI + navigation safety
- Navigation-first Drive cockpit: next maneuver, current speed, verified speed limit, primary safety warning and route-relevant camera context.
- Dynamic speed-limit sign on Drive; the old hard-coded limit is removed.
- Speed-limit changes are surfaced as short, non-blocking notices.
- Route-aware traffic-camera filtering: cameras are matched to the active route corridor before being described as "ahead".
- Driver mode keeps only Drive, Navigate and Alerts in the primary interaction path.
- Detailed Objects, Trip and Vehicle diagnostics are parked-only for real moving vehicles; simulator remains inspectable for bench testing.
- Larger driver typography and 44+ px interaction targets; most primary controls are 48–56 px.
- Reduced decorative glass and motion. Safety state uses text + icon + shape + color.
- Destination UX is now a single **Where to?** search instead of latitude/longitude inputs.
- Configurable Nominatim-compatible geocoding plus OSRM routing.
- Existing public/authorized traffic-camera policy is preserved; camera completeness is never claimed.

## Monorepo
```text
apps/hmi/                  Next.js automotive HMI
services/risk-engine/      Fastify risk, fusion, navigation, road-context and realtime API
packages/contracts/        Shared typed telemetry/navigation contracts
edge/esp32/                GNSS/radar edge publisher reference firmware
edge/camera-detector/      Camera object + speed-sign metadata publisher
database/                  PostgreSQL migrations
safety/                    Safety policy and traceability
docs/                      Architecture and HMI guidance
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
API: http://localhost:4000

The HMI falls back to a deterministic simulator when realtime edge data is unavailable. Browser device GPS is intended for bench/mobile preview only.

## Navigation and road-context API
- `GET /v4/navigation/search?q=...&lat=...&lng=...` — place search through a configurable geocoder.
- `POST /v4/navigation/route` — OSRM route and turn steps.
- `GET /v4/road-context` — speed limit, compliance and nearby public/authorized camera metadata.
- `POST /v4/perception/speed-sign` — high-confidence local speed-sign observation.
- `POST /v4/road-context/cameras` — runtime authorized camera-provider metadata.

The default public geocoding/routing endpoints are for development and evaluation. Production deployments should use an owned or contracted provider that meets availability, privacy and usage-policy requirements.

## Safety boundary
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only while the gap is closing. Stale camera/radar/GNSS data is degraded or rejected. Navigation, speed-limit and camera context remain advisory and never create control authority.

See `docs/APPLE_AUTOMOTIVE_HMI_V3.md` for the HMI V3 design and verification rules.

KINGMAST is not an official Apple CarPlay app, not AEB/ACC, and not a homologated safety product.
