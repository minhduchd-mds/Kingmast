# KINGMAST v0.0.8 — ESP32 ↔ Raspberry Pi SD physical validation runbook

This runbook validates the bounded store-and-forward storage path introduced in v0.0.8. It does **not** authorize vehicle control, public-road testing, or claim production hardware qualification.

## Scope and safety boundary

- ESP32: GNSS/radar telemetry only; microSD is a bounded offline spool.
- Raspberry Pi: history-only JSONL archive sized from the mounted filesystem.
- Stale SD packets must never be replayed into `/v3/edge/frame`.
- Raw camera/cabin video remains disabled by default.
- `controlAuthority = none` throughout this validation.
- Perform power interruption and hot-remove tests on a bench setup, not while installed in a moving vehicle.

## Reference wiring — ESP32 microSD over VSPI

| Signal | ESP32 reference pin |
| --- | ---: |
| CS | GPIO 5 |
| SCK | GPIO 18 |
| MISO | GPIO 19 |
| MOSI | GPIO 23 |
| VCC | Match the SD module electrical requirement; use a 3.3 V-safe interface |
| GND | Common ground |

GPS/radar UART pins remain separate from the SD SPI pins. Verify the actual module board before energizing it.

## 1. Software preflight

Required before touching hardware:

```bash
python edge/pi-storage/hardware_readiness_selftest.py
python -m unittest -v edge/pi-storage/test_storage_runtime.py edge/pi-storage/test_history_gateway.py
```

Expected result:

- all deterministic checks pass;
- `physicalSdCardTested=false`;
- `physicalRaspberryPiTested=false`;
- `physicalEsp32Tested=false`;
- `controlAuthority=none`.

This is intentionally not physical evidence.

## 2. Compile ESP32 firmware

The repository CI compiles the sketch with the pinned PlatformIO configuration. A local equivalent is:

```bash
cd edge/esp32/kingmast_edge
cp config.example.h config.h
pio run
```

For a real device, replace the placeholders in the local untracked `config.h` before flashing. Never commit Wi-Fi credentials, device HMAC material, TLS private keys, or production tokens.

## 3. Raspberry Pi SD filesystem smoke test

Mount the intended SD storage volume, then run:

```bash
python edge/pi-storage/physical_sd_probe.py \
  --storage-dir /mnt/kingmast-sd/history \
  --probe-mib 4 \
  --hardware-target raspberry-pi-5 \
  --confirm-sd-card \
  --output /tmp/kingmast-physical-sd-smoke.json
```

The probe performs a bounded temporary write, `fsync`, SHA-256 read-back verification, deletion, and another directory `fsync`. It does not fill the card and does not modify existing history segments.

Required evidence fields:

- `sha256Verified=true`
- `physicalFilesystemWriteReadTested=true`
- `physicalSdCardTested=true` only when the operator has confirmed the path is the intended physical SD card
- `hotRemoveRemountTested=false`
- `powerLossRecoveryTested=false`
- `controlAuthority=none`

## 4. ESP32 boot without SD

1. Remove the ESP32 microSD card.
2. Boot the ESP32 on the bench.
3. Confirm serial output reports SD unavailable.
4. Confirm realtime telemetry can still operate when Wi-Fi/gateway is available.

Pass condition: loss of SD does not disable realtime sensor publishing.

## 5. Hot insert / remount

1. With the ESP32 still powered, insert a known-good microSD card using hardware that supports safe hot insertion.
2. Wait at least `SD_REMOUNT_INTERVAL_MS`.
3. Confirm serial output includes `SD spool remounted`.
4. Verify `/kingmast/spool` exists on the card after a controlled outage creates backlog.

If the module/socket is not designed for hot insertion, power down before insertion and record this scenario as **not executed** rather than forcing the test.

## 6. Wi-Fi or gateway outage store-and-forward

1. Keep GPS data valid.
2. Make the realtime gateway unreachable for 30–60 seconds without changing firmware credentials.
3. Confirm `.jsonl` segments appear under `/kingmast/spool`.
4. Restore the realtime gateway.
5. Confirm fresh realtime delivery resumes first.
6. Confirm old segments are uploaded only to `KINGMAST_HISTORY_URL`.
7. Confirm accepted history segments are deleted from ESP32 SD only after an HTTP 2xx response.

Pass condition: fresh realtime remains separate from history recovery.

## 7. ESP32 SD capacity pressure

Use a disposable test card or pre-filled test filesystem. Do not intentionally fill the system/boot filesystem.

1. Leave less than the configured reserve plus one spool record.
2. Trigger a transient realtime delivery failure.
3. Confirm the firmware prunes the oldest spool segment before writing the new record.
4. Confirm no write is attempted past the protected reserve when no removable segment remains.

Record `sdPrunedSegments`/serial evidence if available.

## 8. Interrupted write / power-loss recovery

Bench only.

1. Create at least one valid spool segment by making the gateway unavailable.
2. Interrupt ESP32 power during repeated spool writes.
3. Restore power.
4. Restore connectivity.
5. Confirm valid complete records before the interrupted tail are recoverable.
6. Confirm an unrecoverable partial trailing record does not wedge the queue forever.
7. Confirm the device returns to fresh realtime publishing independently of history recovery.

Do not infer crash-safety from the deterministic CI test alone; this step requires the actual SD card/controller/filesystem.

## 9. Raspberry Pi restart / interrupted JSONL write

1. Run the history gateway with storage on the target SD card.
2. Ingest signed history records.
3. Interrupt the history service or Pi power during a controlled bench test.
4. Restart the Pi/service.
5. Confirm startup/status reports `recoveredSegments` if a partial trailing record existed.
6. Confirm the next accepted record can still be appended.

The Pi store calls `flush` + `fsync` for each accepted history record in v0.0.8 readiness hardening.

## 10. Evidence classification

A complete hardware test record should separately report:

- ESP32 board model/revision
- SD module/socket type
- SD manufacturer/model/capacity/endurance class
- Raspberry Pi model/revision
- Pi OS/kernel/filesystem
- measured card capacity/free space
- ESP32 compile SHA
- firmware SHA/build identifier
- hot-remove/remount: pass/fail/not executed
- gateway outage/recovery: pass/fail
- ESP32 interrupted write: pass/fail/not executed
- Pi interrupted write/recovery: pass/fail/not executed
- 128 GB test: pass/fail/not executed
- 256 GB test: pass/fail/not executed

Passing this runbook is prototype/bench evidence only. It is not automotive functional-safety qualification, environmental qualification, EMC validation, endurance certification, or public-road approval.
