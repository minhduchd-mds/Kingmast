export interface ReviewedMlRuntimeBounds{
  maxInferenceP99Ms:number;
  maxDropRatio:number;
  maxMemoryMiB:number;
  reviewRef:string;
}

export interface MlRuntimeEnvelopeInput{
  modelLoaded:boolean;
  runtimeHealthy:boolean;
  inferenceP99Ms:number;
  droppedFrames:number;
  windowFrames:number;
  memoryMiB:number;
  reviewedBounds:ReviewedMlRuntimeBounds|null;
}

export interface MlRuntimeEnvelopeAssessment{
  state:'verified'|'unverified'|'degraded'|'unavailable';
  reasons:string[];
  semanticClaimsAllowed:boolean;
  radarGeometryUnaffected:true;
  controlAuthority:'none';
  qualificationClaim:'ml-runtime-envelope-only-not-target-hardware-qualification';
}

export function assessMlRuntimeEnvelope(input:MlRuntimeEnvelopeInput):MlRuntimeEnvelopeAssessment{
  const reasons:string[]=[];
  if(!input.modelLoaded)reasons.push('model-not-loaded');
  if(!input.runtimeHealthy)reasons.push('runtime-unhealthy');
  const numeric=[input.inferenceP99Ms,input.droppedFrames,input.windowFrames,input.memoryMiB];
  if(numeric.some((value)=>!Number.isFinite(value))||input.inferenceP99Ms<0||input.droppedFrames<0||input.windowFrames<=0||input.memoryMiB<0)reasons.push('invalid-runtime-metrics');

  const bounds=input.reviewedBounds;
  if(bounds===null)reasons.push('reviewed-runtime-bounds-missing');
  else{
    const invalidBounds=[bounds.maxInferenceP99Ms,bounds.maxDropRatio,bounds.maxMemoryMiB].some((value)=>!Number.isFinite(value))||bounds.maxInferenceP99Ms<0||bounds.maxDropRatio<0||bounds.maxDropRatio>1||bounds.maxMemoryMiB<0||!bounds.reviewRef.trim();
    if(invalidBounds)reasons.push('reviewed-runtime-bounds-invalid');
    else if(!reasons.includes('invalid-runtime-metrics')){
      const dropRatio=input.droppedFrames/input.windowFrames;
      if(input.inferenceP99Ms>bounds.maxInferenceP99Ms)reasons.push('inference-latency-outside-bound');
      if(dropRatio>bounds.maxDropRatio)reasons.push('frame-drop-ratio-outside-bound');
      if(input.memoryMiB>bounds.maxMemoryMiB)reasons.push('memory-outside-bound');
    }
  }

  const unavailable=reasons.includes('model-not-loaded')||reasons.includes('runtime-unhealthy')||reasons.includes('invalid-runtime-metrics')||reasons.includes('reviewed-runtime-bounds-invalid');
  const degraded=reasons.some((reason)=>['inference-latency-outside-bound','frame-drop-ratio-outside-bound','memory-outside-bound'].includes(reason));
  const state:MlRuntimeEnvelopeAssessment['state']=unavailable?'unavailable':bounds===null?'unverified':degraded?'degraded':'verified';
  return{
    state,
    reasons,
    semanticClaimsAllowed:state==='verified',
    radarGeometryUnaffected:true,
    controlAuthority:'none',
    qualificationClaim:'ml-runtime-envelope-only-not-target-hardware-qualification',
  };
}
