import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

from frame_runtime import CapturedFrame


def load_detector():
    # Exercise the actual main loop without a physical camera or installed AI model.
    modules = {name: MagicMock() for name in ('cv2', 'requests', 'requests.adapters', 'ultralytics')}
    modules['requests'].RequestException = RuntimeError
    spec = importlib.util.spec_from_file_location('detector_under_test', Path(__file__).with_name('detector.py'))
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module


class DetectorRuntimeTests(unittest.TestCase):
    def run_frame(self, inference_seconds):
        detector = load_detector()
        clock = [100.0]
        frame = CapturedFrame(object(), 100_000, 100.0)
        buffer = MagicMock()
        buffer.get_latest.side_effect = [frame, KeyboardInterrupt()]
        session = detector.requests.Session.return_value
        session.post.return_value.status_code = 200
        def infer(*args):
            clock[0] += inference_seconds
            return {'cameraId': 'front', 'timestampMs': 100_000, 'detections': []}
        output = io.StringIO()
        with patch.object(sys, 'argv', ['detector']), \
             patch.object(detector, 'LatestFrameBuffer', return_value=buffer), \
             patch.object(detector.threading, 'Thread'), \
             patch.object(detector, 'frame_payload', side_effect=infer), \
             patch.object(detector.time, 'time', side_effect=lambda: clock[0]), \
             patch.object(detector.time, 'monotonic', side_effect=lambda: clock[0]), \
             contextlib.redirect_stdout(output):
            with self.assertRaises(KeyboardInterrupt):
                detector.main()
        return session, output.getvalue()

    def test_slow_inference_is_not_published(self):
        session, output = self.run_frame(0.5)
        session.post.assert_not_called()
        self.assertIn('staleAfterInference', output)
        session.close.assert_called_once()

    def test_fresh_inference_keeps_original_capture_timestamp(self):
        session, _ = self.run_frame(0.2)
        session.post.assert_called_once()
        self.assertEqual(session.post.call_args.kwargs['json']['timestampMs'], 100_000)

    def test_failed_open_does_not_expose_rtsp_credentials(self):
        detector = load_detector()
        detector.cv2.VideoCapture.return_value.isOpened.return_value = False
        with patch.object(sys, 'argv', ['detector', '--source', 'rtsp://driver:password@camera/live?token=secret']):
            with self.assertRaises(RuntimeError) as error:
                detector.main()
        for sensitive in ('password', 'driver', 'token=', 'rtsp://'):
            self.assertNotIn(sensitive, str(error.exception))
