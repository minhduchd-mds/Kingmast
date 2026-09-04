export type Severity = 'safe' | 'caution' | 'critical';
export type SensorState = 'ok' | 'degraded' | 'unavailable';
export type ObjectKind = 'person' | 'car' | 'motorcycle' | 'bicycle' | 'truck' | 'bus' | 'obstacle' | 'unknown';
export type RelativeZone = 'front' | 'front-left' | 'front-right' | 'left' | 'right' | 'rear';
export type AlertType = 'pedestrian-ahead' | 'vehicle-too-close' | 'vulnerable-road-user' | 'object-in-danger-zone' | 'geofence-entry' | 'sensor-degraded' | 'overspeed' | 'speed-limit-change';
export type PerceptionSource = 'radar-camera' | 'radar-only' | 'camera-only' | 'simulator';
export type EdgeHealthState = 'live' | 'degraded' | 'offline';
export type SpeedLimitSource = 'map' | 'sign-vision' | 'authorized-provider' | 'simulator' | 'unknown';
export type SpeedCompliance = 'unknown' | 'within-limit' | 'near-limit' | 'over-limit';
export type TrafficCameraKind = 'traffic-monitoring' | 'speed-enforcement' | 'red-light' | 'average-speed' | 'unknown';
export type TrafficCameraSource = 'osm' | 'authorized-provider' | 'runtime-provider';

export interface GeoPoint { lat:number; lng:number; }
export interface VehicleSample { timestampMs:number; egoSpeedMps:number; targetSpeedMps:number; rangeM:number; confidence:number; canHealthy:boolean; radarHealthy:boolean; cameraHealthy:boolean; }
export interface RiskAssessment { severity:Severity; ttcS:number|null; thwS:number|null; closingSpeedMps:number; confidence:number; reasons:string[]; }
export interface SensorHealth { radarFront:SensorState; radarRear:SensorState; camera:SensorState; can:SensorState; gnssImu:SensorState; ecu:SensorState; }
export interface VehiclePosition extends GeoPoint { speedKmh:number; headingDeg:number; accuracyM:number; timestampMs:number; source:'gnss'|'device-gps'|'simulator'; }
export interface DetectedObject { id:string; kind:ObjectKind; confidence:number; distanceM:number; bearingDeg:number; zone:RelativeZone; severity:Severity; relativeSpeedMps:number; position:GeoPoint; timestampMs:number; source?:PerceptionSource; }
export interface LocationAlert { id:string; type:AlertType; severity:Severity; title:string; message:string; distanceM:number|null; objectId:string|null; position:GeoPoint; timestampMs:number; acknowledged:boolean; }
export interface Geofence { id:string; name:string; center:GeoPoint; radiusM:number; severity:Exclude<Severity,'safe'>; enabled:boolean; }
export interface TelemetryFrame { sequence:number; vehicle:VehiclePosition; sensors:SensorHealth; objects:DetectedObject[]; alerts:LocationAlert[]; }
export interface CameraDetection { id:string; kind:ObjectKind; confidence:number; bearingDeg:number; estimatedDistanceM:number|null; timestampMs:number; }
export interface CameraDetectionFrame { cameraId:string; timestampMs:number; detections:CameraDetection[]; }
export interface RadarTrack { id:string; distanceM:number; bearingDeg:number; relativeSpeedMps:number; confidence:number; timestampMs:number; }
export interface RadarTrackFrame { radarId:string; timestampMs:number; tracks:RadarTrack[]; }
export interface EdgeGnssSample extends VehiclePosition { source:'gnss'; }
export interface EdgeTelemetryPacket { protocolVersion:1; deviceId:string; bootId:string; sequence:number; timestampMs:number; gnss:EdgeGnssSample; sensors:SensorHealth; radar?:RadarTrackFrame; camera?:CameraDetectionFrame; }
export interface EdgeSensorAges { gnss:number|null; radarFront:number|null; camera:number|null; }
export interface EdgeDiagnostics { status:EdgeHealthState; deviceId:string|null; bootId:string|null; lastSequence:number; lastIngressAtMs:number|null; lastPublishAtMs:number|null; connectedClients:number; rejectedPackets:number; sensorAgesMs:EdgeSensorAges; }
export interface RealtimeTelemetryEnvelope { type:'telemetry'; source:'edge'|'simulator'; receivedAtMs:number; frame:TelemetryFrame; diagnostics?:EdgeDiagnostics; }
export interface RealtimeHeartbeatEnvelope { type:'heartbeat'; receivedAtMs:number; lastSequence:number; connectedClients:number; }
export type RealtimeMessage = RealtimeTelemetryEnvelope | RealtimeHeartbeatEnvelope;
export interface EdgeEventRecord { id:string; timestampMs:number; sequence:number; severity:Severity; type:AlertType; title:string; message:string; objectId:string|null; position:GeoPoint; }
export interface SpeedSignObservation { cameraId:string; speedLimitKmh:number; confidence:number; bearingDeg:number; timestampMs:number; }
export interface SpeedLimitContext { currentKmh:number|null; source:SpeedLimitSource; confidence:number; roadName:string|null; conditional:string|null; observedAtMs:number; }
export interface TrafficCamera { id:string; position:GeoPoint; kind:TrafficCameraKind; operator:string|null; ref:string|null; directionDeg:number|null; speedLimitKmh:number|null; viewerUrl:string|null; source:TrafficCameraSource; publicData:boolean; distanceM:number; }
export interface RoadContext { position:GeoPoint; speedLimit:SpeedLimitContext; compliance:SpeedCompliance; cameras:TrafficCamera[]; fetchedAtMs:number; coverage:'provider-backed'|'partial-public-map'|'unavailable'; notes:string[]; }
export interface NavigationStep { instruction:string; distanceM:number; durationS:number; location:GeoPoint; roadName:string|null; }
export interface NavigationRoute { provider:'osrm'; origin:GeoPoint; destination:GeoPoint; distanceM:number; durationS:number; geometry:GeoPoint[]; steps:NavigationStep[]; fetchedAtMs:number; }
export interface NavigationPlace { id:string; name:string; subtitle:string|null; position:GeoPoint; source:'geocoder'; }

