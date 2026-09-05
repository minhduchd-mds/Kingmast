---
name: kingmast-security
description: Security hardening workflow for KINGMAST. This skill should be used for authentication, authorization, secrets, dependencies, GitHub Actions, native bridges, AI tools, network boundaries, threat modeling, and security review.
user-invocable: true
---

# KINGMAST security

## Goal

Protect the vehicle-adjacent software stack with least privilege, explicit trust boundaries and verifiable dependency/workflow hygiene.

## Workflow

1. Identify assets, trust boundaries, entry points and side effects before editing security-sensitive code.
2. Keep edge ingress, viewer APIs, native bridges and AI tools scoped to the minimum permissions needed.
3. Never commit credentials, private keys, tokens, vehicle secrets or production connection strings.
4. Validate and bound all externally supplied data before risk logic or UI consumption.
5. Preserve replay/freshness protection on realtime sensor and assist ingress.
6. Keep AI tool access allowlisted and read-only; reject actuator intent.
7. Review dependency advisories using the resolved production dependency path, not package-name guesses.
8. Keep CI reproducible with frozen lockfiles and fail on Moderate-or-higher known production vulnerabilities unless a documented exception exists.
9. Keep GitHub Actions permissions minimal and use current supported action/runtime versions.
10. Add a regression/security-contract test whenever a security invariant can be made executable.

## Review standard

Report confirmed vulnerabilities separately from theoretical hardening opportunities. Do not claim a specific vulnerable dependency without a resolved path or advisory evidence.
