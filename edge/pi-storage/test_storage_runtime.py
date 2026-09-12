from __future__ import annotations

import json
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

    def test_restart_repairs_partial_tail_from_interrupted_write(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            root.mkdir(exist_ok=True)
            segment = root / 'segment-00000000000000000001-000001.jsonl'
            good = json.dumps({'index': 1}, separators=(',', ':')).encode('utf-8') + b'\n'
            partial = b'{"index":2,"payload":"cut-by-power-loss"'
            segment.write_bytes(good + partial)
            usage = SimpleNamespace(total=100_000, free=90_000, used=10_000)
            store = AdaptiveJsonlRingStore(
                root,
                requested_percent=50,
                reserve_percent=5,
                segment_bytes=4096,
                max_record_bytes=1024,
                disk_usage_fn=lambda _: usage,
            )
            status = store.status()
            self.assertEqual(segment.read_bytes(), good)
            self.assertEqual(status['recoveredSegments'], 1)
            self.assertEqual(status['discardedPartialBytes'], len(partial))
            self.assertTrue(status['fsyncPerRecord'])
            store.append({'index': 3})
            lines = [
                json.loads(line)
                for path in sorted(root.glob('segment-*.jsonl'), key=lambda item: item.name)
                for line in path.read_text().splitlines()
            ]
            self.assertEqual([item['index'] for item in lines], [1, 3])

    def test_restart_truncates_from_first_corrupt_complete_line(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            segment = root / 'segment-00000000000000000001-000001.jsonl'
            valid = b'{"index":1}\n'
            corrupt = b'{not-json}\n'
            later = b'{"index":3}\n'
            segment.write_bytes(valid + corrupt + later)
            usage = SimpleNamespace(total=100_000, free=90_000, used=10_000)
            store = AdaptiveJsonlRingStore(root, requested_percent=50, reserve_percent=5, disk_usage_fn=lambda _: usage)
            status = store.status()
            self.assertEqual(segment.read_bytes(), valid)
            self.assertEqual(status['recoveredSegments'], 1)
            self.assertEqual(status['discardedPartialBytes'], len(corrupt) + len(later))

    def test_reserved_capacity_fails_closed_when_no_segment_can_be_pruned(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            usage = SimpleNamespace(total=10_000, free=500, used=9_500)
            store = AdaptiveJsonlRingStore(
                root,
                requested_percent=15,
                reserve_percent=10,
                segment_bytes=1024,
                max_record_bytes=1024,
                disk_usage_fn=lambda _: usage,
            )
            with self.assertRaisesRegex(RuntimeError, 'storage-capacity-reserved'):
                store.append({'payload': 'x' * 100})
            self.assertEqual(store.status()['writeErrors'], 1)

    def test_mount_or_disk_usage_error_is_visible(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            def unavailable(_: object) -> object:
                raise OSError('sd-card-unmounted')

            store = AdaptiveJsonlRingStore(Path(tmp), disk_usage_fn=unavailable)
            with self.assertRaisesRegex(OSError, 'sd-card-unmounted'):
                store.status()


if __name__ == '__main__':
    unittest.main()
