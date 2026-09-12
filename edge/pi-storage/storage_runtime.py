from __future__ import annotations

from dataclasses import dataclass, asdict
import json
import os
from pathlib import Path
import shutil
import time
from typing import Any, Callable


@dataclass(frozen=True)
class StoragePlan:
    total_bytes: int
    free_bytes: int
    quota_bytes: int
    reserve_bytes: int
    requested_percent: float
    reserve_percent: float
    mode: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _bounded_percent(name: str, value: float, minimum: float, maximum: float) -> float:
    parsed = float(value)
    if not minimum <= parsed <= maximum:
        raise ValueError(f'{name} must be between {minimum} and {maximum}')
    return parsed


def compute_storage_plan(
    total_bytes: int,
    free_bytes: int,
    requested_percent: float = 15.0,
    reserve_percent: float = 10.0,
) -> StoragePlan:
    if total_bytes <= 0:
        raise ValueError('total_bytes must be positive')
    if free_bytes < 0 or free_bytes > total_bytes:
        raise ValueError('free_bytes must be between 0 and total_bytes')
    requested = _bounded_percent('requested_percent', requested_percent, 1.0, 80.0)
    reserve = _bounded_percent('reserve_percent', reserve_percent, 5.0, 30.0)
    if requested + reserve > 90.0:
        raise ValueError('requested_percent + reserve_percent must not exceed 90')

    quota_bytes = int(total_bytes * requested / 100.0)
    reserve_bytes = int(total_bytes * reserve / 100.0)
    free_ratio = (free_bytes / total_bytes) * 100.0
    if free_ratio <= reserve:
        mode = 'critical'
    elif free_ratio <= reserve + 5.0:
        mode = 'degraded'
    else:
        mode = 'ok'
    return StoragePlan(
        total_bytes=total_bytes,
        free_bytes=free_bytes,
        quota_bytes=quota_bytes,
        reserve_bytes=reserve_bytes,
        requested_percent=requested,
        reserve_percent=reserve,
        mode=mode,
    )


