# KINGMAST ESP32 Digital Twin — v0.0.8

Route: `/lab/esp32`

This simulator is a software-in-the-loop visualization of the KINGMAST edge wiring and resilience architecture. It is intentionally separated from the driving HMI.

## What is simulated

- 12/24 V vehicle source and DC-DC low-voltage domain;
- ESP32 safety-island role;
- terminal block E1–E4 + GND;
- GPS over UART;
- radar over I2C/GPIO;
- microSD over SPI and store-and-forward behavior;
- Wi-Fi/HTTPS uplink from ESP32 to Raspberry Pi;
- camera connected directly to Raspberry Pi;
- Raspberry Pi known-good / rollback behavior;
- optional witnessed warm-standby promotion after primary hardware loss.

## Interactive faults

- Wi-Fi loss -> realtime uplink stops and ESP32 spools to microSD;
- SD fault -> realtime remains available when Pi/uplink are healthy;
- Pi OS crash -> simulated A/B rollback window then known-good recovery;
- Pi hardware loss -> ESP32 remains independent; standby promotion requires witness;
- ESP32 reset -> Pi-side camera/runtime remains independent;
- radar wire disconnect -> E2 becomes open-circuit.

## Terminal map

| Terminal | Simulated role | Bus | Logic |
| --- | --- | --- | --- |
| E1 | GPS RX/TX | UART | 3.3 V |
| E2 | Radar data | I2C / GPIO | 3.3 V |
| E3 | microSD | SPI | 3.3 V |
| E4 | local buzzer | GPIO | 3.3 V |
| GND | common low-voltage ground | GND | 0 V |

The terminal labels are a visualization contract, not a final vehicle harness pinout. Physical pin assignments, fusing, isolation, transient protection, EMC, grounding topology, connector family and wire gauge must be validated on target hardware.

## Evidence boundary

This module demonstrates software state transitions and operator understanding only. It does not prove electrical compatibility, HIL qualification, automotive EMC, physical watchdog behavior, sensor calibration, connector durability or public-road safety.

`controlAuthority` remains `none`. The simulator does not model or create steering, braking, throttle, gear, torque or CAN-write authority.
