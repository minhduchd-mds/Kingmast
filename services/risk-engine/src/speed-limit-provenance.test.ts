import{describe,expect,it}from'vitest';
import{assessSpeedLimitProvenance}from'./speed-limit-provenance.js';
const p={maxAgeMs:30000,minConfidence:.8,maxSpeedKph:160};
const e=(source:'camera-sign'|'map'|'provider',speedKph:number,confidence=.9,observedAtMs=1000,provenanceId='ref')=>({source,speedKph,confidence,observedAtMs,provenanceId});
describe('speed limit provenance',()=>{
 it('returns trusted fresh provenanced evidence',()=>expect(assessSpeedLimitProvenance([e('camera-sign',60)],1100,p)).toMatchObject({status:'trusted',speedKph:60,source:'camera-sign'}));
 it('blocks conflicting trusted sources',()=>expect(assessSpeedLimitProvenance([e('map',50),e('camera-sign',60)],1100,p)).toMatchObject({status:'degraded',speedKph:null,reason:'trusted-source-conflict'}));
 it('does not invent a default speed limit',()=>expect(assessSpeedLimitProvenance([],1100,p).status).toBe('unavailable'));
 it('rejects missing provenance',()=>expect(assessSpeedLimitProvenance([e('map',50,.9,1000,'')],1100,p).reason).toBe('no-fresh-provenance'));
});
