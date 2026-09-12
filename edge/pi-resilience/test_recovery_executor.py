from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest

from boot_guard import AtomicBootStateStore, BootGuard
from recovery_executor import RecoveryExecutor


class RecoveryExecutorTest(unittest.TestCase):
    def write_request(self, path: Path, *, generation: int, action: str) -> None:
        path.write_text(json.dumps({
            'schema': 'kingmast-platform-recovery-request/v1',
            'generation': generation,
            'createdAtMs': 1,
            'action': action,
            'reason': 'test',
            'failedChecks': [],
            'controlAuthority': 'none',
        }), encoding='utf-8')
        path.chmod(0o600)

    def build_executor(self, tmp: str, *, now: float = 1000.0) -> RecoveryExecutor:
        root = Path(tmp)
        return RecoveryExecutor(
            request_path=root / 'request.json',
            processed_path=root / 'receipt.json',
            boot_state_path=root / 'boot-state.json',
            autoboot_path=root / 'autoboot.txt',
            slot_a_partition=2,
            slot_b_partition=3,
            trusted_uid=os.getuid(),
            cooldown_seconds=120,
            runner=lambda *args, **kwargs: None,
            now_fn=lambda: now,
        )

    def test_reboot_known_good_writes_default_partition_without_vehicle_authority(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_request(root / 'request.json', generation=1, action='reboot-known-good')
            executor = self.build_executor(tmp)
            result = executor.execute_once(execute_reboot=False)
            self.assertTrue(result['executed'])
            self.assertEqual(result['knownGoodPartition'], 2)
            self.assertEqual(result['controlAuthority'], 'none')
            autoboot = (root / 'autoboot.txt').read_text(encoding='ascii')
            self.assertIn('boot_partition=2', autoboot)
            self.assertIn('[tryboot]\nboot_partition=3', autoboot)

    def test_candidate_failure_marks_rollback_before_reboot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            store = AtomicBootStateStore(root / 'boot-state.json')
            guard = BootGuard(store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            guard.begin_candidate_boot()
            self.write_request(root / 'request.json', generation=1, action='rollback-reboot-known-good')
            executor = self.build_executor(tmp)
            result = executor.execute_once(execute_reboot=False)
            self.assertTrue(result['executed'])
            state = store.load()
            self.assertEqual(state.phase, 'rollback-required')
            self.assertEqual(state.known_good_slot, 'A')
            self.assertEqual(state.known_good_partition, 2)

    def test_same_generation_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_request(root / 'request.json', generation=1, action='reboot-known-good')
            executor = self.build_executor(tmp)
            self.assertTrue(executor.execute_once(execute_reboot=False)['executed'])
            second = executor.execute_once(execute_reboot=False)
            self.assertFalse(second['executed'])
            self.assertEqual(second['reason'], 'already-processed')

    def test_cooldown_blocks_reboot_storm(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_request(root / 'request.json', generation=1, action='reboot-known-good')
            first = self.build_executor(tmp, now=1000.0)
            self.assertTrue(first.execute_once(execute_reboot=False)['executed'])
            self.write_request(root / 'request.json', generation=2, action='reboot-known-good')
            second = self.build_executor(tmp, now=1050.0)
            result = second.execute_once(execute_reboot=False)
            self.assertFalse(result['executed'])
            self.assertEqual(result['reason'], 'cooldown-active')

    def test_untrusted_or_writable_request_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_request(root / 'request.json', generation=1, action='reboot-known-good')
            (root / 'request.json').chmod(0o622)
            executor = self.build_executor(tmp)
            with self.assertRaises(PermissionError):
                executor.execute_once(execute_reboot=False)

    def test_unknown_action_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_request(root / 'request.json', generation=1, action='run-arbitrary-shell')
            executor = self.build_executor(tmp)
            with self.assertRaises(ValueError):
                executor.execute_once(execute_reboot=False)


if __name__ == '__main__':
    unittest.main()
