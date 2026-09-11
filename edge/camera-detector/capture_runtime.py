from __future__ import annotations

from dataclasses import dataclass
import threading


@dataclass(frozen=True)
class CaptureRecoverySnapshot:
    read_failures: int
    reconnect_attempts: int
    reconnects: int
    consecutive_failures: int


class CaptureRecovery:
    def __init__(self, failure_threshold: int = 10, base_delay_s: float = 0.25, max_delay_s: float = 2.0) -> None:
        if failure_threshold < 1 or failure_threshold > 120:
            raise ValueError('failure_threshold must be 1..120')
        if base_delay_s <= 0 or max_delay_s < base_delay_s or max_delay_s > 10:
            raise ValueError('invalid capture reconnect bounds')
        self.failure_threshold = failure_threshold
        self.base_delay_s = base_delay_s
        self.max_delay_s = max_delay_s
        self._lock = threading.Lock()
        self._read_failures = 0
        self._reconnect_attempts = 0
        self._reconnects = 0
        self._consecutive_failures = 0
        self._backoff_level = 0

    def success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._backoff_level = 0

    def read_failure(self) -> float | None:
        with self._lock:
            self._read_failures += 1
            self._consecutive_failures += 1
            if self._consecutive_failures < self.failure_threshold:
                return None
            self._consecutive_failures = 0
            self._reconnect_attempts += 1
            self._backoff_level = min(8, self._backoff_level + 1)
            return min(self.max_delay_s, self.base_delay_s * (2 ** (self._backoff_level - 1)))

    def reconnect_result(self, opened: bool) -> None:
        with self._lock:
            if opened:
                self._reconnects += 1
                self._backoff_level = 0
                self._consecutive_failures = 0

    def snapshot(self) -> CaptureRecoverySnapshot:
        with self._lock:
            return CaptureRecoverySnapshot(
                read_failures=self._read_failures,
                reconnect_attempts=self._reconnect_attempts,
                reconnects=self._reconnects,
                consecutive_failures=self._consecutive_failures,
            )
