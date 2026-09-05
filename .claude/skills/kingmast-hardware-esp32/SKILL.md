---
name: kingmast-hardware-esp32
description: ESP32 and vehicle-integration workflow for KINGMAST prototype hardware. This skill should be used for power design, connectors, wiring diagrams, sensor modules, enclosure integration, read-only vehicle telemetry, and hardware documentation.
user-invocable: true
---

# KINGMAST ESP32 hardware

## Goal

Prototype robust automotive sensing/telemetry integration around ESP32 without cutting OEM wiring unnecessarily or introducing vehicle-control authority.

## Workflow

1. Apply `kingmast-safety` together with this skill.
2. Inspect existing `edge/` code and hardware/ECU integration documentation before proposing a new connection.
3. Separate automotive 12 V input protection from logic power: fuse appropriately, handle reverse polarity/transients, regulate to the board/module voltage, and document grounding.
4. Prefer OEM-compatible/T-harness or non-destructive connector approaches where the exact vehicle interface is known. Never invent a pinout for a specific vehicle.
5. Treat CAN/OBD vehicle access as read-only unless a separately validated safety architecture exists; KINGMAST currently has no write authority.
6. Isolate/protect interfaces where required and document voltage levels, current budget, connector type and failure behavior.
7. Keep sensor inputs explicit: camera/radar/GNSS/IMU or other modules must state interface, supply, data rate and calibration need.
8. Document bench-test setup before vehicle installation. Verify power, thermal behavior, boot/recovery and communications off-vehicle first.
9. Mark schematic elements as prototype/reference when component selection or OEM validation is incomplete.
10. Keep diagrams, BOM notes and software endpoint mappings synchronized in the repository.

## Safety note

Do not present a generic wiring diagram as a verified vehicle-specific harness. Vehicle-specific pinouts require authoritative service/OEM evidence or direct measurement/validation.
