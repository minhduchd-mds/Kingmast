# KINGMAST v0.0.6 — Independent Gate-3 review checklist

This checklist defines the external review package required before KINGMAST can progress beyond software-only and bench evidence. It does not grant homologation, target-hardware qualification or public-road approval.

## Review domains

### Functional safety and SOTIF

Verify ODD boundaries, HARA/SOTIF traceability, stale/untrusted input handling, warning-only authority, degraded/unavailable states, attention arbitration, simulator isolation, fault-injection coverage and any unresolved safety findings.

### Cybersecurity and update lifecycle

Verify device/provider identity, replay protection, key revocation, secure-update policy, anti-rollback behavior, evidence/audit integrity, rate limiting, secret handling, SBOM/provenance, bounded diagnostics and incident/recovery paths.

### Vehicle computer, harness and read-only authority

Verify selected controller identity, physical power/harness design, fusing/grounding/isolation assumptions, watchdog/reset behavior, thermal/resource evidence, timestamp synchronization, physically enforced read-only CAN boundary and absence of actuator authority.

### Driver HMI and human factors

Verify critical-warning hierarchy, glanceability protocol, comprehension/error results when available, touch-target minimums, reduced-motion/high-contrast behavior, DMS uncertainty presentation, surround calibration uncertainty and moving-vs-parked disclosure rules.

### Evidence integrity and reproducibility

Verify exact source commit, configuration/calibration identity, physical equipment references, synchronized timestamps, operator/reviewer separation, SHA-256 evidence bindings, raw-evidence retention controls, evidence-anchor/provenance consistency and reproducibility by another engineer.

## Required review outcome

Each review domain is recorded in `docs/review/V006_INDEPENDENT_REVIEW_REGISTRY.json`. A completed review must contain an independent reviewer, timestamp, SHA-256-bound evidence references, disposition and tracked findings. Open findings remain visible and prevent a clean `reviewed` overall status.

A review disposition of `accept` or `accept-with-findings` means only that the submitted evidence package was reviewed for the stated scope. It does not imply legal approval, market certification, public-road authorization or ISO/UNECE compliance certification.

## Gate-3 exit rule

Gate-3 remains blocked until the physical target soak, applicable HIL scenarios, controlled-track evidence and all independent review domains are complete with no unresolved finding that invalidates the warning-only safety case. Repository CI validates bookkeeping honesty only; it cannot perform or substitute any physical or independent review.