export interface EvProfile { batteryPct:number; usableBatteryKwh:number; rangeKm:number; consumptionWhPerKm:number; reservePct:number; }
export interface NavigationRouteOption { id:string; label:string; route:NavigationRoute; estimatedEnergyKwh:number; estimatedArrivalBatteryPct:number; reserveMarginPct:number; recommended:boolean; score:number; }
export interface SpeedZonePreview { id:string; position:GeoPoint; distanceAlongRouteM:number; limitKmh:number; roadName:string|null; source:'map'|'authorized-provider'; confidence:number; }
export type JunctionKind = 'traffic-signal'|'roundabout'|'merge'|'exit'|'crossing'|'unknown';
export interface JunctionPreview { id:string; position:GeoPoint; distanceAlongRouteM:number; kind:JunctionKind; roadName:string|null; }
export interface ChargingStation { id:string; name:string; position:GeoPoint; operator:string|null; powerKw:number|null; connectors:string[]; distanceAlongRouteM:number; detourDistanceM:number; source:'osm'|'authorized-provider'; }
export interface RouteIntelligence { speedZones:SpeedZonePreview[]; junctions:JunctionPreview[]; chargingStations:ChargingStation[]; coverage:'partial-public-map'|'provider-backed'|'unavailable'; generatedAtMs:number; notes:string[]; }

