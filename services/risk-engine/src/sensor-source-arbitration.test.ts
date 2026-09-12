import{describe,expect,it}from'vitest';
import{arbitrateMeasurementSource}from'./sensor-source-arbitration.js';
const policy={maxAgeMs:300,minConfidence:.8,preferredOrder:['radar','can-readonly','camera','gnss'] as const};
const m=(source:'radar'|'camera'|'can-readonly'|'gnss',trust:'trusted'|'degraded'|'unavailable',confidence:number,observedAtMs=1000,value:number|null=10)=>({source,trust,confidence,observedAtMs,value});
describe('sensor source arbitration',()=>{
  it('prefers trusted evidence over higher-confidence degraded evidence',()=>expect(arbitrateMeasurementSource([m('camera','degraded',.99),m('radar','trusted',.9)],1100,{...policy,preferredOrder:[...policy.preferredOrder]})).toMatchObject({source:'radar',status:'selected'}));
  it('uses preference order for otherwise equal sources',()=>expect(arbitrateMeasurementSource([m('camera','trusted',.9),m('radar','trusted',.9)],1100,{...policy,preferredOrder:[...policy.preferredOrder]}).source).toBe('radar'));
  it('rejects stale and unavailable evidence',()=>expect(arbitrateMeasurementSource([m('radar','trusted',.9,500),m('camera','unavailable',.9)],1100,{...policy,preferredOrder:[...policy.preferredOrder]})).toMatchObject({status:'unavailable',reason:'no-fresh-source'}));
  it('keeps low-confidence selected evidence degraded',()=>expect(arbitrateMeasurementSource([m('radar','trusted',.5)],1100,{...policy,preferredOrder:[...policy.preferredOrder]})).toMatchObject({status:'degraded',reason:'confidence-below-policy'}));
});
