import{describe,expect,it}from'vitest';
import{assessCameraFrameTrust}from'./camera-frame-trust.js';
const policy={maxCaptureAgeMs:500,maxPipelineLatencyMs:200,minConfidence:.8};
const frame={frameId:'f-1',capturedAtMs:1000,receivedAtMs:1050,processedAtMs:1100,confidence:.95,source:'camera' as const,modelVerified:true};
describe('camera frame trust',()=>{
  it('accepts fresh verified semantic evidence',()=>expect(assessCameraFrameTrust(frame,1200,policy)).toEqual({status:'trusted',reason:'fresh-verified-frame',usableForSemanticClaim:true}));
  it('rejects stale and time-inverted frames',()=>{
    expect(assessCameraFrameTrust(frame,1600,policy).reason).toBe('stale-frame');
    expect(assessCameraFrameTrust({...frame,receivedAtMs:900},1200,policy).reason).toBe('non-monotonic-timestamps');
  });
  it('blocks semantic claims when latency, model trust or confidence is insufficient',()=>{
    expect(assessCameraFrameTrust({...frame,processedAtMs:1250},1300,policy)).toMatchObject({status:'degraded',usableForSemanticClaim:false});
    expect(assessCameraFrameTrust({...frame,modelVerified:false},1200,policy).reason).toBe('model-unverified');
    expect(assessCameraFrameTrust({...frame,confidence:.4},1200,policy).reason).toBe('low-confidence');
  });
});
