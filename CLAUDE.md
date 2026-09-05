# KINGMAST agent instructions

KINGMAST is an original, Apple-inspired automotive HMI and driver-safety platform. It is not an official Apple CarPlay product.

## Non-negotiable product boundary

- SAE Level 0 / warning-only / advisory-only.
- Never add steering, braking, throttle, gear, torque, generic CAN-write, or actuator-control authority.
- Software-ready is not hardware-ready. Never label a capability live, calibrated, connected, or available unless the runtime contract proves it.
- Missing, stale, replayed, untrusted, or low-confidence data must degrade or become unavailable; never invent healthy telemetry for visual continuity.

## How Claude Code should work in this repository

1. Read this file first, then load the smallest relevant project skill from `.claude/skills/`.
2. For any change touching vehicle state, ADAS, edge ingestion, AI tools, HMI warning behavior, hardware, or CAN, always apply `kingmast-safety` in addition to the task-specific skill.
3. Inspect existing code and tests before changing architecture or UI. Prefer extending established contracts over parallel implementations.
4. Keep UI, backend, edge, and hardware truth synchronized. Do not present staged/native-provider work as completed integration.
5. Use a branch and PR for non-trivial changes. Do not merge until the full CI verification is green.
6. Treat the user's explicit request as the goal; skills are guardrails and workflows, not a reason to leave requested work unfinished.

## Project skills

- `kingmast-safety` — safety authority, fail-closed rules, CAN/read-only boundary.
- `kingmast-hmi-uiux` — Apple-inspired automotive HMI, accessibility, motion, density and warning hierarchy.
- `kingmast-backend` — Fastify/risk-engine APIs, validation, auth, freshness and observability.
- `kingmast-adas-runtime` — LDW, DMS, 360, edge perception and runtime truth.
- `kingmast-hardware-esp32` — ESP32 prototype, automotive power, connectors and read-only telemetry integration.
- `kingmast-security` — threat model, least privilege, dependency and workflow security.
- `kingmast-quality` — testing, regression, CI and quality gates.
- `kingmast-architecture` — contracts, module boundaries and product architecture.
- `kingmast-research` — evidence-based technical/product research without copying proprietary implementation.
- `kingmast-release` — commit/PR/release workflow; user-invoked for side-effecting release work.

Canonical engineering rules remain in `docs/HMI_UI_RULES_V006.md` and `safety/SAFETY_POLICY.md`. Skills must not weaken those files.
