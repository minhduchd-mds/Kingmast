export type RadarTrackObservation={trackId:string;observedAtMs:number;rangeM:number;rangeRateMps:number;confidence:number};
export type RadarTrackContinuityOptions={maxAgeMs:number;maxGapMs:number;minConfidence:number};
export type RadarTrackContinuityResult={status:'reliable'|'degraded'|'rejected';reason:string;sampleCount:number;latestAgeMs:number|null};

const finite=(value:number)=>Number.isFinite(value);

export function assessRadarTrackContinuity(observations:RadarTrackObservation[],nowMs:number,options:RadarTrackContinuityOptions):RadarTrackContinuityResult{
  if(!finite(nowMs)||!finite(options.maxAgeMs)||!finite(options.maxGapMs)||!finite(options.minConfidence)||options.maxAgeMs<0||options.maxGapMs<0||options.minConfidence<0||options.minConfidence>1){
    return{status:'rejected',reason:'invalid-policy',sampleCount:observations.length,latestAgeMs:null};
  }
  if(observations.length===0)return{status:'rejected',reason:'no-observations',sampleCount:0,latestAgeMs:null};
  const firstId=observations[0]?.trackId;
  let previousAt=-Infinity;
  for(const observation of observations){
    if(!observation.trackId||observation.trackId!==firstId)return{status:'rejected',reason:'track-id-changed',sampleCount:observations.length,latestAgeMs:null};
    if(!finite(observation.observedAtMs)||!finite(observation.rangeM)||!finite(observation.rangeRateMps)||!finite(observation.confidence))return{status:'rejected',reason:'non-finite-observation',sampleCount:observations.length,latestAgeMs:null};
    if(observation.rangeM<0||observation.confidence<0||observation.confidence>1)return{status:'rejected',reason:'invalid-observation',sampleCount:observations.length,latestAgeMs:null};
    if(observation.observedAtMs>nowMs)return{status:'rejected',reason:'future-observation',sampleCount:observations.length,latestAgeMs:null};
    if(observation.observedAtMs<=previousAt)return{status:'rejected',reason:'non-monotonic-time',sampleCount:observations.length,latestAgeMs:null};
    if(previousAt!==-Infinity&&observation.observedAtMs-previousAt>options.maxGapMs)return{status:'degraded',reason:'continuity-gap',sampleCount:observations.length,latestAgeMs:nowMs-observation.observedAtMs};
    previousAt=observation.observedAtMs;
  }
  const latest=observations[observations.length-1]!;
  const latestAgeMs=nowMs-latest.observedAtMs;
  if(latestAgeMs>options.maxAgeMs)return{status:'rejected',reason:'stale-track',sampleCount:observations.length,latestAgeMs};
  if(observations.some((observation)=>observation.confidence<options.minConfidence))return{status:'degraded',reason:'low-confidence-sample',sampleCount:observations.length,latestAgeMs};
  if(observations.length<2)return{status:'degraded',reason:'insufficient-history',sampleCount:1,latestAgeMs};
  return{status:'reliable',reason:'continuous-track',sampleCount:observations.length,latestAgeMs};
}
