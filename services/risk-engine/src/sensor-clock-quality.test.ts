import{describe,expect,it}from'vitest';
import{assessSensorClockQuality}from'./sensor-clock-quality.js';
const p={maxAgeMs:1000,maxOffsetMs:20,maxJitterMs:5,trustedSources:['ptp','gnss'] as const};
const s=(offsetMs=5,jitterMs=1,syncSource:'ptp'|'gnss'|'host'|'unknown'='ptp',monotonic=true)=>({sensorId:'radar-front',observedAtMs:1000,offsetMs,jitterMs,monotonic,syncSource});
describe('sensor clock quality',()=>{
 it('allows fusion only inside reviewed clock bounds',()=>expect(assessSensorClockQuality(s(),1100,p)).toMatchObject({status:'trusted',crossSensorFusionAllowed:true}));
 it('blocks non-monotonic clocks',()=>expect(assessSensorClockQuality(s(5,1,'ptp',false),1100,p).status).toBe('unavailable'));
 it('degrades excessive offset or jitter',()=>expect(assessSensorClockQuality(s(25,1),1100,p).reason).toBe('clock-quality-outside-reviewed-bounds'));
 it('does not trust unknown sync source',()=>expect(assessSensorClockQuality(s(5,1,'unknown'),1100,p).status).toBe('degraded'));
});
