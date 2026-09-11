# KINGMAST edge camera detector

This publisher is a **warning-only perception input**. It never controls steering, braking, throttle, gear selection, or CAN actuators.

## Runtime model

The live camera path is intentionally bounded:

1. A capture thread timestamps frames at acquisition time.
2. `LatestFrameBuffer` keeps at most 1–8 frames (default: 2) and drops the oldest frame under pressure.
3. Inference consumes the newest available frame rather than replaying an accumulated queue.
4. Frames older than `--max-frame-age-ms` are discarded before inference and checked again before signing/publishing, using both monotonic and wall-clock age.
5. Each signed HTTP payload is submitted **at most once**. The publisher does not automatically retry the same signed frame because the backend replay guard may already have accepted it even when the response was lost.
6. HTTP errors back off **between fresh frames** while capture continues in the background.
7. Repeated camera/RTSP read failures trigger a bounded reconnect cycle.

The backend still applies its own freshness, sequence, authentication, and calibration gates. Local checks do not replace server validation.

## Example

```bash
python detector.py \
  --source 0 \
  --camera-id front-camera \
  --fps 10 \
  --queue-size 2 \
  --max-frame-age-ms 350 \
  --publish-timeout-s 0.8
```

For an RTSP source:

```bash
python detector.py \
  --source 'rtsp://camera.example/stream' \
  --camera-id front-camera \
  --capture-failure-threshold 10 \
  --capture-reconnect-base-s 0.25 \
  --capture-reconnect-max-s 2
```

## Device authentication

For per-device HMAC ingress, keep credentials outside the repository:

```bash
export KINGMAST_DEVICE_ID=edge-camera-01
export KINGMAST_DEVICE_KEY_ID=2026-09-hmac-a
export KINGMAST_DEVICE_SECRET='replace-with-32-plus-random-characters'
```

The signature covers scope, device ID, key ID, capture timestamp, and canonical payload. Never expose device credentials to browser code.

## Runtime metrics

Every `--metrics-interval-s` (default 5 s) the process emits one compact JSON line with:

- captured / processed / dropped / stale frame counts;
- `staleAfterInference` counts results that exceeded the age budget during inference;
- drop rate and current queue depth;
- capture read failures, reconnect attempts, and successful reconnects;
- publisher outcome counts (`accepted`, `backpressure`, `rejected-current-frame`, `authentication-rejected`, `server-unavailable`, `transport-error`, etc.);
- bounded inference and publish latency statistics including P50/P95.

Metrics are operational evidence only. A healthy runtime does **not** mean the road scene is safe, and no physical-vehicle qualification is implied.

## Tests

The runtime helpers use standard-library `unittest` and do not require the YOLO/OpenCV model stack:

```bash
cd edge/camera-detector
python runtime_selftest.py
```

Physical camera, target-compute, thermal, and long-duration validation remain separate bench/HIL evidence tasks.
