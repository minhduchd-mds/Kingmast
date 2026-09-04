# KINGMAST V2.2 Navigation, Speed Limits and Traffic-Camera Context

## Scope
V2.2 adds advisory navigation and road-context awareness while preserving the Level-0 warning-only boundary. It does not steer, brake, accelerate, alter drivetrain state or write vehicle CAN commands.

## 20 consolidated upgrades
1. Road-context domain contracts.
2. Current road speed-limit model.
3. Speed-compliance state with display tolerance.
4. OpenStreetMap `maxspeed` parsing.
5. Conditional speed-limit metadata retention.
6. Public mapped traffic-camera discovery.
7. Authorized JSON camera-provider aggregation.
8. Runtime provider ingest for city/partner camera registries.
9. Camera deduplication across providers.
10. Camera kind/operator/ref/direction normalization.
11. Camera distance sorting around the vehicle.
12. Optional traffic-camera viewer URL metadata for authorized sources only.
13. Speed-sign vision observation endpoint.
14. High-confidence, short-lived sign/map speed-limit fusion.
15. Separate YOLO speed-sign publisher; raw video stays at the edge.
16. OSRM-compatible route calculation.
17. Typed route geometry and maneuver steps.
18. HMI speed-limit badge and overspeed warning state.
19. HMI mapped-camera overlay plus route entry/summary.
20. PostgreSQL schema and CI validation for the navigation/sign detector batch.

## Camera coverage policy
KINGMAST does not and cannot truthfully claim to discover every traffic camera. The aggregator combines data that is either publicly mapped or supplied by an explicitly authorized provider. Protected CCTV systems are never scanned, credential-guessed, scraped around authentication or accessed without permission.

Configured sources:
- OpenStreetMap/Overpass public metadata.
- `KINGMAST_CAMERA_PROVIDER_URLS`: comma-separated HTTPS JSON provider endpoints.
- `POST /v4/road-context/cameras`: authenticated runtime registry ingest.

Provider JSON shape:
```json
{
  "cameras": [
    {
      "id": "city-cam-100",
      "position": {"lat": 21.0285, "lng": 105.8542},
      "kind": "traffic-monitoring",
      "operator": "Authorized operator",
      "ref": "CAM-100",
      "directionDeg": 90,
      "speedLimitKmh": null,
      "viewerUrl": "https://authorized.example/camera/100",
      "publicData": true
    }
  ]
}
```

## Speed-limit resolution
1. A local sign observation may be used only when confidence is at least 0.90 and the observation is no older than 6 seconds.
2. Otherwise KINGMAST uses the nearest mapped road `maxspeed` value when available.
3. Unknown/implicit limits remain unknown rather than guessed.
4. The HMI enters `over-limit` only above the resolved limit plus a small 3 km/h display tolerance.
5. Sign recognition remains advisory and must be validated against the target camera, model, country sign set and ODD before road trials.

## APIs
- `GET /v4/road-context?lat=&lng=&speedKmh=&radiusM=`
- `POST /v4/navigation/route`
- `POST /v4/perception/speed-sign`
- `POST /v4/road-context/cameras`
- `GET /v4/road-context/providers`

## Navigation provider
The default development router is the public OSRM demo endpoint. Production/vehicle testing should use a controlled or self-hosted routing service with an explicit SLA and offline strategy. Route guidance is informational and has no control authority.

## Edge sign model
`edge/camera-detector/speed_sign_detector.py` requires a dedicated traffic-sign YOLO model. KINGMAST deliberately does not pretend the generic COCO object model can recognize numeric speed limits. Model class names should contain forms such as `speed_limit_50`, `speed-limit-80` or `limit_60`.

## Validation gates
- Wrong/stale speed-sign observation does not survive the freshness gate.
- Unknown map limits remain unknown.
- Camera provider outage does not block the driving HMI.
- Duplicate camera locations collapse to one marker.
- Navigation provider outage degrades independently from warning telemetry.
- No raw municipal/partner camera credentials are committed to Git.
- No actuator/control API is introduced.
