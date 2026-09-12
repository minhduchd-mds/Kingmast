import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
import { runSilRiskReplaySuite,type SilRiskReplayCase } from './sil-replay.js';

const currentReplayPath=fileURLToPath(new URL('../../../docs/validation/replays/V008_RISK_REPLAY.json',import.meta.url));
const historicalReplayPath=fileURLToPath(new URL('../../../docs/validation/replays/V006_RISK_REPLAY.json',import.meta.url));
const replayCases=JSON.parse(readFileSync(currentReplayPath,'utf8')) as SilRiskReplayCase[];
const historicalCases=JSON.parse(readFileSync(historicalReplayPath,'utf8')) as SilRiskReplayCase[];

describe('KINGMAST deterministic SIL risk replay',()=>{
  it('keeps every current v0.0.8 replay expectation deterministic',()=>{
    const report=runSilRiskReplaySuite(replayCases);
    expect(report.total).toBeGreaterThanOrEqual(10);
    expect(report.failed).toBe(0);
    expect(report.allPassed).toBe(true);
    expect(report.controlAuthority).toBe('none');
  });

  it('contains explicit future-timestamp, degraded-CAN and degraded-camera boundary cases',()=>{
    expect(replayCases.find((item)=>item.scenarioId==='SIL8-RISK-007')?.expected.reasonsInclude).toContain('future-data-rejected');
    expect(replayCases.find((item)=>item.scenarioId==='SIL8-RISK-008')?.expected.reasonsInclude).toContain('critical-blocked-can-degraded');
    expect(replayCases.find((item)=>item.scenarioId==='SIL8-RISK-009')?.expected.reasonsInclude).toContain('camera-degraded');
  });

  it('preserves the historical V006 replay corpus without silently rewriting old expectations',()=>{
    const legacyCanCase=historicalCases.find((item)=>item.scenarioId==='SIL-RISK-006');
    expect(historicalCases.length).toBeGreaterThanOrEqual(7);
    expect(legacyCanCase?.expected.severity).toBe('caution');
    expect(legacyCanCase?.expected.confidenceMax).toBe(0.49);
  });
});
