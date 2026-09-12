import {describe,expect,it} from 'vitest';
import {assessModelProvenance} from './ai-model-provenance.js';

const hash='a'.repeat(64);
const base={
  modelId:'front-camera-detector',
  artifactVersion:'2026.09.12',
  artifactSha256:hash,
  framework:'onnx',
  trainingDataRefs:['dataset:front-camera-v1'],
  evaluationRefs:['eval:urban-night-v1'],
  review:'approved' as const,
  signedByTrustedPipeline:true,
};

describe('assessModelProvenance',()=>{
  it('admits research perception only with complete approved provenance',()=>{
    const result=assessModelProvenance(base);
    expect(result.state).toBe('admissible');
    expect(result.researchPerceptionAllowed).toBe(true);
    expect(result.controlAuthority).toBe('none');
  });

  it('keeps pending review degraded and non-admissible',()=>{
    const result=assessModelProvenance({...base,review:'pending'});
    expect(result.state).toBe('degraded');
    expect(result.researchPerceptionAllowed).toBe(false);
  });

  it('rejects invalid hash, missing data lineage, or untrusted pipeline',()=>{
    expect(assessModelProvenance({...base,artifactSha256:'bad'}).state).toBe('rejected');
    expect(assessModelProvenance({...base,trainingDataRefs:[]}).state).toBe('rejected');
    expect(assessModelProvenance({...base,signedByTrustedPipeline:false}).state).toBe('rejected');
  });

  it('rejects an independently rejected artifact',()=>{
    const result=assessModelProvenance({...base,review:'rejected'});
    expect(result.state).toBe('rejected');
    expect(result.reasons).toContain('independent-review-rejected');
  });
});
