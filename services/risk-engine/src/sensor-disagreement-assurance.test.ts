import {describe,expect,it} from 'vitest';
import {assessSensorDisagreement} from './sensor-disagreement-assurance.js';

const base={radarTrackCount:2,cameraDetectionCount:2,matches:[{radarId:'r1',cameraId:'c1',rangeResidualM:1,timestampSkewMs:20},{radarId:'r2',cameraId:'c2',rangeResidualM:2,timestampSkewMs:30}],maxRangeResidualM:5,maxTimestampSkewMs:120};

describe('assessSensorDisagreement',()=>{
  it('allows one-to-one fusion only inside reviewed association gates',()=>{
    const result=assessSensorDisagreement(base);
    expect(result.state).toBe('nominal');
    expect(result.fusionAllowed).toBe(true);
    expect(result.confidenceCeiling).toBe(1);
  });

  it('never reuses one camera detection for multiple radar tracks',()=>{
    const result=assessSensorDisagreement({...base,matches:[...base.matches,{radarId:'r3',cameraId:'c1',rangeResidualM:1,timestampSkewMs:20}],radarTrackCount:3,cameraDetectionCount:2});
    expect(result.fusionAllowed).toBe(false);
    expect(result.reasons).toContain('one-camera-to-many-radar-reuse');
    expect(result.confidenceCeiling).toBeLessThanOrEqual(0.55);
  });

  it('degrades rather than increasing certainty on range disagreement',()=>{
    const result=assessSensorDisagreement({...base,matches:[{radarId:'r1',cameraId:'c1',rangeResidualM:9,timestampSkewMs:20}]});
    expect(result.state).toBe('degraded');
    expect(result.reasons).toContain('range-residual-outside-gate');
    expect(result.confidenceCeiling).toBe(0.55);
  });

  it('degrades association when timestamps exceed the synchronization gate',()=>{
    const result=assessSensorDisagreement({...base,matches:[{radarId:'r1',cameraId:'c1',rangeResidualM:1,timestampSkewMs:200}]});
    expect(result.fusionAllowed).toBe(false);
    expect(result.reasons).toContain('timestamp-skew-outside-gate');
  });

  it('fails closed for impossible association counts',()=>{
    const result=assessSensorDisagreement({radarTrackCount:1,cameraDetectionCount:1,matches:base.matches,maxRangeResidualM:5,maxTimestampSkewMs:120});
    expect(result.state).toBe('invalid');
    expect(result.confidenceCeiling).toBe(0);
  });
});
