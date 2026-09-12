from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from boot_guard import AtomicBootStateStore, BootGuard
from resilience_agent import HealthCheck, ResilienceAgent


def healthy_service(name: str) -> HealthCheck:
    return HealthCheck(name=f'service:{name}', healthy=True, critical=True, detail='active')


def failed_service(name: str) -> HealthCheck:
    return HealthCheck(name=f'service:{name}', healthy=False, critical=True, detail='inactive')


def healthy_storage(_: str | Path) -> HealthCheck:
    return HealthCheck(name='storage:history', healthy=True, critical=True, detail='free=90%')


def healthy_kernel() -> HealthCheck:
    return HealthCheck(name='kernel:uptime', healthy=True, critical=True, detail='uptime=100s')


class ResilienceAgentTest(unittest.TestCase):
    def build_agent(self, tmp: str, *, service_probe=healthy_service, failure_threshold=3, healthy_cycles=3) -> ResilienceAgent:
        return ResilienceAgent(
            state_dir=Path(tmp) / 'resilience',
            boot_state_path=Path(tmp) / 'boot-state.json',
            required_services=['kingmast-pi-history.service'],
            storage_dir=Path(tmp) / 'storage',
            failure_threshold=failure_threshold,
            healthy_candidate_cycles=healthy_cycles,
            service_probe=service_probe,
            storage_probe=healthy_storage,
            liveness_probe=healthy_kernel,
        )

    def test_healthy_platform_does_not_request_reboot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            agent = self.build_agent(tmp)
            snapshot = agent.evaluate_once()
            self.assertTrue(snapshot['healthy'])
            self.assertIsNone(snapshot['recoveryRequest'])
            self.assertEqual(snapshot['controlAuthority'], 'none')

    def test_stable_os_requests_known_good_reboot_after_failure_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            agent = self.build_agent(tmp, service_probe=failed_service, failure_threshold=2)
            first = agent.evaluate_once()
            self.assertIsNone(first['recoveryRequest'])
            second = agent.evaluate_once()
            self.assertEqual(second['recoveryRequest']['action'], 'reboot-known-good')
            request = json.loads((Path(tmp) / 'resilience' / 'recovery-request.json').read_text(encoding='utf-8'))
            self.assertEqual(request['reason'], 'critical-platform-health-failed')
            self.assertEqual(request['controlAuthority'], 'none')

    def test_candidate_failure_requests_rollback_to_known_good(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            boot_store = AtomicBootStateStore(Path(tmp) / 'boot-state.json')
            guard = BootGuard(boot_store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            guard.begin_candidate_boot()
            agent = self.build_agent(tmp, service_probe=failed_service, failure_threshold=1)
            snapshot = agent.evaluate_once()
            self.assertEqual(snapshot['recoveryRequest']['action'], 'rollback-reboot-known-good')
            self.assertEqual(snapshot['bootPhase'], 'candidate-booting')

    def test_candidate_requires_health_window_before_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            boot_store = AtomicBootStateStore(Path(tmp) / 'boot-state.json')
            guard = BootGuard(boot_store)
            guard.stage_candidate(slot='B', partition=3, version='candidate')
            guard.begin_candidate_boot()
            agent = self.build_agent(tmp, healthy_cycles=3)
            self.assertFalse(agent.evaluate_once()['candidateReadyForAcceptance'])
            self.assertFalse(agent.evaluate_once()['candidateReadyForAcceptance'])
            self.assertTrue(agent.evaluate_once()['candidateReadyForAcceptance'])

    def test_transient_failure_resets_after_healthy_cycle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            calls = {'count': 0}

            def flaky(name: str) -> HealthCheck:
                calls['count'] += 1
                return failed_service(name) if calls['count'] == 1 else healthy_service(name)

            agent = self.build_agent(tmp, service_probe=flaky, failure_threshold=2)
            self.assertFalse(agent.evaluate_once()['healthy'])
            second = agent.evaluate_once()
            self.assertTrue(second['healthy'])
            self.assertEqual(second['consecutiveFailures'], 0)
            self.assertIsNone(second['recoveryRequest'])


if __name__ == '__main__':
    unittest.main()
