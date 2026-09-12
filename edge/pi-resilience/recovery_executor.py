from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import pwd
import subprocess
import tempfile
import time
from typing import Any, Callable

from boot_guard import AtomicBootStateStore, BootGuard, RaspberryPiTrybootConfig

ALLOWED_ACTIONS = {'reboot-known-good', 'rollback-reboot-known-good'}


def atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    raw = (json.dumps(payload, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')
    fd, tmp = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb', closefd=True) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        dir_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def other_partition(known_good_slot: str, slot_a_partition: int, slot_b_partition: int) -> int:
    if slot_a_partition < 1 or slot_b_partition < 1 or slot_a_partition == slot_b_partition:
        raise ValueError('slot partitions must be distinct positive integers')
    return slot_b_partition if known_good_slot == 'A' else slot_a_partition


class RecoveryExecutor:
    def __init__(
        self,
        *,
        request_path: str | Path,
        processed_path: str | Path,
        boot_state_path: str | Path,
        autoboot_path: str | Path,
        slot_a_partition: int,
        slot_b_partition: int,
        trusted_uid: int,
        cooldown_seconds: int = 120,
        runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
        now_fn: Callable[[], float] = time.time,
    ) -> None:
        if not 10 <= cooldown_seconds <= 3600:
            raise ValueError('cooldown_seconds must be 10..3600')
        self.request_path = Path(request_path)
        self.processed_path = Path(processed_path)
        self.boot_store = AtomicBootStateStore(boot_state_path)
        self.guard = BootGuard(self.boot_store)
        self.autoboot = RaspberryPiTrybootConfig(autoboot_path)
        self.slot_a_partition = slot_a_partition
        self.slot_b_partition = slot_b_partition
        self.trusted_uid = trusted_uid
        self.cooldown_seconds = cooldown_seconds
        self.runner = runner
        self.now_fn = now_fn

    def _load_request(self) -> dict[str, Any]:
        stat = self.request_path.stat()
        if stat.st_uid != self.trusted_uid:
            raise PermissionError('recovery request owner is not trusted')
        if stat.st_mode & 0o022:
            raise PermissionError('recovery request must not be group/world writable')
        raw = json.loads(self.request_path.read_text(encoding='utf-8'))
        if not isinstance(raw, dict):
            raise ValueError('recovery request must be an object')
        if raw.get('schema') != 'kingmast-platform-recovery-request/v1':
            raise ValueError('unsupported recovery request schema')
        if raw.get('controlAuthority') != 'none':
            raise ValueError('recovery request cannot obtain vehicle control authority')
        action = raw.get('action')
        if action not in ALLOWED_ACTIONS:
            raise ValueError('unsupported recovery action')
        generation = raw.get('generation')
        if not isinstance(generation, int) or generation < 1:
            raise ValueError('invalid recovery generation')
        return raw

    def _processed(self) -> dict[str, Any]:
        if not self.processed_path.exists():
            return {'generation': 0, 'processedAtMs': 0}
        raw = json.loads(self.processed_path.read_text(encoding='utf-8'))
        return raw if isinstance(raw, dict) else {'generation': 0, 'processedAtMs': 0}

    def execute_once(self, *, execute_reboot: bool) -> dict[str, Any]:
        request = self._load_request()
        processed = self._processed()
        if request['generation'] <= int(processed.get('generation', 0)):
            return {'executed': False, 'reason': 'already-processed', 'generation': request['generation'], 'controlAuthority': 'none'}
        now_ms = int(self.now_fn() * 1000)
        previous_ms = int(processed.get('processedAtMs', 0))
        if previous_ms and now_ms - previous_ms < self.cooldown_seconds * 1000:
            return {'executed': False, 'reason': 'cooldown-active', 'generation': request['generation'], 'controlAuthority': 'none'}

        boot = self.boot_store.load()
        if request['action'] == 'rollback-reboot-known-good':
            boot = self.guard.report_failure(request.get('reason', 'candidate-health-failed'))
        known_good_partition = boot.known_good_partition
        alternate = other_partition(boot.known_good_slot, self.slot_a_partition, self.slot_b_partition)
        self.autoboot.write_atomic(known_good_partition, alternate)

        receipt = {
            'schema': 'kingmast-platform-recovery-receipt/v1',
            'generation': request['generation'],
            'processedAtMs': now_ms,
            'action': request['action'],
            'knownGoodSlot': boot.known_good_slot,
            'knownGoodPartition': known_good_partition,
            'rebootIssued': bool(execute_reboot),
            'controlAuthority': 'none',
        }
        atomic_json(self.processed_path, receipt)

        if execute_reboot:
            if os.geteuid() != 0:
                raise PermissionError('recovery reboot requires root')
            self.runner(['/usr/sbin/reboot'], check=True, timeout=5)
        return {'executed': True, **receipt}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='KINGMAST bounded root recovery executor')
    parser.add_argument('--request', default='/var/lib/kingmast/resilience/recovery-request.json')
    parser.add_argument('--processed', default='/var/lib/kingmast/resilience/recovery-receipt.json')
    parser.add_argument('--boot-state', default='/var/lib/kingmast/recovery/boot-state.json')
    parser.add_argument('--autoboot', default='/boot/firmware/autoboot.txt')
    parser.add_argument('--slot-a-partition', type=int, default=int(os.getenv('KINGMAST_SLOT_A_PARTITION', '2')))
    parser.add_argument('--slot-b-partition', type=int, default=int(os.getenv('KINGMAST_SLOT_B_PARTITION', '3')))
    parser.add_argument('--trusted-request-user', default=os.getenv('KINGMAST_RESILIENCE_USER', 'kingmast'))
    parser.add_argument('--cooldown-sec', type=int, default=int(os.getenv('KINGMAST_RECOVERY_COOLDOWN_SEC', '120')))
    parser.add_argument('--execute-reboot', action='store_true')
    return parser


def main() -> None:
    args = build_parser().parse_args()
    trusted_uid = pwd.getpwnam(args.trusted_request_user).pw_uid
    executor = RecoveryExecutor(
        request_path=args.request,
        processed_path=args.processed,
        boot_state_path=args.boot_state,
        autoboot_path=args.autoboot,
        slot_a_partition=args.slot_a_partition,
        slot_b_partition=args.slot_b_partition,
        trusted_uid=trusted_uid,
        cooldown_seconds=args.cooldown_sec,
    )
    result = executor.execute_once(execute_reboot=args.execute_reboot)
    print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    main()
