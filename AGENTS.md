# KINGMAST cross-agent contract

This file is the vendor-neutral entry point for coding agents that do not automatically consume `CLAUDE.md`.

Read `CLAUDE.md` and the relevant `.claude/skills/<skill>/SKILL.md` before making non-trivial changes. The skill files use the portable Agent Skills `SKILL.md` structure so their workflows can be reused by other compatible coding agents even when their discovery directory differs.

## Mandatory invariants

- KINGMAST remains SAE Level 0, warning-only and advisory-only.
- No steering, brake, throttle, gear, torque, generic CAN-write or actuator authority.
- Runtime truth beats demo continuity: stale/untrusted/missing data degrades instead of becoming fake healthy data.
- UI must never overstate native hardware/provider availability.
- Security, typed contracts, bounded inputs, privacy, replay resistance and least privilege are part of correctness.
- Full CI must pass before merge.

## Agent workflow

1. Inspect the current branch, relevant source, contracts and tests.
2. Apply `kingmast-safety` whenever the task can affect vehicle behavior, alerts, sensors, ADAS, AI actions, native bridges or hardware.
3. Apply the domain skill that matches the work.
4. Change the smallest coherent surface; update contracts/tests/docs together where needed.
5. Run the repository quality gates, including `pnpm skills:validate`, before proposing merge.
6. Report what is truly implemented separately from hardware/provider work that still requires integration.

Do not copy proprietary Apple/OEM assets, layouts, algorithms or confidential material. Use public design/engineering principles as references and implement original KINGMAST behavior.
