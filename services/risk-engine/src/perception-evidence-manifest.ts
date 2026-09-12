export interface PerceptionEvidenceManifestInput{
  buildCommit:string;
  modelArtifactSha256:string;
  calibrationRef:string;
  timeSyncRef:string;
  datasetRefs:string[];
  evaluationRefs:string[];
}

export interface PerceptionEvidenceManifest{
  schema:'kingmast-perception-evidence-manifest/v1';
  generatedAt:string;
  buildCommit:string;
  modelArtifactSha256:string;
  calibrationRef:string;
  timeSyncRef:string;
  datasetRefs:string[];
  evaluationRefs:string[];
  privacy:{rawCameraFramesIncluded:false;preciseCoordinatesIncluded:false;secretsIncluded:false;rawHardwareSerialIncluded:false};
  targetHardwareQualified:false;
  physicalHilExecuted:false;
  controlAuthority:'none';
  qualificationClaim:'software-perception-evidence-manifest-only-not-physical-validation';
}

const SHA=/^[a-f0-9]{40,64}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const present=(value:string)=>value.trim().length>0;

export function validatePerceptionEvidenceManifestInput(input:PerceptionEvidenceManifestInput){
  const reasons:string[]=[];
  if(!SHA.test(input.buildCommit))reasons.push('build-commit-invalid');
  if(!SHA256.test(input.modelArtifactSha256))reasons.push('model-artifact-hash-invalid');
  if(!present(input.calibrationRef))reasons.push('calibration-ref-missing');
  if(!present(input.timeSyncRef))reasons.push('time-sync-ref-missing');
  if(input.datasetRefs.length===0||input.datasetRefs.some((ref)=>!present(ref)))reasons.push('dataset-evidence-missing');
  if(input.evaluationRefs.length===0||input.evaluationRefs.some((ref)=>!present(ref)))reasons.push('evaluation-evidence-missing');
  return{valid:reasons.length===0,reasons};
}

export function buildPerceptionEvidenceManifest(input:PerceptionEvidenceManifestInput,generatedAt=new Date().toISOString()):PerceptionEvidenceManifest{
  const validation=validatePerceptionEvidenceManifestInput(input);
  if(!validation.valid)throw new Error(`invalid perception evidence manifest: ${validation.reasons.join(',')}`);
  return{
    schema:'kingmast-perception-evidence-manifest/v1',
    generatedAt,
    ...input,
    privacy:{rawCameraFramesIncluded:false,preciseCoordinatesIncluded:false,secretsIncluded:false,rawHardwareSerialIncluded:false},
    targetHardwareQualified:false,
    physicalHilExecuted:false,
    controlAuthority:'none',
    qualificationClaim:'software-perception-evidence-manifest-only-not-physical-validation',
  };
}
