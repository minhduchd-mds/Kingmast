import { describe, expect, it } from 'vitest';
import type { SensorHealth, VehiclePosition } from '@kingmast/contracts';
import { assessSotifRuntime, type SotifMonitorInput } from './sotif-monitor.js';

const now = 1_800_000_000_000;
const vehicle: VehiclePosition = {
  lat: 21.0285,
  lng: 105.8542,
  speedKmh: 45,
  headingDeg: 0,
  accuracyM: 2.5,
  timestampMs: now,
  source: 'gnss',
};
const sensors: SensorHealth = {
  radarFront: 'ok',
  radarRear: 'unavailable',
  camera: 'ok',
  can: 'ok',
  gnssImu: 'ok',
  ecu: 'ok',
};
const radar = {
  radarId: 'front',
  timestampMs: now,
  tracks: [{ id: 'r1', distanceM: 24, bearingDeg: 0, relativeSpeedMps: -4, confidence: 0.96, timestampMs: now }],
};
const camera = {
  cameraId: 'front',
  timestampMs: now,
  detections: [{ id: 'c1', kind: 'car' as const, confidence: 0.93, bearingDeg: 1, estimatedDistanceM: 25, timestampMs: now }],
};
const verified = { radarFrontCalibration: 'verified' as const, cameraCalibration: 'verified' as const, timeSync: 'verified' as const };

function input(overrides: Partial<SotifMonitorInput> = {}): SotifMonitorInput {
  return {
    feature: 'front-collision-warning',
    nowMs: now,
    vehicle,
    sensors,
    radar,
    camera,
    assurance: verified,
    policy: { validatedSpeedRangeKmh: { min: 0, max: 80 }, maxGnssAccuracyM: 10 },
    ...overrides,
  };
}

describe('assessSotifRuntime', () => {
  it('permits a nominal warning claim only inside an explicitly configured research envelope', () => {
    const result = assessSotifRuntime(input());
    expect(result.state).toBe('nominal');
    expect(result.allowedClaims.radarRange).toBe(true);
    expect(result.allowedClaims.criticalCollisionWarning).toBe(true);
    expect(result.controlAuthority).toBe('none');
    expect(result.qualificationClaim).toBe('research-runtime-monitor-only');
  });

  it('does not silently claim a physically validated speed envelope by default', () => {
    const result = assessSotifRuntime(input({ policy: { maxGnssAccuracyM: 10 } }));
    expect(result.state).toBe('degraded');
    expect(result.reasons).toContain('speed-envelope-unverified');
  });

  it('makes FCW unavailable when radar evidence is stale', () => {
    const result = assessSotifRuntime(input({
      radar: { ...radar, timestampMs: now - 700, tracks: radar.tracks.map((track) => ({ ...track, timestampMs: now - 700 })) },
    }));
    expect(result.state).toBe('unavailable');
    expect(result.reasons).toContain('radar-stale');
    expect(result.allowedClaims.radarRange).toBe(false);
    expect(result.allowedClaims.criticalCollisionWarning).toBe(false);
  });

  it('rejects future-dated radar evidence outside clock tolerance', () => {
    const result = assessSotifRuntime(input({
      radar: { ...radar, timestampMs: now + 200, tracks: radar.tracks.map((track) => ({ ...track, timestampMs: now + 200 })) },
    }));
    expect(result.state).toBe('unavailable');
    expect(result.reasons).toContain('radar-future-dated');
    expect(result.confidenceCeiling).toBe(0);
  });

  it('records heavy rain and glare as observed triggering conditions without inventing a sensor failure', () => {
    const result = assessSotifRuntime(input({
      environment: {
        observedAtMs: now,
        source: 'vehicle-sensor',
        visibility: 'reduced',
        illumination: 'glare',
        precipitation: 'heavy-rain',
        cameraObstructed: false,
      },
    }));
    expect(result.state).toBe('degraded');
    expect(result.triggeringConditions).toEqual(expect.arrayContaining([
      'low-visibility-observed',
      'heavy-precipitation-observed',
      'glare-observed',
    ]));
    expect(result.allowedClaims.radarRange).toBe(true);
    expect(result.confidenceCeiling).toBeLessThanOrEqual(0.65);
  });

  it('blocks camera-derived claims when camera obstruction is actually observed while preserving radar range', () => {
    const result = assessSotifRuntime(input({
      feature: 'object-awareness',
      environment: {
        observedAtMs: now,
        source: 'vehicle-sensor',
        visibility: 'normal',
        illumination: 'normal',
        precipitation: 'none',
        cameraObstructed: true,
      },
    }));
    expect(result.state).toBe('degraded');
    expect(result.allowedClaims.objectClassification).toBe(false);
    expect(result.allowedClaims.radarRange).toBe(true);
    expect(result.triggeringConditions).toContain('camera-obstructed-observed');
  });

  it('degrades on cross-sensor disagreement instead of increasing certainty', () => {
    const result = assessSotifRuntime(input({
      fusion: {
        radarTrackCount: 4,
        cameraDetectionCount: 4,
        matchedCount: 0,
        disagreementCount: 2,
        maxTimestampSkewMs: 180,
      },
    }));
    expect(result.state).toBe('degraded');
    expect(result.reasons).toContain('cross-sensor-disagreement');
    expect(result.confidenceCeiling).toBeLessThanOrEqual(0.55);
  });

  it('blocks critical FCW authority when time synchronization is invalid', () => {
    const result = assessSotifRuntime(input({
      assurance: { ...verified, timeSync: 'invalid' },
    }));
    expect(result.state).toBe('unavailable');
    expect(result.reasons).toContain('time-sync-invalid');
    expect(result.allowedClaims.criticalCollisionWarning).toBe(false);
  });

  it('marks operation outside an explicitly validated speed range', () => {
    const result = assessSotifRuntime(input({
      vehicle: { ...vehicle, speedKmh: 95 },
      policy: { validatedSpeedRangeKmh: { min: 0, max: 80 }, maxGnssAccuracyM: 10 },
    }));
    expect(result.state).toBe('outside-research-envelope');
    expect(result.triggeringConditions).toContain('outside-validated-speed-envelope');
  });

  it('degrades navigation when no GNSS accuracy envelope has been validated', () => {
    const result = assessSotifRuntime(input({
      feature: 'navigation-context',
      policy: { validatedSpeedRangeKmh: { min: 0, max: 80 } },
    }));
    expect(result.state).toBe('degraded');
    expect(result.reasons).toContain('gnss-accuracy-envelope-unverified');
  });
});
