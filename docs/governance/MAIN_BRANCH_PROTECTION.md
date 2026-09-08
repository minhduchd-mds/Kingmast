# KINGMAST main-branch protection requirement

Status: repository-governance requirement with an active GitHub repository ruleset observed on 2026-09-08. The active ruleset already blocks deletion and non-fast-forward updates, requires signed commits, enables CodeQL/code-quality gating and Copilot review-on-push. It does **not** yet expose a required-pull-request rule or required status-check rule in the observed server-side configuration, so the governance gate remains partially open.

## Observed active ruleset

GitHub currently reports repository ruleset `GPT` (`id: 22458125`) with active enforcement and no bypass actors. Observed rules include:

- branch deletion blocked;
- non-fast-forward/force-push blocked;
- required signatures;
- CodeQL gate at high-or-higher security alerts / error analysis threshold;
- code-quality error gate;
- code-coverage rule present without a configured minimum;
- Copilot code review on push;
- required-deployments rule present but with no required deployment environment configured.

The server-side ruleset should not be described as fully satisfying KINGMAST governance until the remaining merge controls below are present.

## Target `main` policy

The `main` branch should require pull-request based changes and the following protections:

- no direct force-pushes;
- no branch deletion;
- required pull request before merge;
- at least one approving review for safety/security-sensitive paths;
- dismiss stale approvals when new commits materially change the PR;
- require CODEOWNERS review where supported;
- require current CI and CodeQL checks before merge;
- require conversation resolution;
- block merge when the branch is behind the required update policy;
- preserve signed/web-verified commit policy where configured.

## Required safety paths

`CODEOWNERS` should remain authoritative for at least:

- `/safety/`
- `/services/risk-engine/`
- `/edge/`
- `/packages/contracts/`
- `/.github/workflows/`
- `/docs/safety/`
- `/docs/cybersecurity/`
- `/docs/updates/`
- `/docs/validation/`

## Recommended required checks

Use the actual check names emitted by GitHub for this repository. At minimum the policy should gate on:

- CI / verify;
- CodeQL / Analyze JavaScript/TypeScript.

The policy should be updated if workflow/job names change so that a rename cannot silently remove the gate.

## Remaining administrator actions

The connected repository interface available to this engineering session can read rulesets but cannot apply repository-administration changes. An administrator still needs to add or verify:

1. a required-pull-request rule targeting `main`;
2. at least one approving review;
3. CODEOWNERS review for safety/security-sensitive changes;
4. required status checks for `CI / verify` and `CodeQL / Analyze JavaScript/TypeScript`;
5. conversation resolution before merge;
6. an explicit branch target condition for `main` or the repository default branch so scope cannot be ambiguous;
7. removal of empty/no-op required-deployment and code-coverage rules unless they are intentionally configured.

## Administration boundary

These settings require GitHub repository administration/ruleset permissions. Source-code changes cannot substitute for server-side enforcement. Until the observed ruleset includes the required PR/review/status-check controls, this item remains partially open even though deletion, force-push, signatures and scanning are already enforced.

## Safety rationale

A warning-only architecture can still be weakened by an unreviewed change. Branch governance is therefore part of the engineering evidence chain, but it is not a substitute for functional-safety or cybersecurity review.
