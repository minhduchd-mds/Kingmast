from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from storage_runtime import AdaptiveJsonlRingStore, compute_storage_plan


class StorageRuntimeTest(unittest.TestCase):
    def test_plan_scales_between_128_and_256_gib_cards(self) -> None:
        gib = 1024 ** 3
        plan128 = compute_storage_plan(128 * gib, 100 * gib, 15, 10)
        plan256 = compute_storage_plan(256 * gib, 200 * gib, 15, 10)
        self.assertEqual(plan128.quota_bytes, int(128 * gib * 0.15))
        self.assertEqual(plan256.quota_bytes, int(256 * gib * 0.15))
        self.assertEqual(plan128.mode, 'ok')
        self.assertEqual(plan256.mode, 'ok')

    def test_plan_marks_degraded_and_critical_free_space(self) -> None:
        self.assertEqual(compute_storage_plan(1000, 140, 15, 10).mode, 'degraded')
        self.assertEqual(compute_storage_plan(1000, 100, 15, 10).mode, 'critical')

    def test_ring_prunes_oldest_segment_when_quota_is_reached(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            usage = SimpleNamespace(total=20_000, free=18_000, used=2_000)
            store = AdaptiveJsonlRingStore(
                root,
                requested_percent=10,
                reserve_percent=5,
                segment_bytes=1024,
                max_record_bytes=1024,
                disk_usage_fn=lambda _: usage,
            )
            for index in range(8):
                store.append({'index': index, 'payload': 'x' * 300})
            status = store.status()
            self.assertLessEqual(status['storeBytes'], status['quotaBytes'])
            self.assertGreaterEqual(status['prunedSegments'], 1)


if __name__ == '__main__':
    unittest.main()
