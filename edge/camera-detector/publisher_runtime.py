from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class PublishOutcome:
    disposition: str
    status_code: int | None
    retry_after_s: float
    accepted: bool


def _bounded_retry_after(value: str | None) -> float:
    if value is None:
        return 0.0
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(parsed):
        return 0.0
    return max(0.0, min(5.0, parsed))


def classify_http_response(status_code: int, retry_after: str | None = None) -> PublishOutcome:
    if 200 <= status_code < 300:
        return PublishOutcome('accepted', status_code, 0.0, True)
    if status_code == 429:
        return PublishOutcome('backpressure', status_code, _bounded_retry_after(retry_after), False)
    if status_code == 409:
        return PublishOutcome('rejected-current-frame', status_code, 0.0, False)
    if status_code in (401, 403):
        return PublishOutcome('authentication-rejected', status_code, 0.0, False)
    if 500 <= status_code < 600:
        return PublishOutcome('server-unavailable', status_code, 0.0, False)
    return PublishOutcome('request-rejected', status_code, 0.0, False)


def transport_failure() -> PublishOutcome:
    return PublishOutcome('transport-error', None, 0.0, False)


class PublishBackoff:
    """Back off between fresh frames; never retry the same signed payload."""

    def __init__(self, base_s: float = 0.1, max_s: float = 2.0) -> None:
        if base_s <= 0 or max_s < base_s or max_s > 10:
            raise ValueError('invalid publish backoff bounds')
        self.base_s = base_s
        self.max_s = max_s
        self.failures = 0

    def success(self) -> None:
        self.failures = 0

    def delay_for(self, outcome: PublishOutcome) -> float:
        if outcome.accepted:
            self.success()
            return 0.0
        if outcome.disposition == 'rejected-current-frame':
            return 0.0
        self.failures = min(8, self.failures + 1)
        exponential = min(self.max_s, self.base_s * (2 ** (self.failures - 1)))
        return max(exponential, outcome.retry_after_s)
