# KINGMAST Edge Realtime Integration

## Scope
KINGMAST Edge v3 is warning-only. It ingests GNSS, radar tracks and camera classifications, fuses them into detected road objects, projects those objects onto GPS coordinates, generates location-aware alerts and streams the result to the HMI over WebSocket. It has no steering, braking, throttle, gear or torque authority.

## ESP32 prototype hardware overview

![KINGMAST ESP32 prototype hardware schematic](hardware/kingmast-esp32-prototype-schematic.svg)

The SVG above documents the prototype power path, ESP32 controller, reference GNSS/radar connections and optional development modules. It is a research wiring reference only. Optional CAN/OBD, 4G, OLED, buzzer and auxiliary sensor blocks must not be interpreted as implemented production interfaces unless the corresponding firmware and vehicle adapter are present and validated.

## Data flow

```text
GNSS module ─UART─> ESP32 ─HTTP /v3/edge/frame─┐
Front radar ─UART/CAN-adapter─> ESP32 ─────────┤
                                               ├─> risk-engine edge fusion
Front camera ─> edge compute ─HTTP /v3/perception/camera─┤
                                               └─> WebSocket /v3/stream ─> HMI
```

Radar provides metric range and relative velocity. Camera detection provides object class and confidence. Camera/radar matching is intentionally gated by timestamp, bearing and optional distance. A stale radar or camera frame is excluded instead of reused.

## ESP32 reference wiring

This is a development reference, not a vehicle-certified wiring harness.

```text
GNSS TX  ─────────> ESP32 GPIO16 / UART1 RX
GNSS RX  <───────── ESP32 GPIO17 / UART1 TX (optional)
GNSS GND ────────── ESP32 GND

Radar TX ─────────> ESP32 GPIO26 / UART2 RX
Radar RX <───────── ESP32 GPIO27 / UART2 TX (only if vendor protocol requires it)
Radar GND────────── ESP32 GND

ESP32 Wi-Fi ───────> KINGMAST risk-engine HTTP endpoint
```

Do not connect an automotive CAN bus directly to ESP32 GPIO. Use a galvanically isolated, automotive-rated CAN transceiver/gateway and keep the KINGMAST path read-only. Vendor radar power, voltage levels and protocol must be checked against its datasheet before connection.

## Firmware

Path: `edge/esp32/kingmast_edge/`

Arduino dependencies:
- ArduinoJson 7
- TinyGPSPlus
- ESP32 Arduino core

Copy `config.example.h` to `config.h`, configure Wi-Fi/API and board UART pins, then flash the ESP32. The generic radar parser accepts a development CSV stream:

```text
track_id,distance_m,bearing_deg,relative_speed_mps,confidence
```

Replace that parser with the selected radar vendor's documented UART/CAN protocol. Never guess a radar protocol.

## Camera detector

Path: `edge/camera-detector/`

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python detector.py --api http://127.0.0.1:4000/v3/perception/camera --source 0
```

The detector classifies supported road users and sends bearing/confidence. It intentionally sends `estimatedDistanceM: null`; radar remains the metric distance source when available. For production research, replace the default model with a validated ONNX/TensorRT pipeline and calibrated camera intrinsics.

## Authentication boundary

Edge ingress and viewer access use separate credentials.

- `KINGMAST_EDGE_TOKEN` authenticates sensor/edge ingestion. It never grants viewer access.
- `KINGMAST_VIEWER_TOKEN` is a **server-only signing/bootstrap secret**. Never expose it through `NEXT_PUBLIC_*`, client JavaScript, local storage or a browser-readable cookie.
- The HMI server route `/api/kingmast/session` mints a signed `kingmast_viewer_session` cookie with fixed `viewer:read` scope and a 10-minute lifetime. The shared viewer secret never enters the browser.
- Viewer API/WebSocket routes accept the signed scoped session cookie. A raw viewer secret is accepted only by `POST /v3/session` as a bootstrap exchange via trusted header/Bearer authentication.
- Session issuance rejects cross-origin browser requests and cookies are `HttpOnly`; production cookies are `Secure`.
- For browser WebSocket authentication across sibling HMI/gateway hosts, configure `KINGMAST_VIEWER_COOKIE_DOMAIN` to a validated shared parent domain. If the HMI and gateway are on unrelated registrable domains, use a same-site gateway/BFF deployment instead of exposing the shared viewer secret to the browser.

The scoped viewer session is read/advisory only. It does not grant edge ingestion, geofence writes, actuator control or generic CAN-write authority.

## Realtime endpoints

- `POST /v3/session`: exchange trusted server/operator viewer bootstrap credentials for a short-lived scoped viewer cookie.
- `POST /v3/edge/frame`: ESP32 edge packet with GNSS/sensor health and optional radar/camera frames.
- `POST /v3/edge/gnss`: GNSS-only update.
- `POST /v3/perception/radar`: radar frame from a separate radar gateway.
- `POST /v3/perception/camera`: camera detections from edge compute.
- `GET /v3/edge/latest`: latest fused frame; viewer session required.
- `WS /v3/stream`: realtime fused telemetry to HMI; viewer session required.

## HMI

Set:

```text
NEXT_PUBLIC_KINGMAST_API_URL=http://EDGE_HOST:4000
NEXT_PUBLIC_KINGMAST_WS_URL=ws://EDGE_HOST:4000/v3/stream
```

The HMI establishes a viewer session before opening the edge WebSocket. If a configured live stream becomes stale or unavailable, the UI reports degraded/offline state explicitly; it does **not** silently replace live telemetry with simulator data. Deterministic simulation remains an intentional development/demo source rather than a hidden production fallback. Browser device GPS can still be selected manually for UI testing.

## Safety gates

Before any closed-track integration, verify timestamp synchronization, stale-frame rejection, GNSS loss/drift behavior, radar-camera association, sensor watchdogs, power isolation, read-only vehicle data access and emergency stop of the research rig. No public-road actuator control is in scope.
