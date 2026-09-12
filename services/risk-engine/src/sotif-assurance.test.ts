import { describe, expect, it } from 'vitest';
import type { CameraDetectionFrame, RadarTrackFrame, SensorHealth, VehiclePosition } from '@kingmast/contracts';
import { buildSotifAssuranceSnapshot, type SotifAssuranceSnapshotInput } from './sotif-assurance.js';

const NOW = 1_800_000_000_000;

const vehicle: VehiclePosition = {
  lat: 21.0285,
  lng: 105.8542,
  speedKmh: 45,
  headingDeg: 90,
  accuracyM: 2.5,
  timestampMs: NOW,
  source: 'gnss',
};

const sensors: SensorHealth = {
  radarFront: 'ok',
  radarRear: 'ok',
  camera: 'ok',
  can: 'ok',
  gnssImu: 'ok',
  ecu: 'ok',
};

const radar: RadarTrackFrame = {
  radarId: 'front-radar',
  timestampMs: NOW,
  tracks: [{
    id: 'r1',
    distanceM: 32,
    bearingDeg: 1,
    relativeSpeedMps: -2,
    confidence: 0.95,
    timestampMs: NOW,
  }],
};

const camera: CameraDetectionFrame = {
  cameraId: 'front-camera',
  timestampMs: NOW,
  detections: [{
    id: 'c1',
    kind: 'car',
    confidence: 0.94,
    bearingDeg: 1.2,
    estimatedDistanceM: 31,
    timestampMs: NOW,
  }],
};

function input(overrides: Partial<SotifAssuranceSnapshotInput> = {}): SotifAssuranceSnapshotInput {
  return {
    nowMs: NOW,
    vehicle,
    sensors,
    radar,
    camera,
    assurance: {
      radarFrontCalibration: 'verified',
      cameraCalibration: 'verified',
      timeSync: 'verified',
    },
    fusion: {
      radarTrackCount: 1,
      cameraDetectionCount: 1,
      matchedCount: 1,
      disagreementCount: 0,
      maxTimestampSkewMs: 0,
    },
    ...overrides,
  };
}

describe('buildSotifAssuranceSnapshot', () => {
  it('does not invent a validated physical envelope by default', () => {
    const snapshot = buildSotifAssuranceSnapshot(input());
    expect(snapshot.validationEnvelope.speedEnvelopeValidated).toBe(false);
    expect(snapshot.validationEnvelope.gnssAccuracyEnvelopeValidated).toBe(false);
    expect(snapshot.validationEnvelope.targetHardwareQualified).toBe(false);
    expect(snapshot.validationEnvelope.hilQualified).toBe(false);
    expect(snapshot.validationEnvelope.controlledTrackQualified).toBe(false);
    expect(snapshot.validationEnvelope.publicRoadApproved).toBe(false);
    expect(snapshot.overallState).toBe('degraded');
    expect(snapshot.controlAuthority).toBe('none');
    expect(snapshot.qualificationClaim).toBe('research-runtime-diagnostics-only-not-sotif-conformity');
  });

  it('can become nominal only when explicit research envelope bounds are supplied', () => {
    const snapshot = buildSotifAssuranceSnapshot(input({
      policy: {
        validatedSpeedRangeKmh: { min: 0, max: 60 },
        maxGnssAccuracyM: 5,
      },
    }));
    expect(snapshot.validationEnvelope.speedEnvelopeValidated).toBe(true);
    expect(snapshot.validationEnvelope.gnssAccuracyEnvelopeValidated).toBe(true);
    expect(snapshot.overallState).toBe('nominal');
    expect(snapshot.criticalCollisionWarningAllowed).toBe(true);
  });

  it('makes front collision warning unavailable when front radar is unavailable', () => {
    const snapshot = buildSotifAssuranceSnapshot(input({
      sensors: { ...sensors, radarFront: 'unavailable' },
      policy: { validatedSpeedRangeKmh: { min: 0, max: 60 }, maxGnssAccuracyM: 5 },
    }));
    const fcw = snapshot.assessments.find((assessment) => assessment.feature === 'front-collision-warning');
    expect(fcw?.state).toBe('unavailable');
    expect(fcw?.allowedClaims.radarRange).toBe(false);
    expect(snapshot.criticalCollisionWarningAllowed).toBe(false);
    expect(snapshot.overallState).toBe('unavailable');
  });

  it('degrades observed heavy rain without fabricating a physical weather qualification', () => {
    const snapshot = buildSotifAssuranceSnapshot(input({
      policy: { validatedSpeedRangeKmh: { min: 0, max: 60 }, maxGnssAccuracyM: 5 },
      environment: {
        observedAtMs: NOW,
        source: 'test-fixture',
        visibility: 'reduced',
        illumination: 'normal',
        precipitation: 'heavy-rain',
        cameraObstructed: false,
      },
    }));
    const objectAwareness = snapshot.assessments.find((assessment) => assessment.feature === 'object-awareness');
    expect(objectAwareness?.state).toBe('degraded');
    expect(objectAwareness?.triggeringConditions).toContain('heavy-precipitation-observed');
    expect(objectAwareness?.confidenceCeiling).toBeLessThanOrEqual(0.65);
    expect(snapshot.validationEnvelope.targetHardwareQualified).toBe(false);
  });
});
