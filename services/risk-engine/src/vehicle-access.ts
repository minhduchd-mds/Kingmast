import type { DriverRole,VehicleAccessDecision,VehicleAccessGrant,VehiclePermission } from '@kingmast/contracts/nextgen';

const ROLE_RESTRICTIONS:Partial<Record<DriverRole,ReadonlySet<VehiclePermission>>>={
  guest:new Set<VehiclePermission>(['users.manage','keys.share','settings.safety.change','camera.history.export']),
  valet:new Set<VehiclePermission>(['trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','settings.safety.change']),
  service:new Set<VehiclePermission>(['trip.history.read','camera.history.export','users.manage','keys.share']),
};

export interface EvaluateVehicleAccessInput {
  grant:VehicleAccessGrant|null;
  vehicleId:string;
  profileId:string;
  permission:VehiclePermission;
  nowMs?:number;
}

export function evaluateVehicleAccess(input:EvaluateVehicleAccessInput):VehicleAccessDecision{
  const nowMs=input.nowMs??Date.now();
  const grant=input.grant;
  if(!grant||grant.vehicleId!==input.vehicleId||grant.profileId!==input.profileId||nowMs<grant.validFromMs)return{allowed:false,permission:input.permission,reason:'grant-not-active'};
  if(grant.revokedAtMs!==null&&grant.revokedAtMs<=nowMs)return{allowed:false,permission:input.permission,reason:'grant-revoked'};
  if(grant.validUntilMs!==null&&nowMs>grant.validUntilMs)return{allowed:false,permission:input.permission,reason:'grant-expired'};
  const restricted=ROLE_RESTRICTIONS[grant.role];
  if(restricted?.has(input.permission))return{allowed:false,permission:input.permission,reason:'role-restricted'};
  if(!grant.permissions.includes(input.permission))return{allowed:false,permission:input.permission,reason:'permission-missing'};
  return{allowed:true,permission:input.permission,reason:'allowed'};
}

export function activeVehiclePermissions(grant:VehicleAccessGrant|null,vehicleId:string,profileId:string,nowMs=Date.now()){
  if(!grant)return[] as VehiclePermission[];
  return grant.permissions.filter((permission)=>evaluateVehicleAccess({grant,vehicleId,profileId,permission,nowMs}).allowed);
}
