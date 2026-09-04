import argparse
import math
import time
from typing import Any

import cv2
import requests
from ultralytics import YOLO

SUPPORTED = {
    'person': 'person',
    'bicycle': 'bicycle',
    'car': 'car',
    'motorcycle': 'motorcycle',
    'bus': 'bus',
    'truck': 'truck',
}


def bearing_from_center(center_x: float, frame_width: int, horizontal_fov_deg: float) -> float:
    normalized = (center_x / max(frame_width, 1)) - 0.5
    return normalized * horizontal_fov_deg


def frame_payload(model: YOLO, frame: Any, camera_id: str, horizontal_fov_deg: float) -> dict[str, Any]:
    timestamp_ms = int(time.time() * 1000)
    detections: list[dict[str, Any]] = []
    result = model.predict(frame, verbose=False)[0]
    names = result.names

    for index, box in enumerate(result.boxes):
        class_id = int(box.cls[0].item())
        raw_name = str(names[class_id])
        kind = SUPPORTED.get(raw_name)
        if kind is None:
            continue
        confidence = float(box.conf[0].item())
        if confidence < 0.45:
            continue

        x1, _, x2, _ = [float(v) for v in box.xyxy[0].tolist()]
        bearing = bearing_from_center((x1 + x2) / 2, frame.shape[1], horizontal_fov_deg)
        detections.append({
            'id': f'{camera_id}-{timestamp_ms}-{index}',
            'kind': kind,
            'confidence': round(confidence, 4),
            'bearingDeg': round(bearing, 2),
            # Distance stays null on purpose. Radar is the primary metric distance source.
            'estimatedDistanceM': None,
            'timestampMs': timestamp_ms,
        })

    return {'cameraId': camera_id, 'timestampMs': timestamp_ms, 'detections': detections}


def main() -> None:
    parser = argparse.ArgumentParser(description='KINGMAST camera detection publisher')
    parser.add_argument('--api', default='http://127.0.0.1:4000/v3/perception/camera')
    parser.add_argument('--model', default='yolo11n.pt')
    parser.add_argument('--source', default='0', help='OpenCV camera index or video/RTSP URL')
    parser.add_argument('--camera-id', default='front-camera')
    parser.add_argument('--fov', type=float, default=78.0, help='Horizontal camera field of view in degrees')
    parser.add_argument('--fps', type=float, default=10.0)
    args = parser.parse_args()

    source: int | str = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise RuntimeError(f'Unable to open camera source: {args.source}')

    model = YOLO(args.model)
    period = 1.0 / max(args.fps, 1.0)
    session = requests.Session()

    try:
        while True:
            started = time.monotonic()
            ok, frame = capture.read()
            if not ok:
                time.sleep(0.1)
                continue
            payload = frame_payload(model, frame, args.camera_id, args.fov)
            try:
                session.post(args.api, json=payload, timeout=0.8).raise_for_status()
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
