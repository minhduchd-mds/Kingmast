import argparse
import hashlib
import hmac
import json
import math
import os
import time
from typing import Any

import cv2
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from ultralytics import YOLO

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


def frame_payload(model: YOLO, frame: Any, camera_id: str, horizontal_fov_deg: float, confidence_floor: float, max_detections: int) -> dict[str, Any]:
    timestamp_ms = int(time.time() * 1000)
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
    parser.add_argument('--token', default=os.getenv('KINGMAST_EDGE_TOKEN', ''))
    parser.add_argument('--device-id', default=os.getenv('KINGMAST_DEVICE_ID', ''))
    parser.add_argument('--device-key-id', default=os.getenv('KINGMAST_DEVICE_KEY_ID', ''))
    args = parser.parse_args()

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
    session = requests.Session()
    retry = Retry(total=2, connect=2, read=1, backoff_factor=0.15, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=frozenset({'POST'}))
    session.mount('http://', HTTPAdapter(max_retries=retry))
    session.mount('https://', HTTPAdapter(max_retries=retry))
    if args.token:
        session.headers.update({'x-kingmast-edge-token': args.token})
    if device_secret:
        session.headers.update({'x-kingmast-device-id': args.device_id.strip(), 'x-kingmast-device-key-id': args.device_key_id.strip()})

    try:
        while True:
            started = time.monotonic()
            ok, frame = capture.read()
            if not ok:
                time.sleep(0.1)
                continue
            payload = frame_payload(model, frame, args.camera_id, args.fov, max(0.0, min(1.0, args.confidence)), max(1, args.max_detections))
            headers: dict[str, str] = {}
            if device_secret:
                headers['x-kingmast-device-signature'] = sign_ingress_hmac(args.device_id.strip(), args.device_key_id.strip(), int(payload['timestampMs']), payload, device_secret)
            try:
                session.post(args.api, json=payload, headers=headers, timeout=0.8).raise_for_status()
            except requests.RequestException as exc:
                print(f'camera publish warning: {exc}')
            sleep_for = period - (time.monotonic() - started)
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        capture.release()
        session.close()


if __name__ == '__main__':
    main()
