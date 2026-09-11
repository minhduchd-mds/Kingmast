import unittest

from runtime_metrics import RollingLatency


class RollingLatencyTests(unittest.TestCase):
    def test_tracks_percentiles(self) -> None:
        metrics = RollingLatency(max_samples=8)
        for value in (10, 20, 30, 40, 50, 60, 70, 80):
            metrics.observe(value)
        snapshot = metrics.snapshot()
        self.assertEqual(snapshot['samples'], 8)
        self.assertEqual(snapshot['p50Ms'], 40)
        self.assertEqual(snapshot['p95Ms'], 80)
        self.assertEqual(snapshot['latestMs'], 80)

    def test_discards_invalid_samples_and_bounds_history(self) -> None:
        metrics = RollingLatency(max_samples=8)
        metrics.observe(float('nan'))
        metrics.observe(-1)
        for value in range(20):
            metrics.observe(value)
        snapshot = metrics.snapshot()
        self.assertEqual(snapshot['samples'], 8)
        self.assertEqual(snapshot['latestMs'], 19)
        self.assertEqual(snapshot['averageMs'], 15.5)


if __name__ == '__main__':
    unittest.main()
