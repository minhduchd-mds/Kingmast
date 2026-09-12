export type EnvironmentSource='vehicle-sensor'|'authorized-provider'|'test-fixture';
export type VisibilityState='normal'|'reduced'|'severely-reduced'|'unknown';
export type IlluminationState='normal'|'low'|'glare'|'transition'|'unknown';
export type PrecipitationState='none'|'rain'|'heavy-rain'|'unknown';

export interface EnvironmentObservation{
  observedAtMs:number;
  source:EnvironmentSource;
  visibility:VisibilityState;
  illumination:IlluminationState;
  precipitation:PrecipitationState;
  cameraObstructed:boolean|null;
}

export interface EnvironmentAssuranceInput{
  nowMs:number;
  observation:EnvironmentObservation|null;
  maxObservationAgeMs:number;
}

export interface EnvironmentAssuranceAssessment{
  observed:boolean;
  state:'nominal'|'degraded'|'unknown'|'invalid';
  reasons:string[];
  confidenceCeiling:number;
  allowedClaims:{cameraClassification:boolean;laneGeometry:boolean;radarGeometry:boolean};
  controlAuthority:'none';
  qualificationClaim:'environment-observation-gate-only-not-weather-inference';
}

const MAX_FUTURE_SKEW_MS=50;

export function assessEnvironmentAssurance(input:EnvironmentAssuranceInput):EnvironmentAssuranceAssessment{
  const fallback:EnvironmentAssuranceAssessment={observed:false,state:'unknown',reasons:['environment-not-observed'],confidenceCeiling:1,allowedClaims:{cameraClassification:true,laneGeometry:true,radarGeometry:true},controlAuthority:'none',qualificationClaim:'environment-observation-gate-only-not-weather-inference'};
  if(!Number.isFinite(input.nowMs)||!Number.isFinite(input.maxObservationAgeMs)||input.maxObservationAgeMs<0)return{...fallback,state:'invalid',reasons:['invalid-input'],confidenceCeiling:0,allowedClaims:{cameraClassification:false,laneGeometry:false,radarGeometry:false}};
  if(input.observation===null)return fallback;

  const observation=input.observation;
  if(!Number.isFinite(observation.observedAtMs))return{...fallback,state:'invalid',reasons:['invalid-observation-time'],confidenceCeiling:0,allowedClaims:{cameraClassification:false,laneGeometry:false,radarGeometry:false}};
  const ageMs=input.nowMs-observation.observedAtMs;
  if(ageMs< -MAX_FUTURE_SKEW_MS)return{...fallback,state:'invalid',reasons:['future-dated-environment-observation'],confidenceCeiling:0,allowedClaims:{cameraClassification:false,laneGeometry:false,radarGeometry:false}};
  if(ageMs>input.maxObservationAgeMs)return{...fallback,reasons:['environment-observation-stale']};

  const reasons:string[]=[];
  if(observation.cameraObstructed===true)reasons.push('camera-obstructed-observed');
  if(observation.visibility==='reduced'||observation.visibility==='severely-reduced')reasons.push('low-visibility-observed');
  if(observation.precipitation==='heavy-rain')reasons.push('heavy-precipitation-observed');
  if(observation.illumination==='glare')reasons.push('glare-observed');
  if(observation.illumination==='transition')reasons.push('illumination-transition-observed');

  const cameraBlocked=observation.cameraObstructed===true;
  const adverse=reasons.length>0;
  return{
    observed:true,
    state:adverse?'degraded':'nominal',
    reasons,
    confidenceCeiling:adverse?0.65:1,
    allowedClaims:{cameraClassification:!cameraBlocked,laneGeometry:!cameraBlocked,radarGeometry:true},
    controlAuthority:'none',
    qualificationClaim:'environment-observation-gate-only-not-weather-inference',
  };
}
