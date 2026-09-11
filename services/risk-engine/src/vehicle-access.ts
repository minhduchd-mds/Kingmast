import type { DriverRole,VehicleAccessDecision,VehicleAccessGrant,VehiclePermission } from '@kingmast/contracts/nextgen';

export const ALL_VEHICLE_PERMISSIONS:readonly VehiclePermission[]=[
  'vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','settings.safety.change','diagnostics.read',
];

const ROLE_PERMISSION_CEILINGS:Record<DriverRole,ReadonlySet<VehiclePermission>>={
  owner:new Set(ALL_VEHICLE_PERMISSIONS),
  admin:new Set<VehiclePermission>(['vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','diagnostics.read']),
  driver:new Set<VehiclePermission>(['vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','diagnostics.read']),
  guest:new Set<VehiclePermission>(['vehicle.use','vehicle.unlock','profile.read.self','camera.live.view']),
  valet:new Set<VehiclePermission>(['vehicle.use','vehicle.unlock','profile.read.self']),
  service:new Set<VehiclePermission>(['profile.read.self','camera.live.view','diagnostics.read']),
};

export function rolePermissionCeiling(role:DriverRole):VehiclePermission[]{return ALL_VEHICLE_PERMISSIONS.filter((permission)=>ROLE_PERMISSION_CEILINGS[role].has(permission));}
export function roleAllowsPermission(role:DriverRole,permission:VehiclePermission){return ROLE_PERMISSION_CEILINGS[role].has(permission);}

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
  if(!roleAllowsPermission(grant.role,input.permission))return{allowed:false,permission:input.permission,reason:'role-restricted'};
  if(!grant.permissions.includes(input.permission))return{allowed:false,permission:input.permission,reason:'permission-missing'};
  return{allowed:true,permission:input.permission,reason:'allowed'};
}

export function activeVehiclePermissions(grant:VehicleAccessGrant|null,vehicleId:string,profileId:string,nowMs=Date.now()){
  if(!grant)return[] as VehiclePermission[];
  return grant.permissions.filter((permission)=>evaluateVehicleAccess({grant,vehicleId,profileId,permission,nowMs}).allowed);
}
