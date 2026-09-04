export type Severity = 'safe' | 'caution' | 'critical';
export type SensorState = 'ok' | 'degraded' | 'unavailable';
export type ObjectKind =
  | 'person'
  | 'car'
  | 'motorcycle'
  | 'bicycle'
  | 'truck'
  | 'bus'
  | 'obstacle'
  | 'unknown';
export type RelativeZone = 'front' | 'front-left' | 'front-right' | 'left' | 'right' | 'rear';
export type AlertType =
  | 'pedestrian-ahead'
  | 'vehicle-too-close'
  | 'vulnerable-road-user'
  | 'object-in-danger-zone'
  | 'geofence-entry'
  | 'sensor-degraded'
  | 'overspeed'
  | 'speed-limit-change';
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

export interface SpeedSignObservation {
  cameraId:string;
  speedLimitKmh:number;
  confidence:number;
  bearingDeg:number;
  timestampMs:number;
}

export interface SpeedLimitContext {
  currentKmh:number|null;
  source:SpeedLimitSource;
  confidence:number;
  roadName:string|null;
  conditional:string|null;
  observedAtMs:number;
}

export interface TrafficCamera {
  id:string;
  position:GeoPoint;
  kind:TrafficCameraKind;
  operator:string|null;
  ref:string|null;
  directionDeg:number|null;
  speedLimitKmh:number|null;
  viewerUrl:string|null;
  source:TrafficCameraSource;
  publicData:boolean;
  distanceM:number;
}

export interface RoadContext {
  position:GeoPoint;
  speedLimit:SpeedLimitContext;
  compliance:SpeedCompliance;
  cameras:TrafficCamera[];
  fetchedAtMs:number;
  coverage:'provider-backed'|'partial-public-map'|'unavailable';
  notes:string[];
}

export interface NavigationStep {
  instruction:string;
  distanceM:number;
  durationS:number;
  location:GeoPoint;
  roadName:string|null;
}

export interface NavigationRoute {
  provider:'osrm';
  origin:GeoPoint;
  destination:GeoPoint;
  distanceM:number;
  durationS:number;
  geometry:GeoPoint[];
  steps:NavigationStep[];
  fetchedAtMs:number;
}
