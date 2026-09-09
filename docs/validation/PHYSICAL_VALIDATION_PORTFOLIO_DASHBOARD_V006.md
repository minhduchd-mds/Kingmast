# KINGMAST v0.0.6 Physical Validation Portfolio Dashboard

This dashboard provides one view across physical HIL, controlled-track evidence retention and independent review readiness.

It reports HIL and controlled-track lifecycle counts separately, the number of registered protected-store metadata records, physical review-queue state and program-level independent review state.

The dashboard deliberately does **not** collapse software preparation and physical evidence into one optimistic score. The primary physical metric is reviewed scenario evidence coverage across 12 HIL and 8 controlled-track scenarios.

The committed baseline is expected to show:

- HIL: 12 `BLOCKED`, 0 reviewed;
- controlled track: 8 `BLOCKED`, 0 reviewed;
- protected physical evidence store backend: not configured;
- protected-store metadata records: 0;
- physical review queue: empty;
- program-level independent review: pending;
- Gate-3 physical evidence ready: false;
- target-hardware qualified: false;
- controlled-track approved: false;
- public-road approved: false.

A green CI result means the lifecycle contracts are internally consistent. It is not physical qualification evidence.
