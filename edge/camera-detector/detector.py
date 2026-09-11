import argparse
import hashlib
import hmac
import json
import math
import os
import threading
import time
from typing import Any

import cv2
import requests
from requests.adapters import HTTPAdapter
from ultralytics import YOLO

from capture_runtime import CaptureRecovery
from frame_runtime import LatestFrameBuffer
from publisher_runtime import PublishBackoff, classify_http_response, transport_failure
from runtime_metrics import RollingLatency

SUPPORTED = {
    'person': 'person', 'bicycle': 'bicycle', 'car': 'car',
    'motorcycle': 'motorcycle', 'bus': 'bus', 'truck': 'truck',
}
INGRESS_SCOPE = 'perception:camera'


def bearing_from_center(center_x: float, frame_width: int, horizontal_fov_deg: float) -> float:
    normalized = (center_x / max(frame_width, 1)) - 0.5
    return normalized * horizontal_fov_deg


def normalize_json_numbers(value: Any) -> Any:
    """Keep Python JSON numeric rendering aligned with JSON.stringify for this bounded payload."""
    if isinstance(value, bool) or value is None or isinstance(value, (str, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError('non-finite JSON number is not allowed')
        return int(value) if value.is_integer() else value
    if isinstance(value, list):
        return [normalize_json_numbers(item) for item in value]
    if isinstance(value, dict):
        return {str(key): normalize_json_numbers(item) for key, item in value.items()}
    raise TypeError(f'unsupported JSON value: {type(value).__name__}')


def canonical_ingress_message(device_id: str, key_id: str, timestamp_ms: int, payload: dict[str, Any]) -> bytes:
    normalized = normalize_json_numbers(payload)
    canonical_json = json.dumps(normalized, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    return f'KINGMAST-INGRESS-V1\n{INGRESS_SCOPE}\n{device_id}\n{key_id}\n{timestamp_ms}\n{canonical_json}'.encode('utf-8')


def sign_ingress_hmac(device_id: str, key_id: str, timestamp_ms: int, payload: dict[str, Any], secret: str) -> str:
    return hmac.new(secret.encode('utf-8'), canonical_ingress_message(device_id, key_id, timestamp_ms, payload), hashlib.sha256).hexdigest()


def frame_payload(
    model: YOLO,
    frame: Any,
    camera_id: str,
    horizontal_fov_deg: float,
    confidence_floor: float,
    max_detections: int,
    timestamp_ms: int,
) -> dict[str, Any]:
    detections: list[dict[str, Any]] = []
    result = model.predict(frame, verbose=False)[0]
    names = result.names
    candidates: list[tuple[float, dict[str, Any]]] = []

    for index, box in enumerate(result.boxes):
        class_id = int(box.cls[0].item())
        kind = SUPPORTED.get(str(names[class_id]))
        if kind is None:
            continue
        confidence = float(box.conf[0].item())
        if confidence < confidence_floor:
            continue
        x1, _, x2, _ = [float(v) for v in box.xyxy[0].tolist()]
        bearing = bearing_from_center((x1 + x2) / 2, frame.shape[1], horizontal_fov_deg)
        candidates.append((confidence, {
            'id': f'{camera_id}-{timestamp_ms}-{index}',
            'kind': kind,
            'confidence': round(confidence, 4),
            'bearingDeg': round(bearing, 2),
            'estimatedDistanceM': None,
            'timestampMs': timestamp_ms,
        }))

    for _, detection in sorted(candidates, key=lambda item: item[0], reverse=True)[:max_detections]:
        detections.append(detection)
    return normalize_json_numbers({'cameraId': camera_id, 'timestampMs': timestamp_ms, 'detections': detections})


def capture_loop(
    capture: Any,
    source: int | str,
    buffer: LatestFrameBuffer,
    stop_event: threading.Event,
    recovery: CaptureRecovery,
) -> None:
    while not stop_event.is_set():
        ok, frame = capture.read()
        if not ok:
            delay_s = recovery.read_failure()
            if delay_s is None:
                stop_event.wait(0.05)
                continue
            capture.release()
            if stop_event.wait(delay_s):
                return
            opened = bool(capture.open(source))
            recovery.reconnect_result(opened)
            if not opened:
                continue
            continue
        recovery.success()
        if not buffer.push(frame, int(time.time() * 1000)):
            return


def runtime_report(
    buffer: LatestFrameBuffer,
    capture_recovery: CaptureRecovery,
    processed_frames: int,
    stale_frames: int,
    publish_failures: int,
    publish_outcomes: dict[str, int],
    inference_latency: RollingLatency,
    publish_latency: RollingLatency,
) -> dict[str, Any]:
    captured = buffer.captured
    dropped = buffer.dropped
    drop_rate = round(dropped / captured, 4) if captured else 0.0
    capture_state = capture_recovery.snapshot()
    return {
        'event': 'kingmast-camera-runtime',
        'capturedFrames': captured,
        'processedFrames': processed_frames,
        'droppedFrames': dropped,
        'staleFrames': stale_frames,
        'dropRate': drop_rate,
        'queueDepth': buffer.depth,
        'capture': {
            'readFailures': capture_state.read_failures,
            'reconnectAttempts': capture_state.reconnect_attempts,
            'reconnects': capture_state.reconnects,
            'consecutiveFailures': capture_state.consecutive_failures,
        },
        'publishFailures': publish_failures,
        'publishOutcomes': dict(sorted(publish_outcomes.items())),
        'inference': inference_latency.snapshot(),
        'publish': publish_latency.snapshot(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='KINGMAST camera detection publisher')
    parser.add_argument('--api', default='http://127.0.0.1:4000/v3/perception/camera')
    parser.add_argument('--model', default='yolo11n.pt')
    parser.add_argument('--source', default='0', help='OpenCV camera index or video/RTSP URL')
    parser.add_argument('--camera-id', default='front-camera')
    parser.add_argument('--fov', type=float, default=78.0)
    parser.add_argument('--fps', type=float, default=10.0)
    parser.add_argument('--confidence', type=float, default=0.45)
    parser.add_argument('--max-detections', type=int, default=48)
    parser.add_argument('--queue-size', type=int, default=2)
    parser.add_argument('--max-frame-age-ms', type=int, default=350)
    parser.add_argument('--metrics-interval-s', type=float, default=5.0)
    parser.add_argument('--publish-timeout-s', type=float, default=0.8)
    parser.add_argument('--token', default=os.getenv('KINGMAST_EDGE_TOKEN', ''))
    parser.add_argument('--device-id', default=os.getenv('KINGMAST_DEVICE_ID', ''))
    parser.add_argument('--device-key-id', default=os.getenv('KINGMAST_DEVICE_KEY_ID', ''))
    args = parser.parse_args()

    if args.max_frame_age_ms < 50 or args.max_frame_age_ms > 5_000:
        raise RuntimeError('--max-frame-age-ms must be between 50 and 5000')
    if args.metrics_interval_s < 1 or args.metrics_interval_s > 60:
        raise RuntimeError('--metrics-interval-s must be between 1 and 60')

    device_secret = os.getenv('KINGMAST_DEVICE_SECRET', '')
    device_auth_fields = (args.device_id.strip(), args.device_key_id.strip(), device_secret)
    if any(device_auth_fields) and not all(device_auth_fields):
        raise RuntimeError('KINGMAST device auth requires device id, key id and KINGMAST_DEVICE_SECRET together')
    if device_secret and len(device_secret) < 32:
        raise RuntimeError('KINGMAST_DEVICE_SECRET must be at least 32 characters')

    source: int | str = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise RuntimeError(f'Unable to open camera source: {args.source}')

    model = YOLO(args.model)
    period = 1.0 / max(args.fps, 1.0)
    frame_buffer = LatestFrameBuffer(args.queue_size)
    capture_recovery = CaptureRecovery(failure_threshold=10, base_delay_s=0.25, max_delay_s=2.0)
    stop_event = threading.Event()
    capture_thread = threading.Thread(
        target=capture_loop,
        args=(capture, source, frame_buffer, stop_event, capture_recovery),
        name=f'kingmast-capture-{args.camera_id}',
        daemon=True,
    )
    inference_latency = RollingLatency()
    publish_latency = RollingLatency()
    publish_backoff = PublishBackoff(base_s=0.1, max_s=2.0)
    processed_frames = 0
    stale_frames = 0
    publish_failures = 0
    publish_outcomes: dict[str, int] = {}
    last_metrics_at = time.monotonic()

    session = requests.Session()
    # A signed frame is submitted at most once. Fresh capture replaces transport retries.
    adapter = HTTPAdapter(max_retries=0, pool_connections=2, pool_maxsize=2)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    if args.token:
        session.headers.update({'x-kingmast-edge-token': args.token})
    if device_secret:
        session.headers.update({'x-kingmast-device-id': args.device_id.strip(), 'x-kingmast-device-key-id': args.device_key_id.strip()})

    capture_thread.start()
    try:
        while True:
            loop_started = time.monotonic()
            captured = frame_buffer.get_latest(timeout_s=0.5)
            if captured is None:
                if stop_event.is_set():
                    break
                continue

            frame_age_ms = int(time.time() * 1000) - captured.captured_at_ms
            if frame_age_ms > args.max_frame_age_ms:
                stale_frames += 1
                continue

            inference_started = time.monotonic()
            payload = frame_payload(
                model,
                captured.frame,
                args.camera_id,
                args.fov,
                max(0.0, min(1.0, args.confidence)),
                max(1, args.max_detections),
                captured.captured_at_ms,
            )
            inference_latency.observe((time.monotonic() - inference_started) * 1000)
            processed_frames += 1

            headers: dict[str, str] = {}
            if device_secret:
                headers['x-kingmast-device-signature'] = sign_ingress_hmac(
                    args.device_id.strip(),
                    args.device_key_id.strip(),
                    int(payload['timestampMs']),
                    payload,
                    device_secret,
                )

            publish_started = time.monotonic()
            delay_s = 0.0
            try:
                response = session.post(
                    args.api,
                    json=payload,
                    headers=headers,
                    timeout=max(0.1, args.publish_timeout_s),
                )
                outcome = classify_http_response(response.status_code, response.headers.get('retry-after'))
                publish_outcomes[outcome.disposition] = publish_outcomes.get(outcome.disposition, 0) + 1
                if not outcome.accepted:
                    publish_failures += 1
                    print(f'camera publish rejected: status={response.status_code} disposition={outcome.disposition}')
                delay_s = publish_backoff.delay_for(outcome)
            except requests.RequestException as exc:
                outcome = transport_failure()
                publish_outcomes[outcome.disposition] = publish_outcomes.get(outcome.disposition, 0) + 1
                publish_failures += 1
                delay_s = publish_backoff.delay_for(outcome)
                print(f'camera publish warning: {exc}')
            finally:
                publish_latency.observe((time.monotonic() - publish_started) * 1000)

            # Capture keeps running during backoff; the next inference consumes only the newest frame.
            if delay_s > 0:
                stop_event.wait(delay_s)

            now_monotonic = time.monotonic()
            if now_monotonic - last_metrics_at >= args.metrics_interval_s:
                print(json.dumps(runtime_report(
                    frame_buffer,
                    capture_recovery,
                    processed_frames,
                    stale_frames,
                    publish_failures,
                    publish_outcomes,
                    inference_latency,
                    publish_latency,
                ), separators=(',', ':')))
                last_metrics_at = now_monotonic

            sleep_for = period - (time.monotonic() - loop_started)
            if sleep_for > 0:
                stop_event.wait(sleep_for)
    finally:
        stop_event.set()
        frame_buffer.close()
        capture.release()
        capture_thread.join(timeout=1.0)
        session.close()


if __name__ == '__main__':
    main()
