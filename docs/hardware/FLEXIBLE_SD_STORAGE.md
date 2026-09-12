# KINGMAST flexible SD storage — ESP32 → Raspberry Pi

Status: software implementation for KINGMAST 0.0.8. This does not change vehicle control authority and does not imply physical hardware qualification.

## Storage roles

```text
GNSS / front radar
        │
        ▼
      ESP32
        │
        ├── realtime HTTPS ───────────────► risk engine / HMI
        │
        └── failed transient packet
                 │
                 ▼
          bounded microSD spool
                 │
                 │ history batch after link recovery
                 ▼
         Raspberry Pi history gateway
                 │
                 ▼
       128 / 256 GB SD filesystem
       adaptive JSONL ring storage
```

The ESP32 card is a **temporary store-and-forward cache**. The Raspberry Pi card is the larger history store.

## Realtime remains first priority

Old packets are never replayed into `/v3/edge/frame`. That route is freshness/replay protected and must continue representing current vehicle state.

ESP32 behavior:

1. Build a timestamped, signed edge packet.
2. Attempt realtime delivery once.
3. On transient delivery failures (`network/timeout`, `408`, `425`, `429`, `5xx`) append the signed packet to SD.
4. Do not spool permanent/auth/replay failures such as `400`, `401`, `403`, or `409`.
5. After a new realtime packet succeeds, periodically send the oldest SD segment to the Pi history endpoint.
6. Delete a segment only after the Pi returns a successful response.

This avoids weakening the replay guard when an HTTP response is lost after the realtime server already accepted a packet.

## ESP32 SD behavior

Reference SPI wiring in `config.example.h`:

- CS: GPIO 5
- SCK: GPIO 18
- MISO: GPIO 19
- MOSI: GPIO 23

These pins are separate from the current GPS and radar UART pins. They remain reference wiring and must be checked against the actual board before physical installation.

The ESP32 spool quota is calculated from detected card capacity (`SD.totalBytes()`), with configurable percentage, reserve, minimum and maximum bounds. The default is intentionally capped because the MCU spool is not intended to become a long-term database.

Spool segments are bounded JSONL files. When quota or filesystem reserve would be violated, the oldest segment is removed first.

## Raspberry Pi 128 / 256 GB behavior

`edge/pi-storage/storage_runtime.py` uses the actual mounted filesystem capacity. It does not contain a 128 GB or 256 GB switch.

Default history policy:

- 15% history quota;
- 10% filesystem reserve;
- 64 MiB segments;
- `degraded` when free space reaches reserve + 5%;
- `critical` when free space reaches the reserve threshold;
- oldest segments pruned first.

Approximate quota examples using GiB values:

| Card/filesystem | 15% history quota | 10% reserve |
| --- | ---: | ---: |
| 128 GiB | 19.2 GiB | 12.8 GiB |
| 256 GiB | 38.4 GiB | 25.6 GiB |

The same code therefore works when the SD is replaced with a larger card, provided the mount point remains stable.

## History authentication

Each HMAC-enabled ESP32 spool entry carries:

- original packet;
- device key ID;
- original HMAC packet signature.

The Pi reconstructs the same `KINGMAST-EDGE-V1` canonical payload and verifies the HMAC before storing the record. Strict mode can require per-device authentication. Migration mode may accept the existing edge token as fallback.

The Pi stores the packet only as historical evidence. Each JSONL envelope includes `historyOnly: true`, `replayedIntoRealtime: false` by API response, packet SHA-256 and `controlAuthority: none`.

## Privacy

This batch does not enable raw camera or cabin video recording. The Pi history gateway stores bounded telemetry/history JSON only. Camera raw-video persistence remains disabled by default.

## Operational mount

Recommended dedicated mount:

```text
/mnt/kingmast-sd
```

Recommended storage path:

```text
/mnt/kingmast-sd/history
```

A systemd example is provided at `edge/pi-storage/kingmast-pi-history.service`.

## Safety boundary

This storage path is diagnostic/history infrastructure only. It has no steering, braking, throttle, gear, torque or CAN-write authority. `controlAuthority` remains `none`.
