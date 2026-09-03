# ECU Integration Plan — Warning-only MVP

## P0 bench
1. Replay recorded CAN/radar/camera data; no vehicle connection.
2. Validate timestamp skew, drop/freeze handling and deterministic risk output.
3. Build event ring buffer and sensor-health watchdog.

## P1 closed track
1. Automotive 77 GHz front/rear radar, HDR camera, GNSS/IMU and edge ECU.
2. CAN/CAN-FD through a physically/logically read-only gateway; OEM-approved DBC only.
3. Hardware watchdog, signed firmware, secure boot, thermal/power monitoring.
4. Fault injection: radar blocked, camera unavailable, CAN lost, timestamp drift, packet loss, overtemperature and reboot.

## P2 OEM readiness
AUTOSAR/VHAL/UDS/OTA integration is allowed only with OEM/Tier-1 participation, a functional safety program, cybersecurity TARA, SOTIF analysis, HIL evidence and homologation planning.

## Explicit prohibition
The MVP ECU shall not command brake, steer, throttle, gear or propulsion torque. Any future control path requires a new safety item definition, architecture and independent approval.
