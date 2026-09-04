import argparse
import re
import time
from typing import Any

import cv2
import requests
from ultralytics import YOLO

SPEED_LABEL = re.compile(r'(?:speed[_ -]?limit|limit|speed)[_ -]?(\d{1,3})', re.IGNORECASE)


def bearing_from_center(center_x: float, frame_width: int, horizontal_fov_deg: float) -> float:
    return ((center_x / max(frame_width, 1)) - 0.5) * horizontal_fov_deg


def extract_observation(model: YOLO, frame: Any, camera_id: str, fov: float) -> dict[str, Any] | None:
    result = model.predict(frame, verbose=False)[0]
    best: dict[str, Any] | None = None
    timestamp_ms = int(time.time() * 1000)
    for box in result.boxes:
        class_id = int(box.cls[0].item())
        label = str(result.names[class_id])
        match = SPEED_LABEL.search(label)
        if not match:
            continue
        limit = int(match.group(1))
        confidence = float(box.conf[0].item())
        if limit < 5 or limit > 180 or confidence < 0.65:
            continue
        x1, _, x2, _ = [float(value) for value in box.xyxy[0].tolist()]
        observation = {
            'cameraId': camera_id,
            'speedLimitKmh': limit,
            'confidence': round(confidence, 4),
            'bearingDeg': round(bearing_from_center((x1 + x2) / 2, frame.shape[1], fov), 2),
            'timestampMs': timestamp_ms,
        }
        if best is None or confidence > float(best['confidence']):
            best = observation
    return best


def main() -> None:
    parser = argparse.ArgumentParser(description='KINGMAST speed-limit sign observation publisher')
    parser.add_argument('--api', default='http://127.0.0.1:4000/v4/perception/speed-sign')
    parser.add_argument('--model', required=True, help='Traffic-sign YOLO model whose labels contain speed_limit_XX')
    parser.add_argument('--source', default='0')
    parser.add_argument('--camera-id', default='front-sign-camera')
    parser.add_argument('--fov', type=float, default=78.0)
    parser.add_argument('--fps', type=float, default=5.0)
    parser.add_argument('--token', default='')
    args = parser.parse_args()

    source: int | str = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise RuntimeError(f'Unable to open camera source: {args.source}')
    model = YOLO(args.model)
    period = 1.0 / max(args.fps, 1.0)
    session = requests.Session()
    if args.token:
        session.headers['x-kingmast-edge-token'] = args.token

    try:
        while True:
            started = time.monotonic()
            ok, frame = capture.read()
            if ok:
                observation = extract_observation(model, frame, args.camera_id, args.fov)
                if observation is not None:
                    try:
                        session.post(args.api, json=observation, timeout=0.8).raise_for_status()
                    except requests.RequestException as exc:
                        print(f'speed-sign publish warning: {exc}')
            sleep_for = period - (time.monotonic() - started)
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        capture.release()
        session.close()


if __name__ == '__main__':
    main()
