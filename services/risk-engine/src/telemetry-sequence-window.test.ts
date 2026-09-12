import{describe,expect,it}from'vitest';
import{assessTelemetrySequence}from'./telemetry-sequence-window.js';
const p={windowSize:4,maxFutureMs:50};
const t=(sequence:number,observedAtMs:number)=>({sequence,observedAtMs});
describe('telemetry sequence window',()=>{
 it('accepts monotonic new sequence',()=>expect(assessTelemetrySequence(t(4,1000),[t(3,900),t(2,800)],1010,p).status).toBe('accepted'));
 it('detects duplicate sequence',()=>expect(assessTelemetrySequence(t(3,1000),[t(3,900)],1010,p).status).toBe('duplicate'));
 it('detects sequence replay',()=>expect(assessTelemetrySequence(t(2,1000),[t(3,900)],1010,p).reason).toBe('sequence-regression'));
 it('rejects excessive future timestamp',()=>expect(assessTelemetrySequence(t(4,1200),[t(3,900)],1000,p).reason).toBe('future-timestamp'));
});
