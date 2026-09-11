import json
import unittest

from inference_runtime import InferenceRuntimeConfig
from runtime_metadata import build_startup_record, source_kind, publish_error_label
from thermal_runtime import ThermalSnapshot


class RuntimeMetadataTests(unittest.TestCase):
    def test_transport_exception_does_not_expose_url_or_token(self) -> None:
        error = RuntimeError('https://user:password@api.local/?token=secret')
        self.assertEqual(publish_error_label(error), 'RuntimeError')

    def test_classifies_source_without_exposing_rtsp_credentials(self) -> None:
        source = 'rtsp://driver:secret-token@camera.local/live'
        record = build_startup_record(
            camera_id='front',
            source=source,
            model='/models/yolo11n.pt',
            requested_fps=10,
            inference=InferenceRuntimeConfig(),
            thermal=ThermalSnapshot('normal', 62.0, 1.0),
        )
        serialized = json.dumps(record)
        self.assertEqual(record['sourceKind'], 'rtsp')
        self.assertNotIn('driver', serialized)
        self.assertNotIn('secret-token', serialized)
        self.assertNotIn('camera.local', serialized)
        self.assertEqual(record['controlAuthority'], 'none')
        self.assertFalse(record['storesRawVideo'])

    def test_source_kind_covers_camera_index_and_paths(self) -> None:
        self.assertEqual(source_kind('0'), 'camera-index')
        self.assertEqual(source_kind('/dev/video0'), 'file-or-device')
        self.assertEqual(source_kind('https://camera.example/frame'), 'url')


if __name__ == '__main__':
    unittest.main()
