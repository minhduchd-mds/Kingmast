from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
import tempfile

from storage_runtime import AdaptiveJsonlRingStore, compute_storage_plan


def check(checks: list[dict[str, object]], check_id: str, passed: bool, detail: str) -> None:
    checks.append({'id': check_id, 'passed': bool(passed), 'detail': detail})


def main() -> None:
    checks: list[dict[str, object]] = []
    gib = 1024 ** 3
    plan128 = compute_storage_plan(128 * gib, 100 * gib, 15, 10)
    plan256 = compute_storage_plan(256 * gib, 200 * gib, 15, 10)
    check(checks, 'adaptive-128-256', abs(plan256.quota_bytes - plan128.quota_bytes * 2) <= 1, 'quota follows actual filesystem capacity within one-byte floating rounding')
    check(checks, 'reserve-degraded', compute_storage_plan(1000, 140, 15, 10).mode == 'degraded', 'free space enters degraded before reserve floor')
    check(checks, 'reserve-critical', compute_storage_plan(1000, 100, 15, 10).mode == 'critical', 'reserve floor is reported critical')

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        usage = SimpleNamespace(total=100_000, free=90_000, used=10_000)
        segment = root / 'segment-00000000000000000001-000001.jsonl'
        valid = b'{"event":"before-power-loss"}\n'
        partial = b'{"event":"cut-mid-write"'
        segment.write_bytes(valid + partial)
        store = AdaptiveJsonlRingStore(
            root,
            requested_percent=50,
            reserve_percent=5,
            segment_bytes=4096,
            max_record_bytes=1024,
            disk_usage_fn=lambda _: usage,
        )
        status = store.status()
        repaired = segment.read_bytes() == valid and status['recoveredSegments'] == 1
        check(checks, 'power-loss-tail-repair', repaired, 'partial trailing JSONL bytes are discarded after restart')
        store.append({'event': 'after-restart'})
        check(checks, 'post-recovery-write', status['fsyncPerRecord'] is True, 'history records use flush + fsync before acknowledgement')

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        usage = SimpleNamespace(total=20_000, free=18_000, used=2_000)
        store = AdaptiveJsonlRingStore(
            root,
            requested_percent=10,
            reserve_percent=5,
            segment_bytes=1024,
            max_record_bytes=1024,
            disk_usage_fn=lambda _: usage,
        )
        for index in range(8):
            store.append({'index': index, 'payload': 'x' * 300})
        status = store.status()
        check(checks, 'quota-prune', status['prunedSegments'] >= 1 and status['storeBytes'] <= status['quotaBytes'], 'oldest segments are pruned under quota pressure')

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        usage = SimpleNamespace(total=10_000, free=500, used=9_500)
        store = AdaptiveJsonlRingStore(
            root,
            requested_percent=15,
            reserve_percent=10,
            segment_bytes=1024,
            max_record_bytes=1024,
            disk_usage_fn=lambda _: usage,
        )
        blocked = False
        try:
            store.append({'payload': 'x' * 100})
        except RuntimeError as exc:
            blocked = str(exc) == 'storage-capacity-reserved'
        check(checks, 'reserve-fail-closed', blocked, 'new history write is refused when reserve cannot be protected')

    firmware = (Path(__file__).parents[1] / 'esp32' / 'kingmast_edge' / 'kingmast_edge.ino').read_text(encoding='utf-8')
    config = (Path(__file__).parents[1] / 'esp32' / 'kingmast_edge' / 'config.example.h').read_text(encoding='utf-8')
    check(checks, 'esp32-remount', 'maintainSdSpool()' in firmware and 'SD_REMOUNT_INTERVAL_MS' in config, 'ESP32 periodically retries SD mount without stopping realtime')
    check(checks, 'esp32-prewrite-prune', 'pruneSpool(incomingBytes)' in firmware, 'ESP32 frees bounded space before appending a failed realtime packet')
    check(checks, 'esp32-partial-tail', 'corruptTail' in firmware and 'discarded unrecoverable partial SD segment' in firmware, 'ESP32 recovery path does not let an interrupted tail block the queue forever')
    check(checks, 'history-not-realtime', 'KINGMAST_HISTORY_URL' in config and '/v3/edge/frame' not in config.split('KINGMAST_HISTORY_URL', 1)[1].split('\n', 1)[0], 'offline history uses a separate endpoint')

    failed = [item for item in checks if not item['passed']]
    report = {
        'schema': 'kingmast-sd-hardware-readiness-preflight/v1',
        'checks': checks,
        'total': len(checks),
        'passed': len(checks) - len(failed),
        'failed': len(failed),
        'allPassed': not failed,
        'physicalSdCardTested': False,
        'physicalRaspberryPiTested': False,
        'physicalEsp32Tested': False,
        'qualificationClaim': 'deterministic-software-preflight-only-not-physical-hardware-qualification',
        'controlAuthority': 'none',
    }
    print(json.dumps(report, separators=(',', ':')))
    raise SystemExit(0 if not failed else 1)


if __name__ == '__main__':
    main()
