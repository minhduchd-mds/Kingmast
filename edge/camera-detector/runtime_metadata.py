from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from inference_runtime import InferenceRuntimeConfig
from thermal_runtime import ThermalSnapshot


def source_kind(source: str) -> str:
    normalized = source.strip()
    if normalized.isdigit():
        return 'camera-index'
    parsed = urlparse(normalized)
    if parsed.scheme.lower() in ('rtsp', 'rtsps'):
        return 'rtsp'
    if parsed.scheme:
        return 'url'
    return 'file-or-device'


def camera_open_error() -> str:
    # Do not include source URLs, paths, userinfo or token-bearing query strings.
    return 'Unable to open camera source; check camera connectivity and credentials'


def publish_error_label(error: Exception) -> str:
    # Exception messages can contain credential-bearing URLs and request headers.
    return type(error).__name__


def build_startup_record(
    *,
    camera_id: str,
    source: str,
    model: str,
    requested_fps: float,
    inference: InferenceRuntimeConfig,
    thermal: ThermalSnapshot,
) -> dict[str, Any]:
    return {
        'event': 'kingmast-camera-startup',
        'cameraId': camera_id,
        'sourceKind': source_kind(source),
        'model': model.rsplit('/', 1)[-1].rsplit('\\', 1)[-1][:128],
        'requestedFps': round(max(1.0, requested_fps), 2),
        'inferenceRuntime': {
            'imageSize': inference.image_size,
            'device': inference.device or 'auto',
            'halfPrecision': inference.half_precision,
        },
        'thermal': {
            'state': thermal.state,
            'temperatureC': thermal.temperature_c,
            'cadenceFactor': thermal.cadence_factor,
        },
        'storesRawVideo': False,
        'controlAuthority': 'none',
    }
