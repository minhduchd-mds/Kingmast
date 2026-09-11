import unittest

from capture_runtime import CaptureRecovery


class CaptureRecoveryTests(unittest.TestCase):
    def test_reconnect_starts_only_after_failure_threshold(self) -> None:
        recovery = CaptureRecovery(failure_threshold=3, base_delay_s=0.25, max_delay_s=1.0)
        self.assertIsNone(recovery.read_failure())
        self.assertIsNone(recovery.read_failure())
        self.assertEqual(recovery.read_failure(), 0.25)
        snapshot = recovery.snapshot()
        self.assertEqual(snapshot.read_failures, 3)
        self.assertEqual(snapshot.reconnect_attempts, 1)

    def test_failed_reconnects_back_off_with_a_cap(self) -> None:
        recovery = CaptureRecovery(failure_threshold=1, base_delay_s=0.25, max_delay_s=1.0)
        delays = []
        for _ in range(5):
            delays.append(recovery.read_failure())
            recovery.reconnect_result(False)
        self.assertEqual(delays, [0.25, 0.5, 1.0, 1.0, 1.0])

    def test_success_resets_reconnect_backoff_and_counts_recovery(self) -> None:
        recovery = CaptureRecovery(failure_threshold=1, base_delay_s=0.25, max_delay_s=1.0)
        self.assertEqual(recovery.read_failure(), 0.25)
        recovery.reconnect_result(True)
        recovery.success()
        self.assertEqual(recovery.snapshot().reconnects, 1)
        self.assertEqual(recovery.read_failure(), 0.25)


if __name__ == '__main__':
    unittest.main()