// Connected-road intelligence stays advisory and does not create vehicle-control authority.
export type ConnectedRoadSource = 'v2x-provider'|'authorized-provider'|'public-map'|'vehicle-sensor'|'simulator';
export type SpatSignalState = 'stop-and-remain'|'protected-movement-allowed'|'permissive-movement-allowed'|'protected-clearance'|'permissive-clearance'|'dark'|'unknown';
export interface SpatMovementState { signalGroup:number; state:SpatSignalState; minEndTimeMs:number|null; maxEndTimeMs:number|null; confidence:number; }
export interface SpatIntersectionState { intersectionId:string; name:string|null; position:GeoPoint; approachHeadingDeg:number|null; movements:SpatMovementState[]; timestampMs:number; source:ConnectedRoadSource; }
export type RoadZoneKind = 'school'|'construction';
export interface RoadZoneContext { id:string; kind:RoadZoneKind; name:string|null; position:GeoPoint; radiusM:number; active:boolean; advisorySpeedKmh:number|null; routeDistanceM:number|null; startsAtMs:number|null; endsAtMs:number|null; source:ConnectedRoadSource; confidence:number; }
export type WeatherCondition = 'clear'|'rain'|'heavy-rain'|'fog'|'storm'|'snow'|'unknown';
export type RoadSurfaceState = 'dry'|'wet'|'standing-water'|'icy'|'snow-covered'|'unknown';
export type RoadHazardKind = 'pothole'|'flooding'|'debris'|'low-visibility'|'slippery'|'crosswind'|'roadwork'|'unknown';
export interface RoadHazard { id:string; kind:RoadHazardKind; title:string; position:GeoPoint; distanceM:number|null; severity:Exclude<Severity,'safe'>; confidence:number; expiresAtMs:number|null; source:ConnectedRoadSource; }
export interface WeatherRoadContext { condition:WeatherCondition; temperatureC:number|null; precipitationMmH:number|null; visibilityM:number|null; windKmh:number|null; roadSurface:RoadSurfaceState; hazards:RoadHazard[]; timestampMs:number; source:ConnectedRoadSource; confidence:number; }
export type EmergencyVehicleKind = 'ambulance'|'fire'|'police'|'rescue'|'unknown';
export type EmergencyApproach = 'approaching'|'receding'|'stationary'|'unknown';
export interface EmergencyVehicleAdvisory { id:string; kind:EmergencyVehicleKind; position:GeoPoint; distanceM:number|null; bearingDeg:number|null; approach:EmergencyApproach; sirenDetected:boolean; confidence:number; timestampMs:number; source:ConnectedRoadSource; }
export type LaneManeuver = 'straight'|'left'|'right'|'uturn'|'merge-left'|'merge-right'|'exit'|'unknown';
export interface LaneDescriptor { index:number; maneuvers:LaneManeuver[]; preferred:boolean; exitOnly:boolean; destination:string|null; }
export interface LaneTopology { roadName:string|null; roadRef:string|null; laneCount:number; currentLaneIndex:number|null; lanes:LaneDescriptor[]; drivingSide:'left'|'right'|'unknown'; source:ConnectedRoadSource; confidence:number; timestampMs:number; }
export interface HighwayExitGuidance { id:string; position:GeoPoint; ref:string|null; name:string|null; destination:string|null; distanceM:number; side:'left'|'right'|'unknown'; targetLaneIndexes:number[]; source:ConnectedRoadSource; confidence:number; }
export type ConnectedRoadCategory = 'emergency-vehicle'|'spat'|'school-zone'|'construction-zone'|'weather'|'road-hazard'|'lane-guidance'|'highway-exit';
export interface ConnectedRoadAdvisory { id:string; category:ConnectedRoadCategory; severity:Severity; priority:number; title:string; message:string; distanceM:number|null; dedupeKey:string; suppressible:boolean; expiresAtMs:number|null; source:ConnectedRoadSource; }
export type ConnectedRoadTrustStatus='verified'|'expiring'|'expired'|'revoked'|'untrusted'|'unknown';
export type ConnectedRoadProviderTransport='mtls'|'signed-feed'|'token'|'none'|'unknown';
export interface ConnectedRoadProviderSecurity { transport:ConnectedRoadProviderTransport; trustStatus:ConnectedRoadTrustStatus; certificateExpiresAtMs:number|null; verifiedAtMs:number|null; detail:string|null; }
export interface ConnectedRoadProviderStatus { providerId:string; snapshotAgeMs:number; state:'healthy'|'degraded'|'stale'; security:ConnectedRoadProviderSecurity|null; liveV2xTrusted:boolean; }
export interface ConnectedRoadProviderSnapshot { providerId:string; timestampMs:number; spat?:SpatIntersectionState[]; zones?:RoadZoneContext[]; weather?:WeatherRoadContext|null; emergencyVehicles?:EmergencyVehicleAdvisory[]; laneTopology?:LaneTopology|null; exits?:HighwayExitGuidance[]; security?:ConnectedRoadProviderSecurity; }
export interface ConnectedRoadContext { spat:SpatIntersectionState[]; zones:RoadZoneContext[]; weather:WeatherRoadContext|null; emergencyVehicles:EmergencyVehicleAdvisory[]; laneTopology:LaneTopology|null; exits:HighwayExitGuidance[]; advisories:ConnectedRoadAdvisory[]; suppressedCount:number; suppressionReason:string|null; coverage:'provider-backed'|'partial-public-map'|'simulator'|'unavailable'; generatedAtMs:number; notes:string[]; }