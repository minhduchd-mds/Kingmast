import {describe,expect,it} from 'vitest';
import {assessPerceptionClaims} from './perception-claim-gate.js';

const base={nowMs:10_000,observedAtMs:9_900,source:'radar-camera' as const,confidence:0.92,maxAgeMs:250,minimumConfidence:0.6,calibration:'verified' as const,timeSync:'verified' as const,geometryAuthoritative:true};

describe('assessPerceptionClaims',()=>{
  it('permits bounded fused claims only from fresh verified evidence',()=>{
    const result=assessPerceptionClaims(base);
    expect(result.state).toBe('nominal');
    expect(result.allowedClaims).toEqual({range:true,relativeSpeed:true,classification:true});
    expect(result.controlAuthority).toBe('none');
  });

  it('keeps camera-only depth from becoming authoritative collision geometry',()=>{
    const result=assessPerceptionClaims({...base,source:'camera',geometryAuthoritative:false});
    expect(result.allowedClaims.range).toBe(false);
    expect(result.allowedClaims.relativeSpeed).toBe(false);
    expect(result.allowedClaims.classification).toBe(true);
  });

  it('degrades unknown assurance instead of treating it as verified',()=>{
    const result=assessPerceptionClaims({...base,calibration:'unknown'});
    expect(result.state).toBe('degraded');
    expect(result.confidenceCeiling).toBeLessThanOrEqual(0.6);
    expect(result.allowedClaims.classification).toBe(false);
  });

  it('fails closed for stale or future-dated evidence',()=>{
    expect(assessPerceptionClaims({...base,observedAtMs:9_000}).state).toBe('unavailable');
    expect(assessPerceptionClaims({...base,observedAtMs:10_100}).state).toBe('unavailable');
  });

  it('fails closed when calibration, synchronization or confidence is invalid',()=>{
    expect(assessPerceptionClaims({...base,calibration:'invalid'}).allowedClaims.range).toBe(false);
    expect(assessPerceptionClaims({...base,timeSync:'invalid'}).allowedClaims.classification).toBe(false);
    expect(assessPerceptionClaims({...base,confidence:0.4}).confidenceCeiling).toBe(0);
  });
});
