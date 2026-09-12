export type ModelReviewState='pending'|'approved'|'rejected';

export interface ModelProvenanceManifest{
  modelId:string;
  artifactVersion:string;
  artifactSha256:string;
  framework:string;
  trainingDataRefs:string[];
  evaluationRefs:string[];
  review:ModelReviewState;
  signedByTrustedPipeline:boolean;
}

export interface ModelProvenanceAssessment{
  state:'admissible'|'degraded'|'rejected';
  reasons:string[];
  researchPerceptionAllowed:boolean;
  controlAuthority:'none';
  qualificationClaim:'model-provenance-gate-only-not-safety-certification';
}

const SHA256=/^[a-f0-9]{64}$/i;
const nonEmpty=(value:string)=>value.trim().length>0;

export function assessModelProvenance(manifest:ModelProvenanceManifest):ModelProvenanceAssessment{
  const reasons:string[]=[];
  if(!nonEmpty(manifest.modelId))reasons.push('model-id-missing');
  if(!nonEmpty(manifest.artifactVersion))reasons.push('artifact-version-missing');
  if(!SHA256.test(manifest.artifactSha256))reasons.push('artifact-hash-invalid');
  if(!nonEmpty(manifest.framework))reasons.push('framework-missing');
  if(manifest.trainingDataRefs.length===0||manifest.trainingDataRefs.some((ref)=>!nonEmpty(ref)))reasons.push('training-provenance-missing');
  if(manifest.evaluationRefs.length===0||manifest.evaluationRefs.some((ref)=>!nonEmpty(ref)))reasons.push('evaluation-evidence-missing');
  if(!manifest.signedByTrustedPipeline)reasons.push('pipeline-signature-unverified');
  if(manifest.review==='pending')reasons.push('independent-review-pending');
  if(manifest.review==='rejected')reasons.push('independent-review-rejected');

  const rejected=reasons.some((reason)=>['artifact-hash-invalid','training-provenance-missing','evaluation-evidence-missing','pipeline-signature-unverified','independent-review-rejected'].includes(reason));
  const state:ModelProvenanceAssessment['state']=rejected?'rejected':reasons.length?'degraded':'admissible';
  return{
    state,
    reasons,
    researchPerceptionAllowed:state==='admissible'&&manifest.review==='approved',
    controlAuthority:'none',
    qualificationClaim:'model-provenance-gate-only-not-safety-certification',
  };
}
