import type { LocationAlert, SensorHealth, Severity, TelemetryFrame } from '@kingmast/contracts';
import { projectPoint } from './telemetry';

export interface Esp32C3BenchPayload {
  deviceId: string;
  chip: string;
  mode: 'SAFE' | 'WATCH' | 'WARNING' | 'DANGER' | 'SENSOR_LOST' | 'UPLINK_LOST';
  speedKph: number;
  distanceM: number;
  relativeSpeedMps: number;
  bearingDeg: number;
  confidence: number;
  ttc: number;
  risk: 'SAFE' | 'WATCH' | 'WARNING' | 'DANGER' | 'SENSOR_LOST' | 'UPLINK_LOST';
  sensorOnline: boolean;
  uplinkOnline: boolean;
  clients: number;
  uptime: number;
}

const BENCH_POSITION = { lat: 21.0285, lng: 105.8542 };
const BENCH_STATES = new Set(['SAFE', 'WATCH', 'WARNING', 'DANGER', 'SENSOR_LOST', 'UPLINK_LOST']);

function boundedNumber(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function validateBenchPayload(value: unknown): Esp32C3BenchPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-c3-bench-payload');
  const raw = value as Record<string, unknown>;
  const deviceId = typeof raw.deviceId === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(raw.deviceId) ? raw.deviceId : null;
  const chip = typeof raw.chip === 'string' && raw.chip.length >= 1 && raw.chip.length <= 64 && !/[\u0000-\u001f\u007f]/.test(raw.chip) ? raw.chip : null;
  const mode = typeof raw.mode === 'string' && BENCH_STATES.has(raw.mode) ? raw.mode as Esp32C3BenchPayload['mode'] : null;
  const risk = typeof raw.risk === 'string' && BENCH_STATES.has(raw.risk) ? raw.risk as Esp32C3BenchPayload['risk'] : null;
  const speedKph = boundedNumber(raw.speedKph, 0, 300);
  const distanceM = boundedNumber(raw.distanceM, 0, 1000);
  const relativeSpeedMps = boundedNumber(raw.relativeSpeedMps, -100, 100);
  const bearingDeg = boundedNumber(raw.bearingDeg, -360, 360);
  const confidence = boundedNumber(raw.confidence, 0, 1);
  const ttc = boundedNumber(raw.ttc, -1, 120);
  const clients = boundedNumber(raw.clients, 0, 32);
  const uptime = boundedNumber(raw.uptime, 0, Number.MAX_SAFE_INTEGER);
  if (!deviceId || !chip || !mode || !risk || speedKph === null || distanceM === null || relativeSpeedMps === null || bearingDeg === null || confidence === null || ttc === null || clients === null || uptime === null || typeof raw.sensorOnline !== 'boolean' || typeof raw.uplinkOnline !== 'boolean') {
    throw new Error('invalid-c3-bench-payload');
  }
  return { deviceId, chip, mode, speedKph, distanceM, relativeSpeedMps, bearingDeg, confidence, ttc, risk, sensorOnline: raw.sensorOnline, uplinkOnline: raw.uplinkOnline, clients, uptime };
}

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

export function esp32C3BenchToTelemetryFrame(input: unknown, sequence: number): TelemetryFrame {
  if (process.env.NODE_ENV === 'production') throw new Error('esp32-c3-bench-disabled-in-production');
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('invalid-c3-bench-sequence');
  const payload = validateBenchPayload(input);
  const now = Date.now();
  const headingDeg = 0;
  const severity = severityForRisk(payload.risk);
  const vehicle = {
    ...BENCH_POSITION,
    speedKmh: payload.speedKph,
    headingDeg,
    accuracyM: 999,
    timestampMs: now,
    source: 'simulator' as const,
  };

  const hasTarget = payload.sensorOnline;
  const target = hasTarget
    ? {
        id: 'c3-bench-front-target',
        kind: 'car' as const,
        confidence: payload.confidence,
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
