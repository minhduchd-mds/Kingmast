# KINGMAST v0.0.7 — Friendly Voice + Traffic-Aware Navigation

## Scope

This increment keeps the production boundary warning-only / read-only (`controlAuthority: none`). It adds conversational voice output and navigation assistance; it does **not** add steering, braking, throttle, gear, torque or CAN-write authority.

## User flow

Example Vietnamese requests:

- `Kingmast, tìm đường ít tắc tới Hồ Gươm.`
- `Tìm lộ trình nhanh nhất tới sân bay Nội Bài.`
- `Chỉ đường đến Bệnh viện Bạch Mai.`
- No-diacritic forms such as `tim duong it tac toi ...` are also recognized.

Flow:

1. Native STT is preferred when an automotive host provides it; browser SpeechRecognition remains the fallback.
2. The assistant extracts only a bounded destination and route preference.
3. Existing KINGMAST place search resolves the destination near the current vehicle position.
4. The navigation service asks for route alternatives.
5. Provider order in `auto` mode is Google Routes traffic-aware -> Mapbox driving-traffic -> OSRM.
6. The selected route is written into the existing `RoadContextController` state. `NativeNavigationMap` therefore renders the route using the same MapLibre route source already used by manual navigation.
7. The assistant speaks a short factual summary with distance and ETA.
8. If the selected route has `traffic.aware=false`, the assistant explicitly says live traffic is unavailable and never describes the route as least congested.

## Neural TTS

HMI route: `POST /api/kingmast/tts`

Provider order in `auto` mode:

1. OpenAI `gpt-4o-mini-tts` (default voice `marin`)
2. ElevenLabs multilingual TTS
3. Approved self-hosted `audio/*` endpoint
4. Native `kingmastNative.voice.speak`
5. Browser Web Speech

All external TTS credentials remain server-side. The HMI never receives an OpenAI, ElevenLabs, Google Routes or Mapbox key.

Vietnamese delivery is intentionally conversational: warm, concise, calm, natural pauses, and short output while the vehicle is moving. Safety-critical facts still come from grounded runtime context rather than the speech provider.

### Optional self-hosted Vietnamese TTS

The MiraAI research notes were reused as architectural input, not copied implementation. Recommended optional building blocks:

- `pnnbao97/VieNeu-TTS` — self-hosted Vietnamese TTS candidate.
- `v-nhandt21/Vinorm` — Vietnamese text normalization before synthesis.

KINGMAST does not need Rhubarb lip-sync because the HMI has no speaking avatar. F5-TTS-Vietnamese is not selected as a production default because its commonly used Vietnamese model/license path needs separate commercial-license review.

## Traffic-aware routing

### Google Routes

When `GOOGLE_ROUTES_API_KEY` is configured, KINGMAST requests `TRAFFIC_AWARE_OPTIMAL`, alternatives and a GeoJSON route line. `duration` is traffic-aware while `staticDuration` is used to estimate traffic delay. The key is sent only by the risk-engine server.

### Mapbox

When `MAPBOX_ACCESS_TOKEN` is configured, KINGMAST uses `mapbox/driving-traffic` with route alternatives and GeoJSON geometry. Route duration is traffic-aware and `duration_typical`, when supplied, is used to estimate added delay.

### OSRM fallback

OSRM remains the no-key fallback for development and routing availability. Its output is marked:

```json
{"aware":false,"source":"none","delayS":null,"observedAtMs":null}
```

This is deliberate truthfulness: OSRM fallback can provide a route, but it is not treated as live-traffic evidence.

## Supporting technology / repositories

- `maplibre/maplibre-gl-js` — already used by KINGMAST to render the route locally in the HMI.
- `valhalla/valhalla` — future self-host routing option when KINGMAST has an operational live-traffic ingestion pipeline. Valhalla is not marked traffic-aware merely because it is self-hosted.
- `pnnbao97/VieNeu-TTS` — optional on-prem Vietnamese voice service.
- `v-nhandt21/Vinorm` — optional Vietnamese text normalization.

External projects are reference/integration dependencies only. KINGMAST does not copy proprietary OEM algorithms or code.

## Configuration

Server-only voice:

```env
KINGMAST_TTS_PROVIDER=auto
OPENAI_API_KEY=
KINGMAST_OPENAI_TTS_MODEL=gpt-4o-mini-tts
KINGMAST_OPENAI_TTS_VOICE=marin
ELEVENLABS_API_KEY=
KINGMAST_ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
KINGMAST_ELEVENLABS_TTS_VOICE=
KINGMAST_TTS_SELF_HOST_URL=
KINGMAST_TTS_SELF_HOST_TOKEN=
```

Server-only traffic routing:

```env
KINGMAST_TRAFFIC_ROUTING_PROVIDER=auto
GOOGLE_ROUTES_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

None of these credentials may use a `NEXT_PUBLIC_*` name.

## Validation boundary

Software CI can verify parsing, safety boundaries, provider failover, secret placement, route provenance and map integration. It cannot claim target-display 60 FPS, vehicle-computer qualification, physical HIL completion or public-road approval. Those remain separate physical evidence gates.

The merge decision must use CI and CodeQL results produced for the same final pull-request head after the PR targets `main`; results from an earlier stacked base are not promoted to the final feature commit.
