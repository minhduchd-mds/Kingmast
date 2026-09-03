# KINGMAST

KINGMAST is a safety-first ADAS research platform for electric vehicles. The first production scope is **warning-only Level 0 driver assistance**: speed, forward/rear gap, THW/TTC, surround awareness, sensor health, event logging, and parked-only settings.

> Safety boundary: this repository does **not** issue steering, braking, throttle, or drivetrain commands. Vehicle adapters are read-only by design. Autonomous-driving work belongs in a separate simulation-only lab.

## Product principles
- Glanceable automotive HMI inspired by Apple Human Interface Guidelines and CarPlay interaction principles.
- Critical information uses text + icon + shape + color, never color alone.
- Motion communicates state and direction, never delays safety information, and respects reduced-motion.
- Settings, history, calibration and retention controls are parked-only.
- Safety code is deterministic, timestamp-aware and fail-safe under degradation.

## Monorepo
```text
apps/hmi/                  React HMI simulator
services/risk-engine/      Fastify risk and sensor-health API
packages/contracts/        Shared domain contracts
database/                  PostgreSQL migration + seed
safety/                    Safety policy and traceability
skills/ecc-plan/           Engineering Control & Compliance planning skill
docs/                      Architecture, HMI and ECU integration plans
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

## Safety model
`THW = range / egoSpeed`. `closingSpeed = egoSpeed - targetSpeed`. `TTC = range / closingSpeed` only when the gap is closing. Severity combines TTC/THW, distance, confidence, closing speed, hysteresis and sensor-health gates. Stale/frozen data is rejected.

KINGMAST MVP is not an official Apple CarPlay app, not AEB/ACC, and not a homologated safety product.