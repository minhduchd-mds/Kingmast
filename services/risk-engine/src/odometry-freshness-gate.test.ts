import{describe,expect,it}from'vitest';
import{assessOdometry}from'./odometry-freshness-gate.js';
const policy={maxAgeMs:300,maxSpeedKmh:220,maxDistanceDeltaM:20};
const s=(observedAtMs:number,distanceM:number,speedKmh=50)=>({observedAtMs,distanceM,speedKmh,source:'can-readonly' as const});
describe('odometry freshness gate',()=>{
  it('trusts fresh monotonic read-only odometry',()=>expect(assessOdometry([s(900,100),s(1000,108)],1100,policy)).toMatchObject({status:'trusted',speedKmh:50}));
  it('rejects stale or regressing distance',()=>{
    expect(assessOdometry([s(500,100)],1000,policy).reason).toBe('stale-odometry');
    expect(assessOdometry([s(900,100),s(1000,90)],1100,policy).reason).toBe('distance-regression');
  });
  it('degrades jumps and implausible speed without publishing fake speed',()=>{
    expect(assessOdometry([s(900,100),s(1000,140)],1100,policy)).toMatchObject({status:'degraded',reason:'distance-jump',speedKmh:null});
    expect(assessOdometry([s(1000,100,300)],1100,policy)).toMatchObject({status:'degraded',reason:'implausible-speed',speedKmh:null});
  });
  it('marks GNSS-derived speed as degraded evidence',()=>expect(assessOdometry([{...s(1000,100),source:'gnss-derived'}],1100,policy).reason).toBe('derived-speed-only'));
});
