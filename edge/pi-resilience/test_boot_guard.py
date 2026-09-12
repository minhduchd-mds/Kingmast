from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from boot_guard import AtomicBootStateStore, BootGuard, RaspberryPiTrybootConfig, read_device_tree_int


class BootGuardTest(unittest.TestCase):
    def test_candidate_never_becomes_known_good_before_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = AtomicBootStateStore(Path(tmp) / 'state.json')
            guard = BootGuard(store)
            staged = guard.stage_candidate(slot='B', partition=3, version='0.0.8-next')
            self.assertEqual(staged.known_good_slot, 'A')
            self.assertEqual(staged.known_good_partition, 2)
            booting = guard.begin_candidate_boot()
            self.assertEqual(booting.phase, 'candidate-booting')
            self.assertEqual(booting.active_slot, 'B')
            self.assertEqual(booting.known_good_slot, 'A')
            accepted = guard.accept_candidate(observed_partition=3, tryboot_active=True)
            self.assertEqual(accepted.phase, 'stable')
            self.assertEqual(accepted.known_good_slot, 'B')
            self.assertEqual(accepted.known_good_partition, 3)

    def test_failed_candidate_rolls_back_to_known_good(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = AtomicBootStateStore(Path(tmp) / 'state.json')
            guard = BootGuard(store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            guard.begin_candidate_boot()
            failed = guard.report_failure('health-window-expired')
            self.assertEqual(failed.phase, 'rollback-required')
            self.assertEqual(failed.active_slot, 'A')
            self.assertEqual(failed.known_good_slot, 'A')
            self.assertEqual(failed.known_good_partition, 2)

    def test_unclean_tryboot_recovery_does_not_promote_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = AtomicBootStateStore(Path(tmp) / 'state.json')
            guard = BootGuard(store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            guard.begin_candidate_boot()
            recovered = guard.recover_after_unclean_boot(observed_partition=2, tryboot_active=False)
            self.assertEqual(recovered.phase, 'rollback-required')
            self.assertEqual(recovered.known_good_slot, 'A')
            self.assertEqual(recovered.last_reason, 'unclean-candidate-boot-or-automatic-tryboot-rollback')

    def test_attempt_budget_blocks_boot_loop(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = AtomicBootStateStore(Path(tmp) / 'state.json')
            guard = BootGuard(store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            first = guard.begin_candidate_boot()
            self.assertEqual(first.candidate_attempts, 1)
            second = guard.begin_candidate_boot()
            self.assertEqual(second.candidate_attempts, 2)
            third = guard.begin_candidate_boot()
            self.assertEqual(third.phase, 'rollback-required')
            self.assertEqual(third.active_slot, 'A')

    def test_state_write_is_valid_json_and_generation_advances(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'state.json'
            store = AtomicBootStateStore(path)
            guard = BootGuard(store)
            state = guard.stage_candidate(slot='B', partition=3, version='candidate')
            raw = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(raw['generation'], state.generation)
            self.assertGreaterEqual(raw['generation'], 1)
            self.assertEqual(raw['controlAuthority'], 'none')

    def test_autoboot_mapping_keeps_default_known_good_and_tryboot_candidate(self) -> None:
        text = RaspberryPiTrybootConfig.render(2, 3)
        self.assertIn('[all]\ntryboot_a_b=1\nboot_partition=2', text)
        self.assertIn('[tryboot]\nboot_partition=3', text)
        self.assertLessEqual(len(text.encode('utf-8')), 512)

    def test_autoboot_rejects_same_partition(self) -> None:
        with self.assertRaises(ValueError):
            RaspberryPiTrybootConfig.render(2, 2)

    def test_device_tree_integer_supports_binary_encoding(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'partition'
            path.write_bytes((3).to_bytes(4, 'big'))
            self.assertEqual(read_device_tree_int(path), 3)


if __name__ == '__main__':
    unittest.main()
