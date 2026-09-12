import type {
  CameraDetectionFrame,
  EdgeSensorAges,
  RadarTrackFrame,
  SensorHealth,
  VehiclePosition,
} from '@kingmast/contracts';

export type SotifFeature =
  | 'front-collision-warning'
  | 'object-awareness'
  | 'lane-departure-warning'
  | 'navigation-context';

export type SotifRuntimeState = 'nominal' | 'degraded' | 'unavailable' | 'outside-research-envelope';
export type AssuranceState = 'verified' | 'unknown' | 'invalid';
export type VisibilityState = 'normal' | 'reduced' | 'severely-reduced' | 'unknown';
export type IlluminationState = 'normal' | 'low' | 'glare' | 'transition' | 'unknown';
export type PrecipitationState = 'none' | 'rain' | 'heavy-rain' | 'unknown';

export type SotifReasonCode =
  | 'radar-unavailable'
  | 'radar-degraded'
  | 'radar-stale'
  | 'radar-future-dated'
  | 'camera-unavailable'
  | 'camera-degraded'
  | 'camera-stale'
  | 'camera-future-dated'
  | 'gnss-unavailable'
  | 'gnss-degraded'
  | 'gnss-stale'
  | 'gnss-future-dated'
  | 'can-unavailable'
  | 'can-degraded'
  | 'radar-calibration-unknown'
  | 'radar-calibration-invalid'
  | 'camera-calibration-unknown'
  | 'camera-calibration-invalid'
  | 'time-sync-unknown'
  | 'time-sync-invalid'
  | 'camera-obstructed-observed'
  | 'low-visibility-observed'
  | 'heavy-precipitation-observed'
  | 'glare-observed'
  | 'illumination-transition-observed'
  | 'cross-sensor-disagreement'
  | 'speed-envelope-unverified'
  | 'outside-validated-speed-envelope'
  | 'gnss-accuracy-envelope-unverified'
  | 'gnss-accuracy-outside-envelope';

export interface SotifEnvironmentObservation {
  observedAtMs: number;
  source: 'vehicle-sensor' | 'authorized-provider' | 'test-fixture';
  visibility: VisibilityState;
  illumination: IlluminationState;
  precipitation: PrecipitationState;
  cameraObstructed: boolean | null;
}

export interface SotifAssuranceInput {
  radarFrontCalibration: AssuranceState;
  cameraCalibration: AssuranceState;
  timeSync: AssuranceState;
}

export interface SotifFusionQuality {
  radarTrackCount: number;
  cameraDetectionCount: number;
  matchedCount: number;
  disagreementCount: number;
  maxTimestampSkewMs: number | null;
}

export interface SotifMonitorPolicy {
  maxRadarAgeMs: number;
  maxCameraAgeMs: number;
  maxGnssAgeMs: number;
  maxFutureSkewMs: number;
  maxCrossSensorSkewMs: number;
  minimumMatchRatioWhenBothObserve: number;
  validatedSpeedRangeKmh: { min: number; max: number } | null;
  maxGnssAccuracyM: number | null;
}

export interface SotifAllowedClaims {
  radarRange: boolean;
  relativeSpeed: boolean;
  objectClassification: boolean;
  laneGeometry: boolean;
  precisePosition: boolean;
  criticalCollisionWarning: boolean;
}

export interface SotifRuntimeAssessment {
  feature: SotifFeature;
  state: SotifRuntimeState;
  confidenceCeiling: number;
  reasons: SotifReasonCode[];
  triggeringConditions: SotifReasonCode[];
  allowedClaims: SotifAllowedClaims;
  controlAuthority: 'none';
  qualificationClaim: 'research-runtime-monitor-only';
}

export interface SotifMonitorInput {
  feature: SotifFeature;
  nowMs: number;
  vehicle: VehiclePosition;
  sensors: SensorHealth;
  sensorAgesMs?: Partial<EdgeSensorAges>;
  radar?: RadarTrackFrame;
  camera?: CameraDetectionFrame;
  assurance: SotifAssuranceInput;
  environment?: SotifEnvironmentObservation;
  fusion?: SotifFusionQuality;
  policy?: Partial<SotifMonitorPolicy>;
}

