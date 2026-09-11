from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import threading
import time
from typing import Any


@dataclass(frozen=True)
class CapturedFrame:
    frame: Any
    captured_at_ms: int
    captured_monotonic: float


class LatestFrameBuffer:
    """Small drop-oldest buffer so inference stays close to the live camera."""

    def __init__(self, capacity: int = 2) -> None:
        if capacity < 1 or capacity > 8:
            raise ValueError('capacity must be between 1 and 8')
        self._capacity = capacity
        self._items: deque[CapturedFrame] = deque()
        self._condition = threading.Condition()
        self._closed = False
        self.captured = 0
        self.dropped = 0

    @property
    def depth(self) -> int:
        with self._condition:
            return len(self._items)

    def push(self, frame: Any, captured_at_ms: int | None = None) -> bool:
        captured_at_ms = captured_at_ms if captured_at_ms is not None else int(time.time() * 1000)
        item = CapturedFrame(frame=frame, captured_at_ms=captured_at_ms, captured_monotonic=time.monotonic())
        with self._condition:
            if self._closed:
                return False
            self.captured += 1
            while len(self._items) >= self._capacity:
                self._items.popleft()
                self.dropped += 1
            self._items.append(item)
            self._condition.notify()
            return True

    def get_latest(self, timeout_s: float = 0.5) -> CapturedFrame | None:
        deadline = time.monotonic() + max(0.0, timeout_s)
        with self._condition:
            while not self._items and not self._closed:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._condition.wait(remaining)
            if not self._items:
                return None
            latest = self._items.pop()
            if self._items:
                self.dropped += len(self._items)
                self._items.clear()
            return latest

    def close(self) -> None:
        with self._condition:
            self._closed = True
            self._items.clear()
            self._condition.notify_all()
