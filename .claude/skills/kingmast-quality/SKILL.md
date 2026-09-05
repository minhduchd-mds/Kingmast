---
name: kingmast-quality
description: Quality and regression workflow for KINGMAST. This skill should be used for test planning, CI gates, bug fixes, refactors, Playwright coverage, source-contract checks, and release-readiness verification.
user-invocable: true
---

# KINGMAST quality

## Goal

Make safety, UI/UX, contracts and runtime behavior continuously verifiable instead of relying on manual confidence.

## Workflow

1. Reproduce or understand the current behavior before patching.
2. Add the smallest test that fails for the real bug/invariant, then implement the fix.
3. Preserve source-level contract checks for rules that should never regress.
4. Keep unit tests deterministic and separate transport/UI concerns from pure logic where possible.
5. Cover automotive layout behavior at 1366×768, 1920×720 and 1280×480 when UI hierarchy is affected.
6. Cover reduced motion, focus/accessibility and degraded/offline behavior when relevant.
7. Run `pnpm skills:validate`, `pnpm safety:boundary`, lint, typecheck, tests, production audit and build.
8. Run HMI Playwright tests for front-end/runtime changes.
9. Do not merge a partially green PR. Inspect exact failing logs and fix the root cause on the same branch.
10. After merge, verify the `main` workflow and production deployment rather than assuming PR success guarantees production success.

## Completion report

State exact test counts and which gates passed. Separate non-blocking warnings from application failures.
