import type {
  CameraDetectionFrame,
  EdgeSensorAges,
  RadarTrackFrame,
  SensorHealth,
  VehiclePosition,
} from '@kingmast/contracts';
import {
  assessSotifRuntime,
  type AssuranceState,
  type SotifEnvironmentObservation,
  type SotifFeature,
  type SotifFusionQuality,
  type SotifMonitorPolicy,
  type SotifRuntimeAssessment,
  type SotifRuntimeState,
} from './sotif-monitor.js';

export interface SotifAssuranceSnapshotInput {
  nowMs: number;
  vehicle: VehiclePosition;
  sensors: SensorHealth;
  sensorAgesMs?: Partial<EdgeSensorAges>;
  radar?: RadarTrackFrame;
  camera?: CameraDetectionFrame;
  assurance: {
    radarFrontCalibration: AssuranceState;
    cameraCalibration: AssuranceState;
    timeSync: AssuranceState;
  };
  environment?: SotifEnvironmentObservation;
  fusion?: SotifFusionQuality;
  policy?: Partial<SotifMonitorPolicy>;
  features?: SotifFeature[];
}

export interface SotifAssuranceSnapshot {
  generatedAtMs: number;
  overallState: SotifRuntimeState;
  confidenceCeiling: number;
  assessments: SotifRuntimeAssessment[];
  validationEnvelope: {
    speedEnvelopeValidated: boolean;
    gnssAccuracyEnvelopeValidated: boolean;
    targetHardwareQualified: false;
    hilQualified: false;
    controlledTrackQualified: false;
    publicRoadApproved: false;
  };
  criticalCollisionWarningAllowed: boolean;
  physicalEvidenceState: 'pending';
  controlAuthority: 'none';
  qualificationClaim: 'research-runtime-diagnostics-only-not-sotif-conformity';
}

const DEFAULT_FEATURES: SotifFeature[] = [
  'front-collision-warning',
  'object-awareness',
  'lane-departure-warning',
  'navigation-context',
];

function rank(state: SotifRuntimeState) {
  if (state === 'unavailable') return 3;
  if (state === 'outside-research-envelope') return 2;
  if (state === 'degraded') return 1;
  return 0;
}

function overallState(assessments: SotifRuntimeAssessment[]): SotifRuntimeState {
  let result: SotifRuntimeState = 'nominal';
  for (const assessment of assessments) {
    if (rank(assessment.state) > rank(result)) result = assessment.state;
  }
  return result;
}

function uniqueFeatures(features: SotifFeature[] | undefined) {
  const selected = features?.length ? features : DEFAULT_FEATURES;
  return [...new Set(selected)];
}

export function buildSotifAssuranceSnapshot(input: SotifAssuranceSnapshotInput): SotifAssuranceSnapshot {
  const assessments = uniqueFeatures(input.features).map((feature) => assessSotifRuntime({
    feature,
    nowMs: input.nowMs,
    vehicle: input.vehicle,
    sensors: input.sensors,
    sensorAgesMs: input.sensorAgesMs,
    radar: input.radar,
    camera: input.camera,
    assurance: input.assurance,
    environment: input.environment,
    fusion: input.fusion,
    policy: input.policy,
  }));

  const confidenceCeiling = assessments.length
    ? Math.min(...assessments.map((assessment) => assessment.confidenceCeiling))
    : 0;
  const fcw = assessments.find((assessment) => assessment.feature === 'front-collision-warning');
  const validatedSpeedRange = input.policy?.validatedSpeedRangeKmh ?? null;
  const maxGnssAccuracyM = input.policy?.maxGnssAccuracyM ?? null;

  return {
    generatedAtMs: input.nowMs,
    overallState: overallState(assessments),
    confidenceCeiling,
    assessments,
    validationEnvelope: {
      speedEnvelopeValidated: validatedSpeedRange !== null,
      gnssAccuracyEnvelopeValidated: maxGnssAccuracyM !== null,
      targetHardwareQualified: false,
      hilQualified: false,
      controlledTrackQualified: false,
      publicRoadApproved: false,
    },
    criticalCollisionWarningAllowed: fcw?.allowedClaims.criticalCollisionWarning ?? false,
    physicalEvidenceState: 'pending',
    controlAuthority: 'none',
    qualificationClaim: 'research-runtime-diagnostics-only-not-sotif-conformity',
  };
}
