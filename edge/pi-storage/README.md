# KINGMAST Raspberry Pi adaptive SD history storage

This service is a **history-only** storage sink for ESP32 packets that could not be delivered in realtime. It does not feed stale packets back into the realtime risk path and has `controlAuthority: none`.

## Why it is separate from `/v3/edge/frame`

The realtime route deliberately rejects stale/replayed packets. Re-sending an old signed packet into that route would weaken the freshness contract. The Pi history gateway instead verifies the original packet signature and stores it as historical evidence only.

## Flexible 128/256 GB cards

No card size is hard-coded. `storage_runtime.py` reads the mounted filesystem capacity at runtime and derives:

- history quota: `KINGMAST_HISTORY_STORAGE_PERCENT`, default 15%;
- filesystem reserve: `KINGMAST_STORAGE_RESERVE_PERCENT`, default 10%;
- `degraded` mode when free space is at or below reserve + 5%;
- `critical` mode when free space reaches the reserve threshold;
- oldest JSONL segments are deleted first when quota/reserve would be violated.

For a 128 GiB card, a 15% history quota is about 19.2 GiB. For a 256 GiB card it becomes about 38.4 GiB automatically.

## Mount recommendation

Mount the dedicated high-endurance SD volume at a stable path, for example:

```bash
/mnt/kingmast-sd
```

Then configure:

```bash
export KINGMAST_HISTORY_STORAGE_DIR=/mnt/kingmast-sd/history
export KINGMAST_HISTORY_STORAGE_PERCENT=15
export KINGMAST_STORAGE_RESERVE_PERCENT=10
export KINGMAST_HISTORY_SEGMENT_MIB=64
```

Use the same `KINGMAST_DEVICE_KEYS_JSON` used for the ESP32 HMAC identity. In strict mode:

```bash
export KINGMAST_REQUIRE_DEVICE_AUTH=1
```

For migration mode the existing `KINGMAST_EDGE_TOKEN` may be used as fallback. Strict device authentication is preferred.

## Start locally

Loopback-only development may run without TLS:

```bash
python3 edge/pi-storage/history_gateway.py \
  --host 127.0.0.1 \
  --port 4100 \
  --storage-dir /mnt/kingmast-sd/history
```

When binding to a LAN interface, TLS is mandatory:

```bash
python3 edge/pi-storage/history_gateway.py \
  --host 0.0.0.0 \
  --port 4100 \
  --storage-dir /mnt/kingmast-sd/history \
  --tls-cert /etc/kingmast/tls/pi.crt \
  --tls-key /etc/kingmast/tls/pi.key
```

Configure the ESP32 `KINGMAST_HISTORY_URL` to the Pi endpoint:

```text
https://kingmast-pi.local:4100/v1/history/batch
```

The certificate must chain to the CA configured in the ESP32 firmware.

## Stored data

The gateway stores only bounded packet/history metadata as JSONL segments. It does **not** store raw camera or cabin video. Each record includes a packet SHA-256 digest, history-only marker, receive time and `controlAuthority: none`.

`GET /v1/storage/status` returns aggregate capacity/quota/segment statistics. It does not expose stored packets.