const DEFAULT_POLICY: SotifMonitorPolicy = {
  maxRadarAgeMs: 250,
  maxCameraAgeMs: 350,
  maxGnssAgeMs: 1_000,
  maxFutureSkewMs: 50,
  maxCrossSensorSkewMs: 120,
  minimumMatchRatioWhenBothObserve: 0.25,
  // No validated physical speed/accuracy envelope is claimed by default. A controlled
  // test programme must provide these bounds explicitly before the monitor can call them validated.
  validatedSpeedRangeKmh: null,
  maxGnssAccuracyM: null,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function add(list: SotifReasonCode[], reason: SotifReasonCode) {
  if (!list.includes(reason)) list.push(reason);
}

function ageFrom(explicit: number | null | undefined, timestampMs: number | undefined, nowMs: number) {
  if (explicit !== undefined && explicit !== null) return explicit;
  return timestampMs === undefined ? null : nowMs - timestampMs;
}

function fresh(ageMs: number | null, maxAgeMs: number, maxFutureSkewMs: number) {
  return ageMs !== null && ageMs >= -maxFutureSkewMs && ageMs <= maxAgeMs;
}

function matchRatio(fusion: SotifFusionQuality) {
  const denominator = Math.max(1, Math.min(fusion.radarTrackCount, fusion.cameraDetectionCount));
  return fusion.matchedCount / denominator;
}

function stateRank(state: SotifRuntimeState) {
  if (state === 'unavailable') return 3;
  if (state === 'outside-research-envelope') return 2;
  if (state === 'degraded') return 1;
  return 0;
}

function worsen(current: SotifRuntimeState, next: SotifRuntimeState) {
  return stateRank(next) > stateRank(current) ? next : current;
}

export function assessSotifRuntime(input: SotifMonitorInput): SotifRuntimeAssessment {
  const policy: SotifMonitorPolicy = { ...DEFAULT_POLICY, ...input.policy };
  const reasons: SotifReasonCode[] = [];
  const triggeringConditions: SotifReasonCode[] = [];
  let state: SotifRuntimeState = 'nominal';
  let confidenceCeiling = 1;

  const radarAge = ageFrom(input.sensorAgesMs?.radarFront, input.radar?.timestampMs, input.nowMs);
  const cameraAge = ageFrom(input.sensorAgesMs?.camera, input.camera?.timestampMs, input.nowMs);
  const gnssAge = ageFrom(input.sensorAgesMs?.gnss, input.vehicle.timestampMs, input.nowMs);

  const radarFresh = fresh(radarAge, policy.maxRadarAgeMs, policy.maxFutureSkewMs);
  const cameraFresh = fresh(cameraAge, policy.maxCameraAgeMs, policy.maxFutureSkewMs);
  const gnssFresh = fresh(gnssAge, policy.maxGnssAgeMs, policy.maxFutureSkewMs);

  if (radarAge !== null && radarAge < -policy.maxFutureSkewMs) add(reasons, 'radar-future-dated');
  else if (radarAge !== null && radarAge > policy.maxRadarAgeMs) add(reasons, 'radar-stale');
  if (cameraAge !== null && cameraAge < -policy.maxFutureSkewMs) add(reasons, 'camera-future-dated');
  else if (cameraAge !== null && cameraAge > policy.maxCameraAgeMs) add(reasons, 'camera-stale');
  if (gnssAge !== null && gnssAge < -policy.maxFutureSkewMs) add(reasons, 'gnss-future-dated');
  else if (gnssAge !== null && gnssAge > policy.maxGnssAgeMs) add(reasons, 'gnss-stale');

  if (input.sensors.radarFront === 'unavailable') add(reasons, 'radar-unavailable');
  else if (input.sensors.radarFront === 'degraded') add(reasons, 'radar-degraded');
  if (input.sensors.camera === 'unavailable') add(reasons, 'camera-unavailable');
  else if (input.sensors.camera === 'degraded') add(reasons, 'camera-degraded');
  if (input.sensors.gnssImu === 'unavailable') add(reasons, 'gnss-unavailable');
  else if (input.sensors.gnssImu === 'degraded') add(reasons, 'gnss-degraded');
  if (input.sensors.can === 'unavailable') add(reasons, 'can-unavailable');
  else if (input.sensors.can === 'degraded') add(reasons, 'can-degraded');

  if (input.assurance.radarFrontCalibration === 'invalid') add(reasons, 'radar-calibration-invalid');
  else if (input.assurance.radarFrontCalibration === 'unknown') add(reasons, 'radar-calibration-unknown');
  if (input.assurance.cameraCalibration === 'invalid') add(reasons, 'camera-calibration-invalid');
  else if (input.assurance.cameraCalibration === 'unknown') add(reasons, 'camera-calibration-unknown');
  if (input.assurance.timeSync === 'invalid') add(reasons, 'time-sync-invalid');
  else if (input.assurance.timeSync === 'unknown') add(reasons, 'time-sync-unknown');

  const environmentFresh = input.environment
    ? input.environment.observedAtMs <= input.nowMs + policy.maxFutureSkewMs
      && input.nowMs - input.environment.observedAtMs <= 5_000
    : false;
  if (environmentFresh && input.environment) {
    if (input.environment.cameraObstructed === true) {
      add(reasons, 'camera-obstructed-observed');
      add(triggeringConditions, 'camera-obstructed-observed');
    }
    if (input.environment.visibility === 'reduced' || input.environment.visibility === 'severely-reduced') {
      add(reasons, 'low-visibility-observed');
      add(triggeringConditions, 'low-visibility-observed');
    }
    if (input.environment.precipitation === 'heavy-rain') {
      add(reasons, 'heavy-precipitation-observed');
      add(triggeringConditions, 'heavy-precipitation-observed');
    }
    if (input.environment.illumination === 'glare') {
      add(reasons, 'glare-observed');
      add(triggeringConditions, 'glare-observed');
    } else if (input.environment.illumination === 'transition') {
      add(reasons, 'illumination-transition-observed');
      add(triggeringConditions, 'illumination-transition-observed');
    }
  }

  if (input.fusion && input.fusion.radarTrackCount > 0 && input.fusion.cameraDetectionCount > 0) {
    const skewBad = input.fusion.maxTimestampSkewMs !== null && input.fusion.maxTimestampSkewMs > policy.maxCrossSensorSkewMs;
    const agreementBad = matchRatio(input.fusion) < policy.minimumMatchRatioWhenBothObserve;
    if (skewBad || agreementBad || input.fusion.disagreementCount > 0) {
      add(reasons, 'cross-sensor-disagreement');
      add(triggeringConditions, 'cross-sensor-disagreement');
    }
  }

  if (policy.validatedSpeedRangeKmh === null) {
    add(reasons, 'speed-envelope-unverified');
  } else if (input.vehicle.speedKmh < policy.validatedSpeedRangeKmh.min || input.vehicle.speedKmh > policy.validatedSpeedRangeKmh.max) {
    add(reasons, 'outside-validated-speed-envelope');
    add(triggeringConditions, 'outside-validated-speed-envelope');
    state = worsen(state, 'outside-research-envelope');
  }

  if (policy.maxGnssAccuracyM === null) {
    if (input.feature === 'navigation-context') add(reasons, 'gnss-accuracy-envelope-unverified');
  } else if (input.vehicle.accuracyM > policy.maxGnssAccuracyM) {
    add(reasons, 'gnss-accuracy-outside-envelope');
    add(triggeringConditions, 'gnss-accuracy-outside-envelope');
  }

  const radarUsable = input.sensors.radarFront !== 'unavailable'
    && radarFresh
    && input.assurance.radarFrontCalibration !== 'invalid'
    && input.assurance.timeSync !== 'invalid';
  const cameraUsable = input.sensors.camera !== 'unavailable'
    && cameraFresh
    && input.assurance.cameraCalibration !== 'invalid'
    && input.assurance.timeSync !== 'invalid'
    && !reasons.includes('camera-obstructed-observed');
  const gnssUsable = input.sensors.gnssImu !== 'unavailable'
    && gnssFresh
    && !reasons.includes('gnss-accuracy-outside-envelope');

  const allowedClaims: SotifAllowedClaims = {
    radarRange: radarUsable,
    relativeSpeed: radarUsable,
    objectClassification: cameraUsable,
    laneGeometry: cameraUsable && input.assurance.cameraCalibration === 'verified',
    precisePosition: gnssUsable,
    criticalCollisionWarning: radarUsable
      && input.sensors.can === 'ok'
      && input.assurance.radarFrontCalibration === 'verified'
      && input.assurance.timeSync === 'verified',
  };

  if (input.feature === 'front-collision-warning') {
    if (!radarUsable) state = worsen(state, 'unavailable');
    if (input.sensors.can !== 'ok') state = worsen(state, 'degraded');
    if (input.assurance.radarFrontCalibration !== 'verified' || input.assurance.timeSync !== 'verified') state = worsen(state, 'degraded');
  } else if (input.feature === 'lane-departure-warning') {
    if (!cameraUsable || input.assurance.cameraCalibration === 'invalid') state = worsen(state, 'unavailable');
    else if (!allowedClaims.laneGeometry) state = worsen(state, 'degraded');
  } else if (input.feature === 'navigation-context') {
    if (!gnssUsable) state = worsen(state, 'unavailable');
    else if (policy.maxGnssAccuracyM === null) state = worsen(state, 'degraded');
  } else {
    // Object awareness is multimodal: losing both modalities makes the feature unavailable,
    // while losing either radar geometry or camera classification must be surfaced as degraded.
    // This prevents invalid calibration, stale data or a missing sensor from looking nominal.
    if (!radarUsable && !cameraUsable) state = worsen(state, 'unavailable');
    else if (!radarUsable || !cameraUsable) state = worsen(state, 'degraded');
  }

  const degradationReasons = new Set<SotifReasonCode>([
    'radar-degraded',
    'camera-degraded',
    'gnss-degraded',
    'can-degraded',
    'can-unavailable',
    'radar-calibration-unknown',
    'camera-calibration-unknown',
    'time-sync-unknown',
    'camera-obstructed-observed',
    'low-visibility-observed',
    'heavy-precipitation-observed',
    'glare-observed',
    'illumination-transition-observed',
    'cross-sensor-disagreement',
    'speed-envelope-unverified',
    'gnss-accuracy-envelope-unverified',
  ]);
  if (reasons.some((reason) => degradationReasons.has(reason))) state = worsen(state, 'degraded');

  if (reasons.includes('radar-stale') || reasons.includes('radar-future-dated') || reasons.includes('radar-calibration-invalid') || reasons.includes('time-sync-invalid')) {
    if (input.feature === 'front-collision-warning') state = worsen(state, 'unavailable');
  }
  if (reasons.includes('camera-stale') || reasons.includes('camera-future-dated') || reasons.includes('camera-calibration-invalid')) {
    if (input.feature === 'lane-departure-warning') state = worsen(state, 'unavailable');
  }
  if (reasons.includes('gnss-stale') || reasons.includes('gnss-future-dated')) {
    if (input.feature === 'navigation-context') state = worsen(state, 'unavailable');
  }

  if (!allowedClaims.radarRange) confidenceCeiling = Math.min(confidenceCeiling, 0.45);
  if (!allowedClaims.objectClassification) confidenceCeiling = Math.min(confidenceCeiling, 0.6);
  if (reasons.includes('cross-sensor-disagreement')) confidenceCeiling = Math.min(confidenceCeiling, 0.55);
  if (reasons.includes('low-visibility-observed') || reasons.includes('heavy-precipitation-observed') || reasons.includes('glare-observed')) {
    confidenceCeiling = Math.min(confidenceCeiling, 0.65);
  }
  if (state === 'unavailable') confidenceCeiling = 0;
  else if (state === 'outside-research-envelope') confidenceCeiling = Math.min(confidenceCeiling, 0.4);

  return {
    feature: input.feature,
    state,
    confidenceCeiling: clamp01(confidenceCeiling),
    reasons,
    triggeringConditions,
    allowedClaims,
    controlAuthority: 'none',
    qualificationClaim: 'research-runtime-monitor-only',
  };
}