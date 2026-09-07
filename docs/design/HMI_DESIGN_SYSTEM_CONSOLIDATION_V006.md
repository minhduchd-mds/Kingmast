# KINGMAST HMI design-system consolidation — v0.0.6

## Purpose

KINGMAST has accumulated several versioned HMI CSS layers while the driver-facing product evolved. This document defines a safe consolidation path that reduces styling drift without performing a risky all-at-once visual rewrite.

## Canonical semantic layer

`apps/hmi/app/hmi-design-system.css` is the canonical semantic-token interface for newly touched HMI styling. It maps KINGMAST concepts such as surface, text hierarchy, safety state, spacing, radius, motion and touch floors onto the existing theme-aware source variables defined in `globals.css`.

The semantic layer intentionally does **not** redefine source variables such as `--bg`, `--surface`, `--text`, `--safe`, `--caution` or `--critical`. Day/night/high-contrast behavior remains owned by the existing theme layers until each legacy selector is migrated and regression-tested.

Load order is machine checked:

`globals.css -> hmi-design-system.css -> versioned/feature compatibility layers`

## Migration rule

New or materially edited selectors should prefer `--km-*` semantic tokens. Existing CSS files remain compatibility layers and are migrated incrementally. A versioned stylesheet must not be deleted merely to reduce file count unless Playwright coverage demonstrates equivalent behavior across the supported automotive viewports.

Touch targets retain a 44 px compact automotive floor and 48 px primary-action target. Reduced motion, high contrast, focus visibility and warning hierarchy remain mandatory.

## Evidence boundary

This is a software design-system contract. It does not establish measured glance time, comprehension, distraction performance, driver acceptance or any other human-factors validation. Those require an appropriate user study and/or vehicle evaluation.

The consolidation does not create vehicle-control authority. KINGMAST remains warning-only Level 0 with no steering, braking, throttle, gear, torque or generic CAN-write path.
