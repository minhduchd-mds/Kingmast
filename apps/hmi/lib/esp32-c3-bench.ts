import type { LocationAlert, SensorHealth, Severity, TelemetryFrame } from '@kingmast/contracts';
import { projectPoint } from './telemetry';

export interface Esp32C3BenchPayload {
  deviceId: string;
  chip: string;
  mode: 'SAFE' | 'WATCH' | 'WARNING' | 'DANGER' | 'SENSOR_LOST' | 'UPLINK_LOST' | string;
  speedKph: number;
  distanceM: number;
  relativeSpeedMps: number;
  bearingDeg: number;
  confidence: number;
  ttc: number;
  risk: 'SAFE' | 'WATCH' | 'WARNING' | 'DANGER' | 'SENSOR_LOST' | string;
  sensorOnline: boolean;
  uplinkOnline: boolean;
  clients: number;
  uptime: number;
}

const BENCH_POSITION = { lat: 21.0285, lng: 105.8542 };

function severityForRisk(risk: Esp32C3BenchPayload['risk']): Severity {
  if (risk === 'DANGER') return 'critical';
  if (risk === 'WARNING' || risk === 'WATCH' || risk === 'SENSOR_LOST') return 'caution';
  return 'safe';
}

function sensorHealth(payload: Esp32C3BenchPayload): SensorHealth {
  return {
    radarFront: payload.sensorOnline ? 'ok' : 'unavailable',
    radarRear: 'unavailable',
    camera: 'unavailable',
    can: 'unavailable',
    gnssImu: 'unavailable',
    ecu: payload.uplinkOnline ? 'ok' : 'degraded',
  };
}

export function esp32C3BenchToTelemetryFrame(payload: Esp32C3BenchPayload, sequence: number): TelemetryFrame {
  const now = Date.now();
  const headingDeg = 0;
  const severity = severityForRisk(payload.risk);
  const vehicle = {
    ...BENCH_POSITION,
    speedKmh: Number.isFinite(payload.speedKph) ? payload.speedKph : 0,
    headingDeg,
    accuracyM: 999,
    timestampMs: now,
    source: 'simulator' as const,
  };

  const hasTarget = payload.sensorOnline && Number.isFinite(payload.distanceM) && payload.distanceM >= 0;
  const target = hasTarget
    ? {
        id: 'c3-bench-front-target',
        kind: 'car' as const,
        confidence: Math.max(0, Math.min(1, payload.confidence)),
        distanceM: payload.distanceM,
        bearingDeg: (headingDeg + payload.bearingDeg + 360) % 360,
        zone: 'front' as const,
        severity,
        relativeSpeedMps: payload.relativeSpeedMps,
        position: projectPoint(vehicle, headingDeg + payload.bearingDeg, payload.distanceM),
        timestampMs: now,
        source: 'radar-only' as const,
      }
    : null;

  const alerts: LocationAlert[] = [];
  if (target && severity !== 'safe') {
    alerts.push({
      id: `c3-bench-target-${sequence}`,
      type: 'vehicle-too-close',
      severity,
      title: severity === 'critical' ? 'Collision risk' : 'Vehicle ahead',
      message: `ESP32-C3 bench target ${target.distanceM.toFixed(1)} m ahead; TTC ${payload.ttc > 0 ? payload.ttc.toFixed(2) : '--'} s.`,
      distanceM: target.distanceM,
      objectId: target.id,
      position: target.position,
      timestampMs: now,
      acknowledged: false,
    });
  }

  if (!payload.sensorOnline) {
    alerts.push({
      id: `c3-bench-sensor-${sequence}`,
      type: 'sensor-degraded',
      severity: 'caution',
      title: 'Front sensor unavailable',
      message: 'ESP32-C3 bench simulator reports the front sensor as unavailable.',
      distanceM: null,
      objectId: null,
      position: vehicle,
      timestampMs: now,
      acknowledged: false,
    });
  }

  return {
    sequence,
    vehicle,
    sensors: sensorHealth(payload),
    objects: target ? [target] : [],
    alerts,
  };
}
