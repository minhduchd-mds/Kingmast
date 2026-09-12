import{describe,expect,it}from'vitest';
import{assessRadarTrackContinuity}from'./radar-track-continuity.js';

const policy={maxAgeMs:250,maxGapMs:150,minConfidence:.8};
const sample=(observedAtMs:number,confidence=.95)=>({trackId:'front-1',observedAtMs,rangeM:20,rangeRateMps:-2,confidence});

describe('radar track continuity',()=>{
  it('accepts a fresh monotonic continuous track',()=>{
    expect(assessRadarTrackContinuity([sample(800),sample(900),sample(1000)],1100,policy)).toMatchObject({status:'reliable',reason:'continuous-track'});
  });
  it('degrades rather than inventing continuity across a gap',()=>{
    expect(assessRadarTrackContinuity([sample(700),sample(1000)],1100,policy)).toMatchObject({status:'degraded',reason:'continuity-gap'});
  });
  it('rejects stale, future and identity-changing evidence',()=>{
    expect(assessRadarTrackContinuity([sample(500),sample(600)],1000,policy).reason).toBe('stale-track');
    expect(assessRadarTrackContinuity([sample(900),sample(1200)],1000,policy).reason).toBe('future-observation');
    const changed={...sample(1000),trackId:'front-2'};
    expect(assessRadarTrackContinuity([sample(900),changed],1050,policy).reason).toBe('track-id-changed');
  });
  it('keeps low-confidence history degraded',()=>{
    expect(assessRadarTrackContinuity([sample(900,.6),sample(1000)],1050,policy)).toMatchObject({status:'degraded',reason:'low-confidence-sample'});
  });
});
