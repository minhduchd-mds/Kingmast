import type { GeoPoint,SensorState,Severity } from './index.js';

export type RuntimeDataMode='live-edge'|'gps-only'|'demo'|'replay';
export type NextgenDataSource='camera'|'radar'|'gnss'|'imu'|'map'|'authorized-provider'|'trusted-device'|'simulator';
export type CameraMount='front'|'rear'|'left'|'right'|'cabin';
export type CameraCalibrationState='calibrated'|'degraded'|'uncalibrated';
export type NavigationHorizonKind='speed-limit'|'curvature'|'grade'|'junction'|'lane-guidance'|'hazard'|'traffic'|'school-zone'|'construction-zone';
export type DriverRole='owner'|'admin'|'driver'|'guest'|'valet'|'service';
export type VehiclePermission='vehicle.use'|'vehicle.unlock'|'profile.read.self'|'profile.edit.self'|'trip.history.read'|'camera.live.view'|'camera.history.export'|'users.manage'|'keys.share'|'settings.safety.change'|'diagnostics.read';

export interface EvidenceMeta {
  source:NextgenDataSource;
  capturedAtMs:number;
  receivedAtMs:number;
  confidence:number;
  health:SensorState;
}

export interface CameraNodeStatus {
  cameraId:string;
  mount:CameraMount;
  calibration:CameraCalibrationState;
  synchronized:boolean;
  frameAgeMs:number|null;
  reprojectionErrorPx:number|null;
  health:SensorState;
}

export interface PerceptionObjectTrack {
  id:string;
  kind:'person'|'car'|'motorcycle'|'bicycle'|'truck'|'bus'|'animal'|'barrier'|'debris'|'unknown';
  confidence:number;
  distanceM:number|null;
  relativeBearingDeg:number|null;
  relativeSpeedMps:number|null;
  position:GeoPoint|null;
  firstSeenAtMs:number;
  lastSeenAtMs:number;
  sources:NextgenDataSource[];
}

export interface LanePerception {
  laneId:string;
  side:'left'|'right'|'center'|'unknown';
  confidence:number;
  curvature1pm:number|null;
  distanceToBoundaryM:number|null;
}

export interface FreeSpaceSector {
  bearingStartDeg:number;
  bearingEndDeg:number;
  freeDistanceM:number;
  confidence:number;
}

export interface PerceptionFrame {
  vehicleId:string;
  frameId:string;
  mode:RuntimeDataMode;
  capturedAtMs:number;
  receivedAtMs:number;
  cameras:CameraNodeStatus[];
  objects:PerceptionObjectTrack[];
  lanes:LanePerception[];
  freeSpace:FreeSpaceSector[];
  degradedReasons:string[];
}

export interface NavigationHorizonEvent {
  id:string;
  kind:NavigationHorizonKind;
  title:string;
  position:GeoPoint|null;
  distanceM:number;
  severity:Severity;
  advisorySpeedKmh:number|null;
  curvature1pm:number|null;
  gradePct:number|null;
  confidence:number;
  evidence:EvidenceMeta;
}

export interface NavigationHorizon {
  vehicleId:string;
  generatedAtMs:number;
  origin:GeoPoint;
  headingDeg:number;
  lookaheadM:number;
  coverage:'provider-backed'|'sensor-assisted'|'partial'|'unavailable';
  events:NavigationHorizonEvent[];
  notes:string[];
}

export interface DriverPrivacyPreferences {
  locationHistory:boolean;
  cameraHistory:boolean;
  personalization:boolean;
  diagnosticsUpload:boolean;
}

export interface DriverUiPreferences {
  language:'vi'|'en';
  theme:'auto'|'light'|'dark';
  mapZoom:number;
  warningVolume:number;
}

export interface DriverProfile {
  id:string;
  displayName:string;
  role:DriverRole;
  trustedDeviceIds:string[];
  privacy:DriverPrivacyPreferences;
  ui:DriverUiPreferences;
  home:GeoPoint|null;
  work:GeoPoint|null;
  updatedAtMs:number;
}

export interface DriverIdentitySignal {
  trustedDeviceId:string|null;
  faceProfileId:string|null;
  faceConfidence:number|null;
  observedAtMs:number;
}

export interface VehicleAccessGrant {
  grantId:string;
  vehicleId:string;
  profileId:string;
  role:DriverRole;
  permissions:VehiclePermission[];
  validFromMs:number;
  validUntilMs:number|null;
  issuedByProfileId:string;
  revokedAtMs:number|null;
}

export interface VehicleAccessDecision {
  allowed:boolean;
  permission:VehiclePermission;
  reason:'allowed'|'grant-not-active'|'grant-expired'|'grant-revoked'|'permission-missing'|'role-restricted';
}

export type TrafficSignalState='red'|'amber'|'green'|'flashing'|'off'|'unknown';
export type TrafficControlKind='speed-limit'|'stop-sign'|'yield-sign'|'traffic-light';
export interface TrafficControlObservation {
  id:string;
  cameraId:string;
  kind:TrafficControlKind;
  speedLimitKmh:number|null;
  signalState:TrafficSignalState|null;
  confidence:number;
  relativeBearingDeg:number;
  estimatedDistanceM:number|null;
  capturedAtMs:number;
  receivedAtMs:number;
}

export type DriverState='attentive'|'distracted'|'drowsy'|'driver-unavailable'|'unknown';
export interface DriverStateObservation {
  observedAtMs:number;
  faceDetected:boolean;
  eyesClosed:boolean;
  gazeAway:boolean;
  headYawDeg:number;
  headPitchDeg:number;
  confidence:number;
}
export interface DriverStateAssessment {
  state:DriverState;
  confidence:number;
  observedAtMs:number|null;
  ageMs:number|null;
  reason:string;
  advisoryOnly:true;
}

export type ProfileMemoryKind='recent-place'|'preferred-route'|'ui-preference';
export interface ProfileMemoryEntry {
  id:string;
  profileId:string;
  kind:ProfileMemoryKind;
  label:string;
  position:GeoPoint|null;
  routeKey:string|null;
  createdAtMs:number;
  lastUsedAtMs:number;
}

export interface VehicleAccessAuditEvent {
  id:string;
  vehicleId:string;
  profileId:string;
  permission:VehiclePermission;
  allowed:boolean;
  reason:VehicleAccessDecision['reason'];
  timestampMs:number;
}

export interface CameraPerformanceSnapshot {
  cameraId:string;
  capturedFrames:number;
  processedFrames:number;
  droppedFrames:number;
  latestLatencyMs:number|null;
  averageLatencyMs:number|null;
  p95LatencyMs:number|null;
}

export interface PredictiveAdvisory {
  id:string;
  kind:NavigationHorizonKind;
  severity:Severity;
  title:string;
  message:string;
  distanceM:number;
  confidence:number;
  generatedAtMs:number;
  advisoryOnly:true;
}
