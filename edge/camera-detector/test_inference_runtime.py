import unittest

from inference_runtime import InferenceRuntimeConfig


class InferenceRuntimeConfigTests(unittest.TestCase):
    def test_builds_portable_cpu_defaults(self) -> None:
        config = InferenceRuntimeConfig()
        self.assertEqual(config.predict_kwargs(), {'verbose': False, 'imgsz': 640})

    def test_allows_explicit_accelerator_and_half_precision(self) -> None:
        config = InferenceRuntimeConfig(image_size=512, device='0', half_precision=True)
        self.assertEqual(config.predict_kwargs(), {'verbose': False, 'imgsz': 512, 'device': '0', 'half': True})

    def test_rejects_unbounded_or_unaligned_image_sizes(self) -> None:
        for image_size in (128, 650, 2048):
            with self.assertRaises(ValueError):
                InferenceRuntimeConfig(image_size=image_size)

    def test_half_precision_fails_closed_without_accelerator(self) -> None:
        for device in (None, 'cpu', 'mps'):
            with self.assertRaises(ValueError):
                InferenceRuntimeConfig(device=device, half_precision=True)


if __name__ == '__main__':
    unittest.main()
