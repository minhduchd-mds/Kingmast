# KINGMAST main-branch protection requirement

Status: repository-governance requirement. The repository currently has no repository ruleset returned by GitHub; this document records the target configuration until an administrator applies it.

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

## Recommended required checks

Use the actual check names emitted by GitHub for this repository. At minimum the policy should gate on:

- CI / verify;
- CodeQL / Analyze JavaScript/TypeScript.

The policy should be updated if workflow/job names change so that a rename cannot silently remove the gate.

## Administration boundary

This configuration requires GitHub repository administration/ruleset permissions. A source-code PR cannot by itself enable the server-side repository rule. Until GitHub reports an active ruleset/branch protection configuration, this item remains open even if all local governance files are present.

## Safety rationale

A warning-only architecture can still be weakened by an unreviewed change. Branch governance is therefore part of the engineering evidence chain, but it is not a substitute for functional-safety or cybersecurity review.
