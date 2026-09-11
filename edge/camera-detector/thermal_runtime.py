from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import math


def read_temperature_c(path: str) -> float | None:
    try:
        raw = Path(path).read_text(encoding='utf-8').strip()
        value = float(raw)
    except (OSError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    if abs(value) > 500:
        value /= 1000.0
    if value < -40 or value > 150:
        return None
    return round(value, 2)


@dataclass(frozen=True)
class ThermalSnapshot:
    state: str
    temperature_c: float | None
    cadence_factor: float


class ThermalGuard:
    def __init__(self, warm_c: float = 75.0, hot_c: float = 82.0, recovery_c: float = 70.0) -> None:
        if not (40 <= recovery_c < warm_c < hot_c <= 110):
            raise ValueError('thermal thresholds must satisfy 40 <= recovery < warm < hot <= 110')
        self.warm_c = warm_c
        self.hot_c = hot_c
        self.recovery_c = recovery_c
        self._state = 'unavailable'
        self._temperature_c: float | None = None

    def observe(self, temperature_c: float | None) -> ThermalSnapshot:
        self._temperature_c = temperature_c
        if temperature_c is None:
            self._state = 'unavailable'
            return self.snapshot()
        if self._state in ('warm', 'hot') and temperature_c <= self.recovery_c:
            self._state = 'normal'
        elif temperature_c >= self.hot_c:
            self._state = 'hot'
        elif temperature_c >= self.warm_c:
            self._state = 'warm'
        elif self._state not in ('warm', 'hot'):
            self._state = 'normal'
        return self.snapshot()

    def snapshot(self) -> ThermalSnapshot:
        factor = 0.5 if self._state == 'hot' else 0.75 if self._state == 'warm' else 1.0
        return ThermalSnapshot(self._state, self._temperature_c, factor)
