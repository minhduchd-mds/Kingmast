---
name: kingmast-architecture
description: Architecture workflow for KINGMAST. This skill should be used for module boundaries, shared contracts, service decomposition, runtime data flow, native integration seams, database design, and major refactors.
user-invocable: true
---

# KINGMAST architecture

## Goal

Evolve KINGMAST through explicit contracts and replaceable integration seams without creating duplicate state or weakening safety boundaries.

## Workflow

1. Read `docs/ARCHITECTURE.md`, shared contracts and the relevant domain code before proposing a new layer.
2. Map producer → contract → assessment/runtime → transport → HMI/native consumer.
3. Keep domain truth in one place. Avoid parallel enums, duplicated DTOs or a second runtime state machine for the same capability.
4. Separate pure assessment/risk logic from I/O, authentication, storage and UI rendering.
5. Treat hardware/provider integrations as adapters behind explicit interfaces; keep the core runnable without pretending those adapters are connected.
6. Design failure/degraded states as first-class paths, including stale data and unavailable providers.
7. Keep the AI assistant read-only and outside control authority.
8. Prefer incremental migrations with compatibility tests over broad rewrites.
9. Update architecture docs and contract tests when boundaries change.
10. Re-run full quality gates for cross-cutting changes.

## Decision rule

Add a new abstraction only when it removes real duplication, isolates a changing integration, or makes a safety/quality invariant easier to enforce.
