# KINGMAST OS resilience layer — v0.0.8

This directory turns the existing A/B recovery state model into a deployable Raspberry Pi host-resilience contract while preserving the warning-only safety boundary.

## Failure domains

KINGMAST does not treat every failure as the same event.

| Failure | Recovery owner | Expected behavior |
| --- | --- | --- |
| One application/service exits | systemd service policy | restart the failed process without changing boot slot |
| Resilience agent hangs | systemd `WatchdogSec` | restart the agent |
| Kernel/systemd host stalls | hardware `/dev/watchdog` via `RuntimeWatchdogSec` | reset the Pi host |
| Candidate OS fails health window | A/B boot guard + recovery executor | mark rollback and reboot known-good slot |
| Power loss during candidate trial | Raspberry Pi one-shot tryboot + persistent boot state | normal boot remains known-good; candidate is never trusted implicitly |
| Persistent history filesystem is full/corrupt | bounded storage layer | preserve reserve, repair partial tail, degrade without changing vehicle control |
| Raspberry Pi hardware dies completely | ESP32 safety island + optional second Pi | ESP32 continues independent telemetry/spool; second Pi may promote only with an independent witness |
| ESP32 fails | Pi remains independent | Pi-side services continue from their available sensors; no actuator authority is created |

A single Raspberry Pi cannot survive its own permanent hardware failure. True host failover requires a physically separate compute node. The warm-standby model therefore refuses automatic promotion without an independent witness lease, preventing a two-node split-brain design from being presented as safe redundancy.

## Layer 0 — ESP32 safety island

The ESP32 remains independently powered/logical from the Pi software stack. Existing firmware can:

- read GNSS/radar inputs;
- sign realtime telemetry;
- spool recoverable network failures to microSD;
- remount SD after card loss;
- drain history through the Pi when connectivity returns.

The Pi being unavailable must not erase the ESP32 backlog. The ESP32 does not gain steering, braking, throttle, gear, torque or CAN-write authority.

## Layer 1 — KINGMAST Pi OS

Recommended image layout:

```text
boot/firmware
  autoboot.txt         A/B partition selector
slot A                 known-good or inactive root filesystem
slot B                 inactive or candidate root filesystem
/var/lib/kingmast      small persistent recovery state
/mnt/kingmast-sd       replaceable/bounded history storage
```

Rootfs A/B and persistent data are intentionally separated. Updating a root slot must never overwrite history storage or the known-good slot.

### Candidate update flow

1. Write and verify a complete candidate image into the inactive slot.
2. Run `boot_guard.py stage` with its slot/partition/version.
3. Run `boot_guard.py prepare-tryboot --apply` to keep known-good as normal boot and map candidate only to one-shot tryboot.
4. Run `boot_guard.py reboot-tryboot --execute`.
5. `kingmast-resilience.service` observes required services/storage/kernel liveness during the candidate health window.
6. Only after the full health window may an update service call `boot_guard.py accept-current --apply-autoboot`.
7. Any critical health failure creates a bounded `rollback-reboot-known-good` request. The root executor commits known-good as normal boot before rebooting.

The boot guard never writes an OS image. Image download, signature validation, anti-rollback policy and inactive-slot flashing remain separate update-service responsibilities.

## Service watchdog and host watchdog

`kingmast-resilience.service` is `Type=notify` with `WatchdogSec=20s`. The Python agent sends `WATCHDOG=1` while its loop is alive.

`99-kingmast-watchdog.conf` is a systemd-manager drop-in intended for `/etc/systemd/system.conf.d/`. If the target exposes a supported `/dev/watchdog`, `RuntimeWatchdogSec=20s` lets systemd periodically service the hardware watchdog. If the kernel/userspace host stalls and systemd stops servicing it, the hardware resets the Pi.

This must be physically validated on the exact Raspberry Pi/carrier/power design; CI cannot prove a physical watchdog reset.

## Privilege separation

`resilience_agent.py` runs as unprivileged `kingmast`. It can only create a recovery request under `/var/lib/kingmast/resilience`.

`kingmast-recovery.path` triggers `kingmast-recovery.service`, whose root executor:

- accepts only the two whitelisted reboot/rollback actions;
- rejects requests with a wrong schema or vehicle control authority;
- rejects group/world-writable or untrusted-owner requests;
- records processed generation numbers;
- enforces a reboot cooldown;
- writes `autoboot.txt` atomically before reboot;
- uses `subprocess` argument arrays, never a shell command string.

## Layer 2 — optional warm standby Pi

`standby_failover.py` models the promotion decision. Promotion is allowed only when all are true:

1. the primary heartbeat is stale beyond the configured timeout;
2. the standby platform itself is healthy;
3. replicated state is fresh enough;
4. an independent witness lease is valid.

Until a physical witness channel is implemented and bench-tested, warm standby is a design-ready path, not a claim of automatic host failover. A practical witness can be implemented by a separately powered ESP32/supervisor that observes both Pi nodes and grants at most one warning-compute lease.

## Installation sketch

```bash
sudo install -d -m 0755 /opt/kingmast/edge/pi-resilience
sudo install -d -o kingmast -g kingmast -m 0700 /var/lib/kingmast/resilience /var/lib/kingmast/recovery
sudo install -m 0644 kingmast-resilience.service /etc/systemd/system/
sudo install -m 0644 kingmast-recovery.service /etc/systemd/system/
sudo install -m 0644 kingmast-recovery.path /etc/systemd/system/
sudo install -m 0644 99-kingmast-watchdog.conf /etc/systemd/system.conf.d/
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable --now kingmast-resilience.service kingmast-recovery.path
```

Do not enable the root recovery path on a target until A/B partition mapping, boot filesystem mount path, hardware watchdog and physical rollback tests have been verified on that exact image.

## Evidence boundary

Automated tests in this repository can prove state-machine behavior, idempotency, cooldown, atomic JSON/config writes and witness-gated standby decisions. They do **not** prove:

- the target actually has two valid bootable OS partitions;
- the candidate image is cryptographically verified;
- physical power interruption is survivable;
- `/dev/watchdog` resets the exact target hardware;
- a second Pi and independent witness exist;
- production-grade fail-operational vehicle qualification.

`controlAuthority` remains `none` throughout this layer.
