import {describe,expect,it} from 'vitest';
import {assessTimeSyncAssurance} from './time-sync-assurance.js';

const base={nowMs:10_000,observedAtMs:9_990,offsetMs:3,jitterMs:1,monotonic:true,reviewedBounds:{maxOffsetMs:10,maxJitterMs:5,reviewRef:'review:timesync-01'}};

describe('assessTimeSyncAssurance',()=>{
  it('verifies cross-sensor fusion only inside explicitly reviewed bounds',()=>{
    const result=assessTimeSyncAssurance(base);
    expect(result.state).toBe('verified');
    expect(result.crossSensorFusionAllowed).toBe(true);
    expect(result.controlAuthority).toBe('none');
  });

  it('does not invent time-sync limits when no reviewed bounds exist',()=>{
    const result=assessTimeSyncAssurance({...base,reviewedBounds:null});
    expect(result.state).toBe('unknown');
    expect(result.crossSensorFusionAllowed).toBe(false);
    expect(result.reasons).toContain('reviewed-bounds-missing');
  });

  it('invalidates clock regression and future-dated evidence',()=>{
    expect(assessTimeSyncAssurance({...base,monotonic:false}).state).toBe('invalid');
    expect(assessTimeSyncAssurance({...base,observedAtMs:10_100}).reasons).toContain('future-dated-observation');
  });

  it('rejects offset or jitter outside independently reviewed bounds',()=>{
    expect(assessTimeSyncAssurance({...base,offsetMs:11}).reasons).toContain('offset-outside-reviewed-bound');
    expect(assessTimeSyncAssurance({...base,jitterMs:6}).reasons).toContain('jitter-outside-reviewed-bound');
  });
});
