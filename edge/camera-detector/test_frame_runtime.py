import unittest
from unittest.mock import patch

from frame_runtime import LatestFrameBuffer, CapturedFrame, frame_is_fresh


class LatestFrameBufferTests(unittest.TestCase):
    def test_clock_rollback_does_not_refresh_old_frame(self) -> None:
        frame = CapturedFrame('frame', 100_000, 10.0)
        with patch('frame_runtime.time.time', return_value=100.1), patch('frame_runtime.time.monotonic', return_value=11.0):
            self.assertFalse(frame_is_fresh(frame, 350))

    def test_drops_oldest_when_full(self) -> None:
        buffer = LatestFrameBuffer(capacity=2)
        self.assertTrue(buffer.push('frame-1', 1000))
        self.assertTrue(buffer.push('frame-2', 1010))
        self.assertTrue(buffer.push('frame-3', 1020))

        latest = buffer.get_latest(0)
        self.assertIsNotNone(latest)
        assert latest is not None
        self.assertEqual(latest.frame, 'frame-3')
        self.assertEqual(latest.captured_at_ms, 1020)
        self.assertEqual(buffer.captured, 3)
        self.assertEqual(buffer.dropped, 2)
        self.assertEqual(buffer.depth, 0)

    def test_rejects_invalid_capacity(self) -> None:
        for capacity in (0, 9):
            with self.assertRaises(ValueError):
                LatestFrameBuffer(capacity=capacity)

    def test_closed_buffer_does_not_accept_new_frames(self) -> None:
        buffer = LatestFrameBuffer(capacity=1)
        buffer.close()
        self.assertFalse(buffer.push('frame'))
        self.assertIsNone(buffer.get_latest(0))


if __name__ == '__main__':
    unittest.main()
