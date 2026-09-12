import{describe,expect,it}from'vitest';
import{deriveSensorHealth}from'./sensor-health-state.js';
const policy={maxAgeMs:500,healthySamplesRequired:3};
const good=(observedAtMs:number)=>({observedAtMs,online:true,selfTestOk:true,calibrationValid:true});
describe('sensor health state',()=>{
  it('requires a stable healthy streak before promotion',()=>{
    expect(deriveSensorHealth([good(800),good(900)],1000,policy)).toMatchObject({status:'degraded',reason:'healthy-streak-pending'});
    expect(deriveSensorHealth([good(800),good(900),good(1000)],1100,policy)).toMatchObject({status:'healthy',reason:'stable-healthy-evidence'});
  });
  it('fails closed immediately on offline evidence',()=>expect(deriveSensorHealth([good(800),{...good(900),online:false}],1000,policy)).toMatchObject({status:'unavailable',reason:'sensor-offline'}));
  it('degrades invalid calibration and self-test',()=>{
    expect(deriveSensorHealth([{...good(900),calibrationValid:false}],1000,policy).reason).toBe('calibration-invalid');
    expect(deriveSensorHealth([{...good(900),selfTestOk:false}],1000,policy).reason).toBe('self-test-failed');
  });
  it('rejects stale or non-monotonic health evidence',()=>{
    expect(deriveSensorHealth([good(100)],1000,policy).reason).toBe('stale-health-evidence');
    expect(deriveSensorHealth([good(900),good(900)],1000,policy).reason).toBe('invalid-health-timeline');
  });
});
