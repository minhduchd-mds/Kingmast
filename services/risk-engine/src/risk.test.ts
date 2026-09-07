import {describe,expect,it} from 'vitest';
import {assessRisk} from './risk.js';
const base={timestampMs:1_000,egoSpeedMps:20,targetSpeedMps:10,rangeM:12,confidence:.95,canHealthy:true,radarHealthy:true,cameraHealthy:true};
describe('assessRisk',()=>{
  it('raises critical on high-confidence closing gap',()=>expect(assessRisk(base,1_050).severity).toBe('critical'));
  it('rejects stale frames',()=>expect(assessRisk(base,2_000).reasons).toContain('stale-data-rejected'));
  it('rejects future-dated frames beyond the allowed clock skew',()=>{
    const result=assessRisk({...base,timestampMs:1_200},1_000);
    expect(result.severity).toBe('safe');
    expect(result.reasons).toContain('future-data-rejected');
    expect(result.confidence).toBe(0);
  });
  it('fails safe when radar is unavailable',()=>expect(assessRisk({...base,radarHealthy:false},1_050).severity).toBe('safe'));
});
