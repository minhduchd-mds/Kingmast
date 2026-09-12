from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from typing import Any

SCHEMA = 'kingmast-pi-ab-boot-state/v1'
VALID_SLOTS = {'A', 'B'}
VALID_PHASES = {'stable', 'candidate-staged', 'candidate-booting', 'rollback-required'}


@dataclass
class BootState:
    schema: str = SCHEMA
    generation: int = 0
    phase: str = 'stable'
    active_slot: str = 'A'
    known_good_slot: str = 'A'
    known_good_partition: int = 2
    candidate_slot: str | None = None
    candidate_partition: int | None = None
    candidate_version: str | None = None
    candidate_attempts: int = 0
    max_candidate_attempts: int = 2
    last_reason: str | None = None
    updated_at_ms: int = 0
    controlAuthority: str = 'none'

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> 'BootState':
        state = cls(**raw)
        state.validate()
        return state

    def validate(self) -> None:
        if self.schema != SCHEMA:
            raise ValueError('unsupported boot state schema')
        if self.phase not in VALID_PHASES:
            raise ValueError('invalid boot phase')
        if self.active_slot not in VALID_SLOTS or self.known_good_slot not in VALID_SLOTS:
            raise ValueError('invalid A/B slot')
        if self.candidate_slot is not None and self.candidate_slot not in VALID_SLOTS:
            raise ValueError('invalid candidate slot')
        if self.known_good_partition < 1:
            raise ValueError('known-good partition must be positive')
        if self.candidate_partition is not None and self.candidate_partition < 1:
            raise ValueError('candidate partition must be positive')
        if not 1 <= self.max_candidate_attempts <= 5:
            raise ValueError('max_candidate_attempts must be 1..5')
        if self.candidate_attempts < 0:
            raise ValueError('candidate_attempts must be nonnegative')
        if self.controlAuthority != 'none':
            raise ValueError('boot guard must not obtain vehicle control authority')


class AtomicBootStateStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def load(self) -> BootState:
        if not self.path.exists():
            return BootState(updated_at_ms=int(time.time() * 1000))
        raw = json.loads(self.path.read_text(encoding='utf-8'))
        if not isinstance(raw, dict):
            raise ValueError('boot state must be an object')
        return BootState.from_dict(raw)

    def save(self, state: BootState) -> BootState:
        state.validate()
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        state.generation += 1
        state.updated_at_ms = int(time.time() * 1000)
        payload = (json.dumps(asdict(state), sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')
        fd, tmp_name = tempfile.mkstemp(prefix='.boot-state-', dir=self.path.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'wb', closefd=True) as handle:
                handle.write(payload)
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
        return state


class BootGuard:
    def __init__(self, store: AtomicBootStateStore) -> None:
        self.store = store

    def stage_candidate(self, *, slot: str, partition: int, version: str) -> BootState:
        state = self.store.load()
        if state.phase not in {'stable', 'rollback-required'}:
            raise RuntimeError(f'cannot stage candidate from phase {state.phase}')
        if slot not in VALID_SLOTS or slot == state.known_good_slot:
            raise ValueError('candidate must use the inactive A/B slot')
        if partition < 1 or partition == state.known_good_partition:
            raise ValueError('candidate must use a different boot partition')
        if not version.strip():
            raise ValueError('candidate version is required')
        state.phase = 'candidate-staged'
        state.active_slot = state.known_good_slot
        state.candidate_slot = slot
        state.candidate_partition = partition
        state.candidate_version = version.strip()
        state.candidate_attempts = 0
        state.last_reason = None
        return self.store.save(state)

    def begin_candidate_boot(self) -> BootState:
        state = self.store.load()
        if state.phase not in {'candidate-staged', 'candidate-booting'}:
            raise RuntimeError(f'candidate boot not allowed from phase {state.phase}')
        if state.candidate_slot is None or state.candidate_partition is None:
            raise RuntimeError('candidate metadata missing')
        state.candidate_attempts += 1
        if state.candidate_attempts > state.max_candidate_attempts:
            state.phase = 'rollback-required'
            state.active_slot = state.known_good_slot
            state.last_reason = 'candidate-attempt-budget-exhausted'
        else:
            state.phase = 'candidate-booting'
            state.active_slot = state.candidate_slot
            state.last_reason = None
        return self.store.save(state)

    def accept_candidate(self, *, observed_partition: int, tryboot_active: bool) -> BootState:
        state = self.store.load()
        if state.phase != 'candidate-booting':
            raise RuntimeError('candidate acceptance requires candidate-booting phase')
        if state.candidate_slot is None or state.candidate_partition is None:
            raise RuntimeError('candidate metadata missing')
        if not tryboot_active:
            raise RuntimeError('candidate acceptance requires verified tryboot boot')
        if observed_partition != state.candidate_partition:
            raise RuntimeError('observed partition does not match staged candidate')
        state.phase = 'stable'
        state.active_slot = state.candidate_slot
        state.known_good_slot = state.candidate_slot
        state.known_good_partition = state.candidate_partition
        state.candidate_slot = None
        state.candidate_partition = None
        state.candidate_version = None
        state.candidate_attempts = 0
        state.last_reason = None
        return self.store.save(state)

    def report_failure(self, reason: str) -> BootState:
        state = self.store.load()
        if state.phase in {'candidate-staged', 'candidate-booting'}:
            state.phase = 'rollback-required'
            state.active_slot = state.known_good_slot
            state.last_reason = reason.strip() or 'candidate-health-failed'
        return self.store.save(state)

    def recover_after_unclean_boot(self, *, observed_partition: int, tryboot_active: bool) -> BootState:
        state = self.store.load()
        if state.phase == 'candidate-booting':
            if not tryboot_active or observed_partition != state.candidate_partition:
                state.phase = 'rollback-required'
                state.active_slot = state.known_good_slot
                state.last_reason = 'unclean-candidate-boot-or-automatic-tryboot-rollback'
                return self.store.save(state)
        return state


class RaspberryPiTrybootConfig:
    """Builds a bounded autoboot.txt A/B mapping. It never writes an OS image."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    @staticmethod
    def render(default_partition: int, try_partition: int) -> str:
        if default_partition < 1 or try_partition < 1 or default_partition == try_partition:
            raise ValueError('A/B boot partitions must be distinct positive integers')
        text = (
            '[all]\n'
            'tryboot_a_b=1\n'
            f'boot_partition={default_partition}\n'
            '[tryboot]\n'
            f'boot_partition={try_partition}\n'
        )
        if len(text.encode('utf-8')) > 512:
            raise ValueError('autoboot.txt exceeds Raspberry Pi bootloader limit')
        return text

    def write_atomic(self, default_partition: int, try_partition: int) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = self.render(default_partition, try_partition).encode('ascii')
        fd, tmp_name = tempfile.mkstemp(prefix='.autoboot-', dir=self.path.parent)
        try:
            with os.fdopen(fd, 'wb', closefd=True) as handle:
                handle.write(payload)
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


def read_device_tree_int(path: str | Path) -> int:
    raw = Path(path).read_bytes().rstrip(b'\x00')
    if not raw:
        raise RuntimeError(f'empty device-tree value: {path}')
    if raw.isdigit():
        return int(raw.decode('ascii'))
    return int.from_bytes(raw, byteorder='big', signed=False)


def current_boot_context() -> tuple[int, bool]:
    base = Path('/proc/device-tree/chosen/bootloader')
    partition = read_device_tree_int(base / 'partition')
    try:
        tryboot = read_device_tree_int(base / 'tryboot') == 1
    except FileNotFoundError:
        tryboot = False
    return partition, tryboot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='KINGMAST Raspberry Pi A/B boot guard')
    parser.add_argument('--state', default='/var/lib/kingmast/recovery/boot-state.json')
    parser.add_argument('--autoboot', default='/boot/firmware/autoboot.txt')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('status')
    stage = sub.add_parser('stage')
    stage.add_argument('--slot', required=True, choices=['A', 'B'])
    stage.add_argument('--partition', required=True, type=int)
    stage.add_argument('--version', required=True)
    prepare = sub.add_parser('prepare-tryboot')
    prepare.add_argument('--apply', action='store_true')
    accept = sub.add_parser('accept-current')
    accept.add_argument('--apply-autoboot', action='store_true')
    fail = sub.add_parser('fail-current')
    fail.add_argument('--reason', default='candidate-health-failed')
    reboot = sub.add_parser('reboot-tryboot')
    reboot.add_argument('--execute', action='store_true')
    return parser


def main() -> None:
    args = build_parser().parse_args()
    store = AtomicBootStateStore(args.state)
    guard = BootGuard(store)
    config = RaspberryPiTrybootConfig(args.autoboot)

    if args.command == 'status':
        print(json.dumps(asdict(store.load()), separators=(',', ':')))
        return
    if args.command == 'stage':
        state = guard.stage_candidate(slot=args.slot, partition=args.partition, version=args.version)
        print(json.dumps(asdict(state), separators=(',', ':')))
        return
    if args.command == 'prepare-tryboot':
        state = store.load()
        if state.phase != 'candidate-staged' or state.candidate_partition is None:
            raise RuntimeError('prepare-tryboot requires a staged candidate')
        rendered = config.render(state.known_good_partition, state.candidate_partition)
        if args.apply:
            config.write_atomic(state.known_good_partition, state.candidate_partition)
        print(json.dumps({'apply': args.apply, 'autoboot': rendered, 'rebootArgument': '0 tryboot', 'controlAuthority': 'none'}, separators=(',', ':')))
        return
    if args.command == 'accept-current':
        partition, tryboot = current_boot_context()
        before = store.load()
        candidate_partition = before.candidate_partition
        state = guard.accept_candidate(observed_partition=partition, tryboot_active=tryboot)
        if args.apply_autoboot:
            if candidate_partition is None:
                raise RuntimeError('candidate partition missing before acceptance')
            config.write_atomic(state.known_good_partition, before.known_good_partition)
        print(json.dumps(asdict(state), separators=(',', ':')))
        return
    if args.command == 'fail-current':
        state = guard.report_failure(args.reason)
        print(json.dumps(asdict(state), separators=(',', ':')))
        return
    if args.command == 'reboot-tryboot':
        state = guard.begin_candidate_boot()
        if state.phase == 'rollback-required':
            raise RuntimeError('candidate attempt budget exhausted; refusing another tryboot')
        if args.execute:
            if os.geteuid() != 0:
                raise PermissionError('reboot execution requires root')
            subprocess.run(['/usr/sbin/reboot', '0 tryboot'], check=True)
        print(json.dumps({'execute': args.execute, 'rebootArgument': '0 tryboot', 'state': asdict(state), 'controlAuthority': 'none'}, separators=(',', ':')))
        return


if __name__ == '__main__':
    main()
