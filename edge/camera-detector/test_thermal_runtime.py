import tempfile
import unittest
from pathlib import Path

from thermal_runtime import ThermalGuard, read_temperature_c


class ThermalRuntimeTests(unittest.TestCase):
    def test_reads_linux_millidegree_temperature(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'temp'
            path.write_text('76500\n', encoding='utf-8')
            self.assertEqual(read_temperature_c(str(path)), 76.5)

    def test_missing_or_invalid_temperature_is_unavailable(self) -> None:
        self.assertIsNone(read_temperature_c('/missing/kingmast/temperature'))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'temp'
            path.write_text('not-a-number', encoding='utf-8')
            self.assertIsNone(read_temperature_c(str(path)))

    def test_warm_and_hot_states_reduce_cadence_with_recovery_hysteresis(self) -> None:
        guard = ThermalGuard(warm_c=75, hot_c=82, recovery_c=70)
        self.assertEqual(guard.observe(65).state, 'normal')
        self.assertEqual(guard.observe(76).cadence_factor, 0.75)
        self.assertEqual(guard.observe(83).cadence_factor, 0.5)
        self.assertEqual(guard.observe(74).state, 'hot')
        recovered = guard.observe(69)
        self.assertEqual(recovered.state, 'normal')
        self.assertEqual(recovered.cadence_factor, 1.0)


if __name__ == '__main__':
    unittest.main()
