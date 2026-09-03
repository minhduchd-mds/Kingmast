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
  | 'sensor-degraded';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface VehicleSample {
  timestampMs: number;
  egoSpeedMps: number;
  targetSpeedMps: number;
  rangeM: number;
  confidence: number;
  canHealthy: boolean;
  radarHealthy: boolean;
  cameraHealthy: boolean;
}

export interface RiskAssessment {
  severity: Severity;
  ttcS: number | null;
  thwS: number | null;
  closingSpeedMps: number;
  confidence: number;
  reasons: string[];
}

export interface SensorHealth {
  radarFront: SensorState;
  radarRear: SensorState;
  camera: SensorState;
  can: SensorState;
  gnssImu: SensorState;
  ecu: SensorState;
}

export interface VehiclePosition extends GeoPoint {
  speedKmh: number;
  headingDeg: number;
  accuracyM: number;
  timestampMs: number;
  source: 'gnss' | 'device-gps' | 'simulator';
}

export interface DetectedObject {
  id: string;
  kind: ObjectKind;
  confidence: number;
  distanceM: number;
  bearingDeg: number;
  zone: RelativeZone;
  severity: Severity;
  relativeSpeedMps: number;
  position: GeoPoint;
  timestampMs: number;
}

export interface LocationAlert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  distanceM: number | null;
  objectId: string | null;
  position: GeoPoint;
  timestampMs: number;
  acknowledged: boolean;
}

export interface Geofence {
  id: string;
  name: string;
  center: GeoPoint;
  radiusM: number;
  severity: Exclude<Severity, 'safe'>;
  enabled: boolean;
}

export interface TelemetryFrame {
  sequence: number;
  vehicle: VehiclePosition;
  sensors: SensorHealth;
  objects: DetectedObject[];
  alerts: LocationAlert[];
}
