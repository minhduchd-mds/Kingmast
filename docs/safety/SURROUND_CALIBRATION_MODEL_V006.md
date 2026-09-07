# KINGMAST surround calibration and uncertainty model — v0.0.6

Status: research/visualization safety model. The surround view remains advisory/visualization-only and has no vehicle-control authority.

## Objective

A stitched or multi-camera surround view must never be presented as geometrically healthy merely because camera frames are arriving. KINGMAST therefore separates freshness from calibration/synchronization readiness.

## Required camera evidence

Each configured camera reports:

- `cameraId`
- synchronization state
- calibration state
- reprojection error in pixels
- observation timestamp at the surround-set level

The current research target expects at least four cameras for complete 360-degree coverage. Additional configured cameras are not ignored: every configured camera must be synchronized, calibrated and within reprojection tolerance before `fullyReady=true`.

## Runtime fields

`SurroundRuntimeStatus` exposes:

- `cameraCount`
- `calibratedCameraCount`
- `synchronizedCameraCount`
- `readyCameraCount`
- `maxReprojectionErrorPx`
- `calibrationUncertaintyPx`
- `geometryConfidence`
- `fullyReady`
- freshness/availability and reason

`geometryConfidence` is a bounded engineering quality indicator derived independently from calibration coverage, synchronization coverage and reprojection quality. It is not an object-detection probability and must not be converted into physical distance confidence without separate validation.

## Fail-degraded behavior

Fresh data is still degraded when:

- fewer than four cameras are configured/available;
- any configured camera is not synchronized;
- any configured camera is not calibrated;
- any configured camera exceeds the research reprojection-error tolerance.

Stale observations transition from live/degraded to unavailable according to the runtime freshness policy. The HMI should make degraded/unavailable surround state visible without masking higher-priority collision warnings.

## Clean-room note

This calibration model is KINGMAST-owned. It is based on generic multi-camera geometry/safety principles, not copied OEM stitching algorithms, calibration targets, UI layouts or proprietary thresholds. Production thresholds require validation with the actual camera optics, mounting tolerances, compute stack and target display.
