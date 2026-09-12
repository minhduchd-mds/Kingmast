import type { RiskAssessment, VehicleSample } from '@kingmast/contracts';
import { riskRuntimeMetrics } from './risk-observability.js';

const MIN_SPEED_MPS = 0.5;
const MAX_AGE_MS = 250;
const MAX_FUTURE_SKEW_MS = 50;
const CRITICAL_TTC_S = 1.6;
const CAUTION_TTC_S = 3.2;
const CAUTION_THW_S = 1.8;
const CRITICAL_CONFIDENCE = 0.75;
const CAUTION_CONFIDENCE = 0.55;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function finiteSample(sample: VehicleSample) {
  return Number.isFinite(sample.timestampMs)
    && Number.isFinite(sample.egoSpeedMps)
    && Number.isFinite(sample.targetSpeedMps)
    && Number.isFinite(sample.rangeM)
    && Number.isFinite(sample.confidence)
    && sample.egoSpeedMps >= 0
    && sample.rangeM >= 0;
}

export function assessRisk(sample: VehicleSample, nowMs = Date.now()): RiskAssessment {
  const startedAt = process.hrtime.bigint();
  const finish = (result: RiskAssessment) => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    riskRuntimeMetrics.observe(result, latencyMs);
    return result;
  };

  if (!Number.isFinite(nowMs) || !finiteSample(sample)) {
    return finish({ severity: 'safe', ttcS: null, thwS: null, closingSpeedMps: 0, confidence: 0, reasons: ['invalid-input-rejected'] });
  }

  const confidence = clamp01(sample.confidence);
  const reasons: string[] = [];

  if (sample.timestampMs > nowMs + MAX_FUTURE_SKEW_MS) {
    return finish({ severity: 'safe', ttcS: null, thwS: null, closingSpeedMps: 0, confidence: 0, reasons: ['future-data-rejected'] });
  }
  if (nowMs - sample.timestampMs > MAX_AGE_MS) {
    return finish({ severity: 'safe', ttcS: null, thwS: null, closingSpeedMps: 0, confidence: 0, reasons: ['stale-data-rejected'] });
  }
  if (!sample.radarHealthy) {
    return finish({ severity: 'safe', ttcS: null, thwS: null, closingSpeedMps: 0, confidence: 0, reasons: ['radar-unavailable'] });
  }

  const closingSpeedMps = Math.max(0, sample.egoSpeedMps - sample.targetSpeedMps);
  const thwS = sample.egoSpeedMps > MIN_SPEED_MPS ? sample.rangeM / sample.egoSpeedMps : null;
  const ttcS = closingSpeedMps > 0.1 ? sample.rangeM / closingSpeedMps : null;

  if (!sample.canHealthy) reasons.push('can-degraded');
  if (!sample.cameraHealthy) reasons.push('camera-degraded');

  const criticalClosingGap = confidence >= CRITICAL_CONFIDENCE && ttcS !== null && ttcS < CRITICAL_TTC_S;
  const cautionClosingGap = confidence >= CAUTION_CONFIDENCE && ttcS !== null && ttcS < CAUTION_TTC_S;
  const cautionHeadway = confidence >= CAUTION_CONFIDENCE && thwS !== null && thwS < CAUTION_THW_S;

  let severity: RiskAssessment['severity'] = 'safe';

  // FCW criticality depends on trustworthy ego dynamics. When CAN/vehicle speed is not healthy,
  // the geometric range may still justify a caution but must never create a critical claim from
  // uncertain speed-derived TTC/THW. Camera health affects semantic confidence, not radar range.
  if (criticalClosingGap && sample.canHealthy) {
    severity = 'critical';
    reasons.push('closing-gap');
  } else if (criticalClosingGap || cautionClosingGap || cautionHeadway) {
    severity = 'caution';
    if (ttcS !== null && (criticalClosingGap || cautionClosingGap)) reasons.push('closing-gap');
    if (cautionHeadway) reasons.push('short-headway');
    if (criticalClosingGap && !sample.canHealthy) reasons.push('critical-blocked-can-degraded');
  }

  return finish({ severity, ttcS, thwS, closingSpeedMps, confidence, reasons });
}
