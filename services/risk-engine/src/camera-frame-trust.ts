export type CameraFrameEvidence={frameId:string;capturedAtMs:number;receivedAtMs:number;processedAtMs:number;confidence:number;source:'camera';modelVerified:boolean};
export type CameraFrameTrustPolicy={maxCaptureAgeMs:number;maxPipelineLatencyMs:number;minConfidence:number};
export type CameraFrameTrust={status:'trusted'|'degraded'|'rejected';reason:string;usableForSemanticClaim:boolean};

const finite=(value:number)=>Number.isFinite(value);
export function assessCameraFrameTrust(frame:CameraFrameEvidence,nowMs:number,policy:CameraFrameTrustPolicy):CameraFrameTrust{
  if(!frame.frameId||!finite(nowMs)||!finite(frame.capturedAtMs)||!finite(frame.receivedAtMs)||!finite(frame.processedAtMs)||!finite(frame.confidence))return{status:'rejected',reason:'invalid-evidence',usableForSemanticClaim:false};
  if(policy.maxCaptureAgeMs<0||policy.maxPipelineLatencyMs<0||policy.minConfidence<0||policy.minConfidence>1)return{status:'rejected',reason:'invalid-policy',usableForSemanticClaim:false};
  if(frame.capturedAtMs>frame.receivedAtMs||frame.receivedAtMs>frame.processedAtMs||frame.processedAtMs>nowMs)return{status:'rejected',reason:'non-monotonic-timestamps',usableForSemanticClaim:false};
  if(nowMs-frame.capturedAtMs>policy.maxCaptureAgeMs)return{status:'rejected',reason:'stale-frame',usableForSemanticClaim:false};
  if(frame.processedAtMs-frame.capturedAtMs>policy.maxPipelineLatencyMs)return{status:'degraded',reason:'pipeline-latency-exceeded',usableForSemanticClaim:false};
  if(!frame.modelVerified)return{status:'degraded',reason:'model-unverified',usableForSemanticClaim:false};
  if(frame.confidence<policy.minConfidence)return{status:'degraded',reason:'low-confidence',usableForSemanticClaim:false};
  return{status:'trusted',reason:'fresh-verified-frame',usableForSemanticClaim:true};
}
