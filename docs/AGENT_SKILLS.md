# KINGMAST Agent Skills

KINGMAST keeps reusable engineering workflows in `.claude/skills/<name>/SKILL.md`. This follows Claude Code's project-skill structure and keeps each workflow small enough to load only when relevant. The same Markdown playbooks are intentionally vendor-neutral enough to be reused by other agents that support the Agent Skills format or can read `SKILL.md` files directly.

## Why both CLAUDE.md and skills

`CLAUDE.md` contains short repository-wide facts and non-negotiable invariants. Procedures live in skills so long workflows do not need to sit in the always-on context. `AGENTS.md` mirrors the cross-agent entry contract for tools that use a different project-instruction convention.

## Skill map

| Skill | Primary scope |
| --- | --- |
| `kingmast-safety` | Level 0 authority, fail-closed behavior, privacy, CAN/read-only boundary |
| `kingmast-hmi-uiux` | Automotive UI/UX, Apple-inspired principles, accessibility, motion, density |
| `kingmast-backend` | Fastify, contracts, validation, auth, realtime APIs, health |
| `kingmast-adas-runtime` | LDW, DMS, 360, perception freshness, calibration/readiness |
| `kingmast-hardware-esp32` | ESP32, automotive power, connectors, wiring and read-only telemetry |
| `kingmast-security` | Threat boundaries, dependencies, Actions, least privilege, AI/native tools |
| `kingmast-quality` | Regression, Playwright, CI, source-contract tests, release readiness |
| `kingmast-architecture` | Module boundaries, shared contracts, adapters and refactors |
| `kingmast-research` | Current evidence, standards, OSS/license-aware research and product decisions |
| `kingmast-release` | Commit/PR/merge/deploy verification; explicitly user-invoked |

## Validation

Run:

```bash
pnpm skills:validate
```

CI validates that all required skills exist, use frontmatter with matching names/descriptions, keep the safety boundary present, and keep the release workflow explicitly user-invoked.

## Precedence

The user's explicit task defines the goal. Project skills define repository workflows and safety/quality invariants. No skill may weaken `safety/SAFETY_POLICY.md` or `docs/HMI_UI_RULES_V006.md`.
