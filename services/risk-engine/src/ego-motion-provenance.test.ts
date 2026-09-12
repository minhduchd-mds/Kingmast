import{describe,expect,it}from'vitest';
import{assessEgoMotionProvenance}from'./ego-motion-provenance.js';
const p={maxAgeMs:500,minConfidence:.8,maxCrossSourceDeltaMps:1.5};
const e=(source:'can-readonly'|'wheel-odometry'|'gnss'|'imu',speedMps:number,confidence=.9,observedAtMs=1000,provenanceId='ref')=>({source,speedMps,confidence,observedAtMs,provenanceId});
describe('ego motion provenance',()=>{
 it('trusts cross-checked fresh motion',()=>expect(assessEgoMotionProvenance([e('can-readonly',20),e('imu',20.5)],1100,p)).toMatchObject({status:'trusted',primarySource:'can-readonly'}));
 it('keeps one source degraded',()=>expect(assessEgoMotionProvenance([e('gnss',20)],1100,p).reason).toBe('single-source-motion'));
 it('removes speed when trusted sources disagree',()=>expect(assessEgoMotionProvenance([e('can-readonly',20),e('gnss',25)],1100,p)).toMatchObject({status:'degraded',speedMps:null}));
 it('does not accept evidence without provenance',()=>expect(assessEgoMotionProvenance([e('can-readonly',20,.9,1000,'')],1100,p).status).toBe('unavailable'));
});
