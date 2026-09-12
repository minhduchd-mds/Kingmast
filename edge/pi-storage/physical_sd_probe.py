from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import time


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description='KINGMAST Raspberry Pi physical SD filesystem smoke probe')
    value.add_argument('--storage-dir', required=True, help='Mounted KINGMAST SD history directory')
    value.add_argument('--probe-mib', type=int, default=4, help='Bounded temporary write size, 1..64 MiB')
    value.add_argument('--hardware-target', default='raspberry-pi-5')
    value.add_argument('--confirm-sd-card', action='store_true', help='Operator confirms this path is physically backed by the intended SD card')
    value.add_argument('--output', default='', help='Optional JSON evidence path')
    return value


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def main() -> None:
    args = parser().parse_args()
    if args.probe_mib < 1 or args.probe_mib > 64:
        raise RuntimeError('--probe-mib must be between 1 and 64')

    root = Path(args.storage_dir).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    usage_before = shutil.disk_usage(root)
    if usage_before.total <= 0:
        raise RuntimeError('storage filesystem reported zero capacity')

    probe_dir = root / '.kingmast-physical-probe'
    probe_dir.mkdir(mode=0o700, exist_ok=True)
    probe_path = probe_dir / f'probe-{os.getpid()}-{time.time_ns()}.bin'
    size_bytes = args.probe_mib * 1024 * 1024
    chunk = bytes((index * 31 + 17) % 256 for index in range(64 * 1024))
    expected = hashlib.sha256()
    started = time.monotonic()
    with probe_path.open('wb') as handle:
        remaining = size_bytes
        while remaining > 0:
            payload = chunk[:min(len(chunk), remaining)]
            handle.write(payload)
            expected.update(payload)
            remaining -= len(payload)
        handle.flush()
        os.fsync(handle.fileno())
    fsync_directory(probe_dir)
    write_fsync_ms = round((time.monotonic() - started) * 1000, 2)

    actual = hashlib.sha256()
    started = time.monotonic()
    with probe_path.open('rb') as handle:
        while True:
            payload = handle.read(128 * 1024)
            if not payload:
                break
            actual.update(payload)
    read_verify_ms = round((time.monotonic() - started) * 1000, 2)
    verified = actual.hexdigest() == expected.hexdigest() and probe_path.stat().st_size == size_bytes

    probe_path.unlink()
    fsync_directory(probe_dir)
    try:
        probe_dir.rmdir()
    except OSError:
        pass
    usage_after = shutil.disk_usage(root)

    report = {
        'schema': 'kingmast-physical-sd-smoke-evidence/v1',
        'capturedAtMs': int(time.time() * 1000),
        'hardwareTarget': args.hardware_target,
        'storagePath': str(root),
        'totalBytes': int(usage_before.total),
        'freeBytesBefore': int(usage_before.free),
        'freeBytesAfter': int(usage_after.free),
        'probeBytes': size_bytes,
        'writeFsyncMs': write_fsync_ms,
        'readVerifyMs': read_verify_ms,
        'sha256Verified': verified,
        'physicalFilesystemWriteReadTested': True,
        'physicalSdCardTested': bool(args.confirm_sd_card),
        'hotRemoveRemountTested': False,
        'powerLossRecoveryTested': False,
        'wifiOutageStoreForwardTested': False,
        'vehicleInstalledTested': False,
        'publicRoadTested': False,
        'qualificationClaim': 'physical-filesystem-smoke-only-not-power-loss-hot-remove-vehicle-or-public-road-qualification',
        'storesRawVideo': False,
        'controlAuthority': 'none',
        'allPassed': verified,
    }
    encoded = json.dumps(report, indent=2, sort_keys=True) + '\n'
    if args.output:
        output = Path(args.output).expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding='utf-8')
    print(encoded, end='')
    raise SystemExit(0 if verified else 1)


if __name__ == '__main__':
    main()