class AdaptiveJsonlRingStore:
    """Bounded JSONL ring store sized from the mounted filesystem, not a hard-coded card size."""

    def __init__(
        self,
        root: str | Path,
        *,
        requested_percent: float = 15.0,
        reserve_percent: float = 10.0,
        segment_bytes: int = 64 * 1024 * 1024,
        max_record_bytes: int = 128 * 1024,
        disk_usage_fn: Callable[[str | Path], Any] = shutil.disk_usage,
    ) -> None:
        self.root = Path(root)
        self.requested_percent = _bounded_percent('requested_percent', requested_percent, 1.0, 80.0)
        self.reserve_percent = _bounded_percent('reserve_percent', reserve_percent, 5.0, 30.0)
        if self.requested_percent + self.reserve_percent > 90.0:
            raise ValueError('requested_percent + reserve_percent must not exceed 90')
        if segment_bytes < 1024 or segment_bytes > 1024 * 1024 * 1024:
            raise ValueError('segment_bytes must be between 1 KiB and 1 GiB')
        if max_record_bytes < 1024 or max_record_bytes > 1024 * 1024:
            raise ValueError('max_record_bytes must be between 1 KiB and 1 MiB')
        self.segment_bytes = int(segment_bytes)
        self.max_record_bytes = int(max_record_bytes)
        self._disk_usage_fn = disk_usage_fn
        self._current: Path | None = None
        self._counter = 0
        self._written = 0
        self._pruned = 0
        self._write_errors = 0
        self._recovered_segments = 0
        self._discarded_partial_bytes = 0
        self._recovery_checked = False

    def _segments(self) -> list[Path]:
        return sorted(self.root.glob('segment-*.jsonl'), key=lambda path: path.name)

    def _usage_bytes(self) -> int:
        total = 0
        for path in self._segments():
            try:
                total += path.stat().st_size
            except FileNotFoundError:
                continue
        return total

    def _plan(self) -> StoragePlan:
        usage = self._disk_usage_fn(self.root)
        return compute_storage_plan(
            int(usage.total),
            int(usage.free),
            self.requested_percent,
            self.reserve_percent,
        )

    def _repair_interrupted_segments(self) -> None:
        if self._recovery_checked:
            return
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        for path in self._segments():
            try:
                data = path.read_bytes()
            except FileNotFoundError:
                continue
            if not data:
                continue
            valid_end = 0
            offset = 0
            for raw_line in data.splitlines(keepends=True):
                next_offset = offset + len(raw_line)
                if not raw_line.endswith(b'\n'):
                    break
                payload = raw_line[:-1].strip()
                if not payload:
                    break
                try:
                    parsed = json.loads(payload.decode('utf-8'))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    break
                if not isinstance(parsed, dict):
                    break
                valid_end = next_offset
                offset = next_offset
            if valid_end == len(data):
                continue
            discarded = len(data) - valid_end
            with path.open('r+b') as handle:
                handle.truncate(valid_end)
                handle.flush()
                os.fsync(handle.fileno())
            self._recovered_segments += 1
            self._discarded_partial_bytes += discarded
        self._recovery_checked = True

    def _new_segment(self) -> Path:
        self._counter = (self._counter + 1) % 1_000_000
        path = self.root / f'segment-{time.time_ns():020d}-{self._counter:06d}.jsonl'
        path.touch(mode=0o600, exist_ok=False)
        self._current = path
        return path

    def _ensure_capacity(self, incoming_bytes: int) -> StoragePlan:
        while True:
            plan = self._plan()
            used = self._usage_bytes()
            reserve_violation = plan.free_bytes - incoming_bytes < plan.reserve_bytes
            quota_violation = used + incoming_bytes > plan.quota_bytes
            if not reserve_violation and not quota_violation:
                return plan
            segments = self._segments()
            removable = [path for path in segments if self._current is None or path != self._current]
            if not removable and self._current is not None:
                removable = [self._current]
            if not removable:
                raise RuntimeError('storage-capacity-reserved')
            victim = removable[0]
            try:
                victim.unlink()
            except FileNotFoundError:
                pass
            if self._current == victim:
                self._current = None
            self._pruned += 1

    def append(self, record: dict[str, Any]) -> dict[str, Any]:
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._repair_interrupted_segments()
        line = (json.dumps(record, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode('utf-8')
        if len(line) > self.max_record_bytes:
            raise ValueError('record exceeds max_record_bytes')
        try:
            plan = self._ensure_capacity(len(line))
            if self._current is None or not self._current.exists() or self._current.stat().st_size + len(line) > self.segment_bytes:
                self._new_segment()
            assert self._current is not None
            with self._current.open('ab') as handle:
                handle.write(line)
                handle.flush()
                os.fsync(handle.fileno())
            self._written += 1
            return {'stored': True, 'mode': plan.mode, 'segment': self._current.name}
        except Exception:
            self._write_errors += 1
            raise

    def status(self) -> dict[str, Any]:
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._repair_interrupted_segments()
        plan = self._plan()
        segments = self._segments()
        used = self._usage_bytes()
        return {
            'enabled': True,
            'root': str(self.root),
            'mode': plan.mode,
            'totalBytes': plan.total_bytes,
            'freeBytes': plan.free_bytes,
            'quotaBytes': plan.quota_bytes,
            'reserveBytes': plan.reserve_bytes,
            'storeBytes': used,
            'segmentCount': len(segments),
            'segmentBytes': self.segment_bytes,
            'writtenRecords': self._written,
            'prunedSegments': self._pruned,
            'writeErrors': self._write_errors,
            'recoveredSegments': self._recovered_segments,
            'discardedPartialBytes': self._discarded_partial_bytes,
            'fsyncPerRecord': True,
            'controlAuthority': 'none',
        }
