import { describe, expect, it } from 'vitest';
import type { DetectedObject, SensorHealth, VehiclePosition } from '@kingmast/contracts';
import { buildLocationAlerts } from './object-alerts.js';
import { projectPoint } from './geo.js';

const vehicle: VehiclePosition = {
  lat: 21.0285,
  lng: 105.8542,
  speedKmh: 42,
  headingDeg: 90,
  accuracyM: 3,
  timestampMs: 1_800_000_000_000,
  source: 'simulator',
};

const sensors: SensorHealth = {
  radarFront: 'ok',
  radarRear: 'ok',
  camera: 'ok',
  can: 'ok',
  gnssImu: 'ok',
  ecu: 'ok',
};

function object(overrides: Partial<DetectedObject>): DetectedObject {
  return {
    id: 'object-1',
    kind: 'person',
    confidence: 0.94,
    distanceM: 8,
    bearingDeg: 0,
    zone: 'front',
    severity: 'critical',
    relativeSpeedMps: -1,
    position: projectPoint(vehicle, 0, 8),
    timestampMs: vehicle.timestampMs,
    ...overrides,
  };
}

describe('buildLocationAlerts', () => {
  it('creates a critical pedestrian alert inside 10 meters', () => {
    const alerts = buildLocationAlerts({ vehicle, sensors, objects: [object({})] });
    expect(alerts[0]?.type).toBe('pedestrian-ahead');
    expect(alerts[0]?.severity).toBe('critical');
  });

  it('creates a caution alert for a close lead car', () => {
    const alerts = buildLocationAlerts({
      vehicle,
      sensors,
      objects: [object({ kind: 'car', distanceM: 12, severity: 'caution' })],
    });
    expect(alerts[0]?.type).toBe('vehicle-too-close');
    expect(alerts[0]?.severity).toBe('caution');
  });

  it('reports degraded sensors without creating vehicle-control behavior', () => {
    const alerts = buildLocationAlerts({
      vehicle,
      objects: [],
      sensors: { ...sensors, camera: 'degraded' },
    });
    expect(alerts[0]?.type).toBe('sensor-degraded');
  });
});
