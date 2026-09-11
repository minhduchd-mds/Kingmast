import type { NavigationRoute,VehiclePosition } from '@kingmast/contracts';
import type { CameraPerformanceSnapshot,DriverIdentitySignal,DriverPrivacyPreferences,DriverRole,DriverStateAssessment,DriverUiPreferences,NavigationHorizon,PerceptionFrame,PredictiveAdvisory,ProfileMemoryEntry,SurroundFusionSnapshot,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import type {VisionSceneSnapshot} from '@kingmast/contracts/vision-nextgen';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}

export interface NextgenRuntimeClientSnapshot {
  perception:PerceptionFrame|null;
  perceptionTrust:{eligibleForAlerts:boolean;reasons:string[];surroundReady:boolean;uniqueCameraCount:number}|null;
  surround:SurroundFusionSnapshot|null;
  visionScene:VisionSceneSnapshot;
  navigationHorizon:NavigationHorizon|null;
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

export interface NextgenNavigationRefreshInput {
  vehicleId:string;
  vehicle:VehiclePosition;
  route:NavigationRoute|null;
  collisionCritical:boolean;
  lookaheadM?:number;
}

export interface NextgenNavigationRefreshResult {
  horizon:NavigationHorizon;
  advisories:PredictiveAdvisory[];
  sources:{routeIntelligence:'available'|'unavailable';connectedRoad:'available'|'unavailable'};
  controlAuthority:'none';
}

export interface ProfileMemoryView {
  entries:ProfileMemoryEntry[];
  privacy:{personalization:boolean;locationHistory:boolean};
  controlAuthority:'none';
}

export interface VehicleAccessListView {
  grants:VehicleAccessGrant[];
  controlAuthority:'none';
}

async function parseJson<T>(response:Response):Promise<T>{if(!response.ok)throw new Error(`nextgen-api-${response.status}`);return await response.json() as T;}

export async function fetchNextgenRuntime(signal?:AbortSignal):Promise<NextgenRuntimeClientSnapshot>{
  const response=await fetch(`${apiBase()}/v3/nextgen/runtime`,{credentials:'include',cache:'no-store',signal});
  return parseJson<NextgenRuntimeClientSnapshot>(response);
}

export async function fetchProfileMemory(profileId:string,signal?:AbortSignal):Promise<ProfileMemoryView>{
  const normalized=profileId.trim();if(!normalized)throw new Error('profile-id-required');
  const response=await fetch(`${apiBase()}/v3/nextgen/memory?profileId=${encodeURIComponent(normalized)}`,{credentials:'include',cache:'no-store',signal});
  return parseJson<ProfileMemoryView>(response);
}

export async function fetchVehicleAccessGrants(vehicleId:string,signal?:AbortSignal):Promise<VehicleAccessListView>{
  const normalized=vehicleId.trim();if(!normalized)throw new Error('vehicle-id-required');
  const response=await fetch(`${apiBase()}/v3/nextgen/access/grants?vehicleId=${encodeURIComponent(normalized)}`,{credentials:'include',cache:'no-store',signal});
  return parseJson<VehicleAccessListView>(response);
}

export async function revokeVehicleAccessGrant(grantId:string,signal?:AbortSignal):Promise<{grant:VehicleAccessGrant;controlAuthority:'none'}>{
  const normalized=grantId.trim();if(!normalized)throw new Error('grant-id-required');
  const response=await fetch(`${apiBase()}/v3/nextgen/access/revoke`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({grantId:normalized}),signal});
  return parseJson<{grant:VehicleAccessGrant;controlAuthority:'none'}>(response);
}

export async function refreshNextgenNavigation(input:NextgenNavigationRefreshInput,signal?:AbortSignal):Promise<NextgenNavigationRefreshResult>{
  const response=await fetch(`${apiBase()}/v3/nextgen/navigation/horizon/refresh`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});
  return parseJson<NextgenNavigationRefreshResult>(response);
}

export async function resolveNextgenDriver(signalData:DriverIdentitySignal,signal?:AbortSignal):Promise<DriverIdentityResolutionView>{
  const response=await fetch(`${apiBase()}/v3/nextgen/identity/resolve`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(signalData),signal});
  return parseJson<DriverIdentityResolutionView>(response);
}
