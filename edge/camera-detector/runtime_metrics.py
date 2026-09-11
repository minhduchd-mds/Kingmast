from __future__ import annotations

from collections import deque
import math
from typing import Iterable


class RollingLatency:
    def __init__(self, max_samples: int = 256) -> None:
        if max_samples < 8 or max_samples > 4096:
            raise ValueError('max_samples must be between 8 and 4096')
        self._samples: deque[float] = deque(maxlen=max_samples)

    def observe(self, value_ms: float) -> None:
        if math.isfinite(value_ms) and value_ms >= 0:
            self._samples.append(float(value_ms))

    @staticmethod
    def _percentile(values: Iterable[float], ratio: float) -> float | None:
        ordered = sorted(values)
        if not ordered:
            return None
        index = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * ratio) - 1))
        return round(ordered[index], 2)

    def snapshot(self) -> dict[str, float | int | None]:
        samples = list(self._samples)
        average = round(sum(samples) / len(samples), 2) if samples else None
        return {
            'samples': len(samples),
            'averageMs': average,
            'p50Ms': self._percentile(samples, 0.50),
            'p95Ms': self._percentile(samples, 0.95),
            'latestMs': round(samples[-1], 2) if samples else None,
        }
