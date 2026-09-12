import{describe,expect,it}from'vitest';
import{assessGnssFix}from'./gnss-integrity-gate.js';

const policy={maxAgeMs:1000,maxAccuracyM:15,maxSpeedKmh:220};
const fix={observedAtMs:1000,latitude:21.0285,longitude:105.8542,accuracyM:4,speedKmh:42,headingDeg:90};

describe('GNSS integrity gate',()=>{
  it('trusts a fresh plausible fix',()=>expect(assessGnssFix(fix,1500,policy)).toMatchObject({status:'trusted',reason:'fresh-accurate-fix'}));
  it('rejects stale and future coordinates',()=>{
    expect(assessGnssFix(fix,2501,policy).reason).toBe('stale-fix');
    expect(assessGnssFix({...fix,observedAtMs:2000},1500,policy).reason).toBe('future-fix');
  });
  it('degrades poor accuracy without fabricating precision',()=>expect(assessGnssFix({...fix,accuracyM:40},1500,policy)).toMatchObject({status:'degraded',reason:'poor-accuracy'}));
  it('suppresses implausible speed while preserving position evidence',()=>expect(assessGnssFix({...fix,speedKmh:500},1500,policy)).toMatchObject({status:'degraded',reason:'implausible-speed',speedKmh:null}));
  it('keeps absent optional motion fields absent',()=>expect(assessGnssFix({...fix,speedKmh:null,headingDeg:null},1500,policy)).toMatchObject({status:'trusted',speedKmh:null,headingDeg:null}));
});
