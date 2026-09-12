from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from typing import Any, Callable

from boot_guard import AtomicBootStateStore


@dataclass(frozen=True)
class HealthCheck:
    name: str
    healthy: bool
    critical: bool
    detail: str


class AtomicJsonWriter:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def write(self, payload: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        raw = (json.dumps(payload, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')
        fd, tmp_name = tempfile.mkstemp(prefix=f'.{self.path.name}.', dir=self.path.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'wb', closefd=True) as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_name, self.path)
            dir_fd = os.open(self.path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        finally:
            try:
                os.unlink(tmp_name)
            except FileNotFoundError:
                pass


def sd_notify(message: str, notify_socket: str | None = None) -> bool:
    address = notify_socket if notify_socket is not None else os.getenv('NOTIFY_SOCKET', '')
    if not address:
        return False
    if address.startswith('@'):
        address = '\0' + address[1:]
    client = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        client.connect(address)
        client.sendall(message.encode('utf-8'))
        return True
    finally:
        client.close()


def service_check(name: str, runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run) -> HealthCheck:
    if not name or '/' in name or '\\' in name or len(name) > 128:
        return HealthCheck(name=f'service:{name}', healthy=False, critical=True, detail='invalid-service-name')
    result = runner(
        ['/usr/bin/systemctl', 'is-active', '--quiet', name],
        text=True,
        capture_output=True,
        timeout=3,
        check=False,
    )
    return HealthCheck(
        name=f'service:{name}',
        healthy=result.returncode == 0,
        critical=True,
        detail='active' if result.returncode == 0 else f'inactive-rc-{result.returncode}',
    )


def storage_check(path: str | Path, min_free_percent: float = 5.0) -> HealthCheck:
    root = Path(path)
    try:
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        stats = os.statvfs(root)
        total = stats.f_blocks * stats.f_frsize
        available = stats.f_bavail * stats.f_frsize
        if total <= 0:
            raise RuntimeError('zero-capacity-filesystem')
        free_percent = available * 100.0 / total
        probe = root / '.kingmast-health-probe'
        with probe.open('ab') as handle:
            handle.write(b'')
            handle.flush()
        probe.unlink(missing_ok=True)
        healthy = free_percent >= min_free_percent
        return HealthCheck(
            name='storage:history',
            healthy=healthy,
            critical=True,
            detail=f'free={free_percent:.2f}%',
        )
    except Exception as exc:
        return HealthCheck(name='storage:history', healthy=False, critical=True, detail=f'{type(exc).__name__}:{exc}')


def kernel_liveness_check() -> HealthCheck:
    try:
        uptime = float(Path('/proc/uptime').read_text(encoding='ascii').split()[0])
        return HealthCheck(name='kernel:uptime', healthy=uptime >= 0.0, critical=True, detail=f'uptime={uptime:.1f}s')
    except Exception as exc:
        return HealthCheck(name='kernel:uptime', healthy=False, critical=True, detail=f'{type(exc).__name__}:{exc}')


class ResilienceAgent:
    def __init__(
        self,
        *,
        state_dir: str | Path,
        boot_state_path: str | Path,
        required_services: list[str],
        storage_dir: str | Path,
        failure_threshold: int = 3,
        healthy_candidate_cycles: int = 12,
        service_probe: Callable[[str], HealthCheck] = service_check,
        storage_probe: Callable[[str | Path], HealthCheck] = storage_check,
        liveness_probe: Callable[[], HealthCheck] = kernel_liveness_check,
    ) -> None:
        if not 1 <= failure_threshold <= 20:
            raise ValueError('failure_threshold must be 1..20')
        if not 3 <= healthy_candidate_cycles <= 120:
            raise ValueError('healthy_candidate_cycles must be 3..120')
        self.state_dir = Path(state_dir)
        self.boot_store = AtomicBootStateStore(boot_state_path)
        self.required_services = list(dict.fromkeys(required_services))
        self.storage_dir = Path(storage_dir)
        self.failure_threshold = failure_threshold
        self.healthy_candidate_cycles = healthy_candidate_cycles
        self.service_probe = service_probe
        self.storage_probe = storage_probe
        self.liveness_probe = liveness_probe
        self.consecutive_failures = 0
        self.consecutive_healthy = 0
        self.recovery_generation = 0
        self.health_writer = AtomicJsonWriter(self.state_dir / 'health.json')
        self.request_writer = AtomicJsonWriter(self.state_dir / 'recovery-request.json')

    def collect(self) -> list[HealthCheck]:
        checks = [self.liveness_probe(), self.storage_probe(self.storage_dir)]
        checks.extend(self.service_probe(name) for name in self.required_services)
        return checks

    def _request_recovery(self, action: str, reason: str, checks: list[HealthCheck]) -> dict[str, Any]:
        self.recovery_generation += 1
        request = {
            'schema': 'kingmast-platform-recovery-request/v1',
            'generation': self.recovery_generation,
            'createdAtMs': int(time.time() * 1000),
            'action': action,
            'reason': reason,
            'failedChecks': [asdict(item) for item in checks if not item.healthy],
            'controlAuthority': 'none',
        }
        self.request_writer.write(request)
        return request

    def evaluate_once(self) -> dict[str, Any]:
        checks = self.collect()
        critical_failures = [item for item in checks if item.critical and not item.healthy]
        healthy = not critical_failures
        if healthy:
            self.consecutive_failures = 0
            self.consecutive_healthy += 1
        else:
            self.consecutive_healthy = 0
            self.consecutive_failures += 1

        boot = self.boot_store.load()
        recovery: dict[str, Any] | None = None
        candidate_ready = boot.phase == 'candidate-booting' and self.consecutive_healthy >= self.healthy_candidate_cycles
        if self.consecutive_failures >= self.failure_threshold:
            if boot.phase in {'candidate-staged', 'candidate-booting'}:
                action = 'rollback-reboot-known-good'
                reason = 'candidate-health-window-failed'
            else:
                action = 'reboot-known-good'
                reason = 'critical-platform-health-failed'
            recovery = self._request_recovery(action, reason, checks)
            self.consecutive_failures = 0

        snapshot = {
            'schema': 'kingmast-platform-health/v1',
            'timestampMs': int(time.time() * 1000),
            'healthy': healthy,
            'consecutiveHealthy': self.consecutive_healthy,
            'consecutiveFailures': self.consecutive_failures,
            'candidateReadyForAcceptance': candidate_ready,
            'bootPhase': boot.phase,
            'knownGoodSlot': boot.known_good_slot,
            'checks': [asdict(item) for item in checks],
            'recoveryRequest': recovery,
            'controlAuthority': 'none',
        }
        self.health_writer.write(snapshot)
        status = 'healthy' if healthy else 'degraded'
        sd_notify(f'WATCHDOG=1\nSTATUS=KINGMAST platform {status}; boot={boot.phase}')
        return snapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='KINGMAST platform resilience/watchdog agent')
    parser.add_argument('--state-dir', default=os.getenv('KINGMAST_RESILIENCE_STATE_DIR', '/var/lib/kingmast/resilience'))
    parser.add_argument('--boot-state', default=os.getenv('KINGMAST_BOOT_STATE', '/var/lib/kingmast/recovery/boot-state.json'))
    parser.add_argument('--storage-dir', default=os.getenv('KINGMAST_HISTORY_STORAGE_DIR', '/mnt/kingmast-sd/history'))
    parser.add_argument('--services', default=os.getenv('KINGMAST_REQUIRED_SERVICES', 'kingmast-pi-history.service'))
    parser.add_argument('--interval', type=float, default=float(os.getenv('KINGMAST_HEALTH_INTERVAL_SEC', '5')))
    parser.add_argument('--failure-threshold', type=int, default=int(os.getenv('KINGMAST_FAILURE_THRESHOLD', '3')))
    parser.add_argument('--candidate-health-cycles', type=int, default=int(os.getenv('KINGMAST_CANDIDATE_HEALTH_CYCLES', '12')))
    parser.add_argument('--once', action='store_true')
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not 1.0 <= args.interval <= 60.0:
        raise RuntimeError('health interval must be 1..60 seconds')
    services = [item.strip() for item in args.services.split(',') if item.strip()]
    agent = ResilienceAgent(
        state_dir=args.state_dir,
        boot_state_path=args.boot_state,
        required_services=services,
        storage_dir=args.storage_dir,
        failure_threshold=args.failure_threshold,
        healthy_candidate_cycles=args.candidate_health_cycles,
    )
    sd_notify('READY=1\nSTATUS=KINGMAST platform resilience agent ready')
    while True:
        snapshot = agent.evaluate_once()
        if args.once:
            print(json.dumps(snapshot, separators=(',', ':')))
            return
        time.sleep(args.interval)


if __name__ == '__main__':
    main()
