import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
import { runSilRiskReplaySuite,type SilRiskReplayCase } from './sil-replay.js';

const replayPath=fileURLToPath(new URL('../../../docs/validation/replays/V006_RISK_REPLAY.json',import.meta.url));
const replayCases=JSON.parse(readFileSync(replayPath,'utf8')) as SilRiskReplayCase[];

describe('KINGMAST deterministic SIL risk replay',()=>{
  it('keeps every recorded v0.0.6 replay expectation deterministic',()=>{
    const report=runSilRiskReplaySuite(replayCases);
    expect(report.total).toBeGreaterThanOrEqual(7);
    expect(report.failed).toBe(0);
    expect(report.allPassed).toBe(true);
    expect(report.controlAuthority).toBe('none');
  });

  it('contains an explicit future-timestamp rejection replay',()=>{
    const future=replayCases.find((item)=>item.scenarioId==='SIL-RISK-007');
    expect(future?.expected.reasonsInclude).toContain('future-data-rejected');
  });
});
