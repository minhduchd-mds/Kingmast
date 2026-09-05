---
name: kingmast-release
description: Git and release workflow for KINGMAST. This skill should be used when the user explicitly asks to commit, push, create or merge a PR, publish a release, or deploy verified changes.
disable-model-invocation: true
user-invocable: true
---

# KINGMAST release

## Goal

Ship only reviewed, reproducible, fully verified changes and preserve a traceable main branch.

## Workflow

1. Re-check the current `main` SHA before starting release work.
2. Use a focused branch for non-trivial changes; do not mix unrelated cleanup into the release.
3. Review the final diff for secrets, generated junk, accidental capability claims and safety-boundary changes.
4. Run `pnpm skills:validate`, `pnpm safety:boundary`, lint, typecheck, unit/contract tests, production dependency audit and build.
5. Run HMI Playwright tests when front-end/runtime behavior can be affected.
6. Create/update the PR with a concise scope, safety impact and exact verification results.
7. Do not merge while required checks are running or failing.
8. Prefer squash merge for a focused feature/fix unless history needs separate commits.
9. Verify the resulting `main` SHA and post-merge CI.
10. If production deployment is connected, verify the deployment corresponds to the merged SHA and returns successfully.

## Safety rule

A release must never use wording such as implemented/live/available for hardware or provider integration that has not actually been validated. List remaining integration blockers separately.
