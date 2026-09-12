import{describe,expect,it}from'vitest';
import{assessCameraObstructionHealth}from'./camera-obstruction-health.js';
const p={maxAgeMs:500,degradedObstructionRatio:.25,unavailableObstructionRatio:.7,minConfidence:.8};
describe('camera obstruction health',()=>{
 it('allows semantics only for fresh healthy evidence',()=>expect(assessCameraObstructionHealth({observedAtMs:1000,obstructionRatio:.05,confidence:.95,selfTest:'pass'},1100,p)).toMatchObject({status:'nominal',semanticClaimsAllowed:true}));
 it('degrades partial obstruction',()=>expect(assessCameraObstructionHealth({observedAtMs:1000,obstructionRatio:.3,confidence:.95,selfTest:'pass'},1100,p).status).toBe('degraded'));
 it('blocks semantics when obstructed',()=>expect(assessCameraObstructionHealth({observedAtMs:1000,obstructionRatio:.8,confidence:.95,selfTest:'pass'},1100,p)).toMatchObject({status:'unavailable',semanticClaimsAllowed:false}));
 it('rejects stale evidence',()=>expect(assessCameraObstructionHealth({observedAtMs:100,obstructionRatio:0,confidence:1,selfTest:'pass'},1100,p).reason).toBe('stale-or-future-observation'));
});
