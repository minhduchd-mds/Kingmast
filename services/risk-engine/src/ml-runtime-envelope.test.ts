import {describe,expect,it} from 'vitest';
import {assessMlRuntimeEnvelope} from './ml-runtime-envelope.js';

const base={modelLoaded:true,runtimeHealthy:true,inferenceP99Ms:20,droppedFrames:2,windowFrames:100,memoryMiB:512,reviewedBounds:{maxInferenceP99Ms:50,maxDropRatio:0.05,maxMemoryMiB:1024,reviewRef:'review:ml-runtime-01'}};

describe('assessMlRuntimeEnvelope',()=>{
  it('permits semantic claims only inside explicitly reviewed runtime bounds',()=>{
    const result=assessMlRuntimeEnvelope(base);
    expect(result.state).toBe('verified');
    expect(result.semanticClaimsAllowed).toBe(true);
    expect(result.controlAuthority).toBe('none');
  });

  it('never invents runtime limits when reviewed bounds are absent',()=>{
    const result=assessMlRuntimeEnvelope({...base,reviewedBounds:null});
    expect(result.state).toBe('unverified');
    expect(result.semanticClaimsAllowed).toBe(false);
  });

  it('degrades semantic claims when latency, drops or memory exceed bounds',()=>{
    expect(assessMlRuntimeEnvelope({...base,inferenceP99Ms:80}).state).toBe('degraded');
    expect(assessMlRuntimeEnvelope({...base,droppedFrames:10}).reasons).toContain('frame-drop-ratio-outside-bound');
    expect(assessMlRuntimeEnvelope({...base,memoryMiB:2048}).semanticClaimsAllowed).toBe(false);
  });

  it('makes ML semantics unavailable when model/runtime health is lost',()=>{
    expect(assessMlRuntimeEnvelope({...base,modelLoaded:false}).state).toBe('unavailable');
    expect(assessMlRuntimeEnvelope({...base,runtimeHealthy:false}).state).toBe('unavailable');
  });

  it('keeps radar geometry explicitly independent of ML runtime health',()=>{
    const result=assessMlRuntimeEnvelope({...base,runtimeHealthy:false});
    expect(result.radarGeometryUnaffected).toBe(true);
  });
});
