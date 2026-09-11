import type { CameraPerformanceSnapshot,DriverIdentitySignal,DriverPrivacyPreferences,DriverRole,DriverStateAssessment,DriverUiPreferences,PerceptionFrame,PredictiveAdvisory } from '@kingmast/contracts/nextgen';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}

export interface NextgenRuntimeClientSnapshot {
  perception:PerceptionFrame|null;
  perceptionTrust:{eligibleForAlerts:boolean;reasons:string[];surroundReady:boolean;uniqueCameraCount:number}|null;
  driver:DriverStateAssessment;
  activeProfileId:string|null;
  advisories:PredictiveAdvisory[];
  cameraPerformance:CameraPerformanceSnapshot[];
  controlAuthority:'none';
}

export interface DriverIdentityResolutionView {
  profile:{id:string;displayName:string;role:DriverRole;ui:DriverUiPreferences;privacy:DriverPrivacyPreferences}|null;
  confidence:'high'|'medium'|'none';
  reason:'trusted-device-and-face'|'trusted-device'|'face-only-rejected'|'no-match';
}

async function parseJson<T>(response:Response):Promise<T>{if(!response.ok)throw new Error(`nextgen-api-${response.status}`);return await response.json() as T;}

export async function fetchNextgenRuntime(signal?:AbortSignal):Promise<NextgenRuntimeClientSnapshot>{
  const response=await fetch(`${apiBase()}/v3/nextgen/runtime`,{credentials:'include',cache:'no-store',signal});
  return parseJson<NextgenRuntimeClientSnapshot>(response);
}

export async function resolveNextgenDriver(signalData:DriverIdentitySignal,signal?:AbortSignal):Promise<DriverIdentityResolutionView>{
  const response=await fetch(`${apiBase()}/v3/nextgen/identity/resolve`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(signalData),signal});
  return parseJson<DriverIdentityResolutionView>(response);
}
