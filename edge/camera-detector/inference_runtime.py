from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

_DEVICE = re.compile(r'^[A-Za-z0-9_.:-]{1,32}$')


@dataclass(frozen=True)
class InferenceRuntimeConfig:
    image_size: int = 640
    device: str | None = None
    half_precision: bool = False

    def __post_init__(self) -> None:
        if self.image_size < 256 or self.image_size > 1280 or self.image_size % 32 != 0:
            raise ValueError('image_size must be a multiple of 32 between 256 and 1280')
        normalized = self.device.strip() if self.device else None
        if normalized is not None and not _DEVICE.fullmatch(normalized):
            raise ValueError('invalid inference device')
        if self.half_precision and (normalized is None or normalized.lower() in ('cpu', 'mps')):
            raise ValueError('half precision requires an explicitly selected CUDA/accelerator device')
        object.__setattr__(self, 'device', normalized)

    def predict_kwargs(self) -> dict[str, Any]:
        values: dict[str, Any] = {'verbose': False, 'imgsz': self.image_size}
        if self.device is not None:
            values['device'] = self.device
        if self.half_precision:
            values['half'] = True
        return values
