# KINGMAST camera edge runtime profiles

These profiles are **starting points for bench tuning only**. They are not hardware qualification results and do not claim physical-vehicle validation.

The detector remains warning/advisory only and has no actuator authority.

## Generic CPU baseline

Use this first when bringing up an unknown Linux edge computer:

```bash
python edge/camera-detector/detector.py \
  --source 0 \
  --camera-id front-camera \
  --device cpu \
  --imgsz 512 \
  --fps 6
```

Tune from measured P50/P95 inference latency and drop rate. Do not increase FPS just because capture supports it; the target is fresh frames, not queue depth.

## Raspberry Pi 5 CPU-only starting point

A conservative CPU-only starting point is:

- `--device cpu`
- `--imgsz 416`
- `--fps 5` to `8`
- `--queue-size 2`
- `--max-frame-age-ms 350`
- FP16 disabled

Example:

```bash
python edge/camera-detector/detector.py \
  --source 0 \
  --camera-id front-camera \
  --device cpu \
  --imgsz 416 \
  --fps 6 \
  --queue-size 2
```

These values are not a Raspberry Pi 5 benchmark. Record actual thermal, latency, drop-rate and target-display evidence on the intended hardware before changing any readiness claim.

### Raspberry Pi AI HAT / Hailo note

The current Ultralytics publisher path is not a Hailo execution backend. Do not set a fake `--device` value and describe it as Hailo acceleration. A Hailo-specific inference adapter/export path should be implemented and measured separately.

## NVIDIA Jetson CUDA starting point

For a Jetson device with a working CUDA/PyTorch/Ultralytics stack, a starting point is:

- `--device 0`
- `--imgsz 640`
- `--fps 10`
- `--half`
- `--queue-size 2`

Example:

```bash
python edge/camera-detector/detector.py \
  --source 0 \
  --camera-id front-camera \
  --device 0 \
  --imgsz 640 \
  --half \
  --fps 10
```

FP16 is rejected when no explicit accelerator is selected. The current configuration helper also rejects FP16 for `cpu` and `mps`.

## Thermal guard

Linux thermal telemetry defaults to:

```text
/sys/class/thermal/thermal_zone0/temp
```

Defaults:

- recovery: 70 °C
- warm: 75 °C → cadence factor 0.75
- hot: 82 °C → cadence factor 0.50

If the thermal path is unavailable, the state is reported as `unavailable` and cadence remains 1.0. Missing temperature data is never converted into a claim that the device is thermally healthy.

The thermal guard reduces requested inference cadence only. Capture continues with a bounded latest-frame queue, so after cooling the next inference uses a recent frame rather than replaying queued history.

## Evidence to capture on target hardware

For each intended edge computer, record at minimum:

1. model file/hash and inference backend;
2. image size, requested/effective FPS and precision;
3. P50/P95 inference latency;
4. publish P50/P95 latency;
5. captured / processed / dropped / stale frames;
6. thermal state and temperature over time;
7. reconnect/read-failure counts;
8. CPU/GPU/NPU utilization where available;
9. 30+ minute soak behavior;
10. camera-to-warning latency using an external reference when moving beyond software-only testing.

Do not convert CI, desktop, simulator, or short bench measurements into a physical-vehicle/HIL claim.
