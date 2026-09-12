# KINGMAST ESP32 WebGL Digital Twin

Status: software-in-the-loop visualization for KINGMAST v0.0.8.

Route: `/lab/esp32`

## Purpose

The WebGL lab makes the ESP32/Raspberry Pi failure domains and wiring model inspectable without claiming physical qualification. It uses the browser's native WebGL context, so the HMI does not add Three.js or another heavy rendering dependency.

## 3D interaction

- Drag the scene to orbit the camera through 360 degrees.
- Use the mouse wheel/trackpad to zoom.
- ESP32 pins are projected from their 3D coordinates into interactive screen hotspots.
- Terminal points E1-E4/GND are also projected from the 3D terminal block.
- Drag a terminal hotspot onto an ESP32 pin to add/remove a simulated cable.
- Click a GPIO hotspot to inspect its bus and current simulated connection.

The current research mapping is:

| Terminal | Role | Compatible ESP32 pins in the simulator |
| --- | --- | --- |
| E1 | GPS UART | GPIO16 / GPIO17 |
| E2 | Radar I2C/GPIO | GPIO21 / GPIO22 |
| E3 | microSD SPI | GPIO18 / GPIO19 / GPIO23 / GPIO5 |
| E4 | local buzzer | GPIO27 |
| GND | signal ground | GND |

This table is a simulation contract, not a final production harness pinout. Final pin selection must be validated against the exact ESP32 board, carrier PCB, sensors, voltage domains, EMC design and vehicle harness.

## Fault injection

The WebGL lab keeps the same resilience behaviors as the previous digital twin:

- Wi-Fi loss -> realtime uplink stops and recoverable telemetry is shown as microSD spool traffic.
- SD fault -> realtime can continue while local durable buffering is unavailable.
- Pi OS crash -> A/B rollback state is shown before returning to known-good health.
- Pi hardware loss -> ESP32 remains a separate safety island; standby promotion remains witness-gated.
- ESP32 reset -> Pi/camera can remain alive while sensor telemetry restarts.
- Radar wire disconnect -> E2 is shown as an open circuit and its cable changes to a broken state.

## Rendering boundary

The scene renders simplified WebGL geometry for devices, pins and the terminal block. It is intentionally not CAD geometry and does not assert mechanical dimensions, connector retention, electrical isolation, thermal behavior or EMC compliance.

Future GLTF/CAD assets can replace the simplified meshes while keeping the same pin projection and fault-state contracts.

## Safety boundary

The simulator remains warning/telemetry research only. It does not create steering, braking, throttle, gear, torque or CAN-write authority. `controlAuthority` remains `none`.
