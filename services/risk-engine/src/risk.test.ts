import { describe, expect, it } from 'vitest';
import { assessRisk } from './risk.js';

const base = {
  timestampMs: 1_000,
  egoSpeedMps: 20,
  targetSpeedMps: 10,
  rangeM: 12,
  confidence: 0.95,
  canHealthy: true,
  radarHealthy: true,
  cameraHealthy: true,
};

describe('assessRisk', () => {
  it('[S8-002] raises critical only for a high-confidence closing gap with trustworthy vehicle speed', () => {
    const result = assessRisk(base, 1_050);
    expect(result.severity).toBe('critical');
    expect(result.reasons).toContain('closing-gap');
  });

  it('[S8-004] keeps short headway without closing dynamics at caution rather than critical', () => {
    const result = assessRisk({ ...base, targetSpeedMps: 20, rangeM: 15 }, 1_050);
    expect(result.ttcS).toBeNull();
    expect(result.thwS).toBeCloseTo(0.75);
    expect(result.severity).toBe('caution');
    expect(result.reasons).toContain('short-headway');
  });

  it('blocks critical escalation when CAN speed evidence is degraded', () => {
    const result = assessRisk({ ...base, canHealthy: false }, 1_050);
    expect(result.severity).toBe('caution');
    expect(result.reasons).toEqual(expect.arrayContaining(['can-degraded', 'critical-blocked-can-degraded']));
  });

  it('does not create a caution solely because CAN is degraded when geometry is benign', () => {
    const result = assessRisk({
      ...base,
      canHealthy: false,
      targetSpeedMps: 19,
      rangeM: 80,
    }, 1_050);
    expect(result.severity).toBe('safe');
    expect(result.reasons).toContain('can-degraded');
  });

  it('preserves radar geometric warning capability when camera classification is unavailable', () => {
    const result = assessRisk({ ...base, cameraHealthy: false }, 1_050);
    expect(result.severity).toBe('critical');
    expect(result.reasons).toEqual(expect.arrayContaining(['camera-degraded', 'closing-gap']));
  });

  it('does not warn from low-confidence closing geometry', () => {
    const result = assessRisk({ ...base, confidence: 0.4 }, 1_050);
    expect(result.severity).toBe('safe');
  });

  it('[S8-027] rejects stale frames', () => {
    expect(assessRisk(base, 2_000).reasons).toContain('stale-data-rejected');
  });

  it('[S8-028] rejects future-dated frames beyond the allowed clock skew', () => {
    const result = assessRisk({ ...base, timestampMs: 1_200 }, 1_000);
    expect(result.severity).toBe('safe');
    expect(result.reasons).toContain('future-data-rejected');
    expect(result.confidence).toBe(0);
  });

  it('fails safe when radar is unavailable', () => {
    const result = assessRisk({ ...base, radarHealthy: false }, 1_050);
    expect(result.severity).toBe('safe');
    expect(result.ttcS).toBeNull();
    expect(result.reasons).toContain('radar-unavailable');
  });

  it('rejects non-finite or physically invalid direct inputs', () => {
    const invalid = assessRisk({ ...base, rangeM: Number.NaN }, 1_050);
    expect(invalid.severity).toBe('safe');
    expect(invalid.confidence).toBe(0);
    expect(invalid.reasons).toContain('invalid-input-rejected');
  });
});
