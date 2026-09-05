---
name: kingmast-backend
description: Backend engineering workflow for KINGMAST risk-engine and APIs. This skill should be used for Fastify routes, shared contracts, authentication, validation, realtime telemetry, health, observability, persistence boundaries, and service changes.
user-invocable: true
---

# KINGMAST backend

## Goal

Keep backend behavior explicit, typed, fail-closed, observable and compatible with the HMI without granting vehicle-control authority.

## Workflow

1. Inspect `packages/contracts`, `services/risk-engine` and existing tests before changing an API.
2. Extend shared typed contracts instead of creating duplicate shapes in individual services.
3. Validate public/native payloads with bounded schemas, finite ranges, maximum array sizes and bounded strings.
4. Preserve separate trust boundaries for edge sensor ingress and viewer/read APIs.
5. Treat timestamps, monotonic ordering and freshness windows as correctness requirements.
6. Return degraded/unavailable state when data cannot be trusted; do not fabricate defaults that look healthy.
7. Keep AI/native integrations allowlisted and read-only unless the repository safety policy explicitly permits otherwise; KINGMAST currently permits no actuator authority.
8. Expose integration/readiness state through health/diagnostic surfaces when it affects the product.
9. Add unit/contract tests for invalid, stale, replayed and edge cases as well as success paths.
10. Run lint, typecheck, tests, production build and dependency audit before completion.

## Design preference

Prefer small deterministic modules with pure risk/assessment logic separated from transport/authentication code. Keep error semantics stable and machine-readable.
