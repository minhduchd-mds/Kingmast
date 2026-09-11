import type {DriverRole,VehicleAccessGrant,VehiclePermission} from '@kingmast/contracts/nextgen';
import {activeVehiclePermissions,roleAllowsPermission,rolePermissionCeiling} from './vehicle-access.js';

export type GrantIssuanceReason=
  |'allowed'
  |'bootstrap-owner-required'
  |'grant-already-revoked'
  |'invalid-validity-window'
  |'role-duration-exceeded'
  |'role-permission-exceeded'
  |'issuer-not-active'
  |'issuer-cannot-share-keys'
  |'issuer-role-insufficient'
  |'issuer-permission-exceeded'
  |'issuer-validity-exceeded';

export interface GrantIssuanceDecision{allowed:boolean;reason:GrantIssuanceReason;normalizedPermissions:VehiclePermission[];}

const ROLE_RANK:Record<DriverRole,number>={owner:6,admin:5,driver:4,guest:3,valet:2,service:1};
const MAX_ROLE_DURATION_MS:Partial<Record<DriverRole,number>>={
  admin:365*24*60*60*1000,
  driver:365*24*60*60*1000,
  guest:7*24*60*60*1000,
  valet:24*60*60*1000,
  service:7*24*60*60*1000,
};

function activeIssuer(grants:VehicleAccessGrant[],vehicleId:string,profileId:string,nowMs:number){
  return grants
    .filter((grant)=>grant.vehicleId===vehicleId&&grant.profileId===profileId&&grant.validFromMs<=nowMs&&(grant.validUntilMs===null||grant.validUntilMs>=nowMs)&&(grant.revokedAtMs===null||grant.revokedAtMs>nowMs))
    .sort((a,b)=>b.validFromMs-a.validFromMs)[0]??null;
}

export function validateGrantIssuance(proposed:VehicleAccessGrant,existing:VehicleAccessGrant[],nowMs=Date.now()):GrantIssuanceDecision{
  const normalizedPermissions=[...new Set(proposed.permissions)].filter((permission):permission is VehiclePermission=>roleAllowsPermission(proposed.role,permission));
  if(proposed.revokedAtMs!==null)return{allowed:false,reason:'grant-already-revoked',normalizedPermissions};
  if(proposed.validUntilMs!==null&&proposed.validUntilMs<=proposed.validFromMs)return{allowed:false,reason:'invalid-validity-window',normalizedPermissions};
  const maxDuration=MAX_ROLE_DURATION_MS[proposed.role];
  if(maxDuration!==undefined&&(proposed.validUntilMs===null||proposed.validUntilMs-proposed.validFromMs>maxDuration))return{allowed:false,reason:'role-duration-exceeded',normalizedPermissions};
  if(normalizedPermissions.length!==new Set(proposed.permissions).size)return{allowed:false,reason:'role-permission-exceeded',normalizedPermissions};

  const vehicleGrants=existing.filter((grant)=>grant.vehicleId===proposed.vehicleId);
  if(vehicleGrants.length===0){
    const bootstrap=proposed.role==='owner'&&proposed.profileId===proposed.issuedByProfileId;
    return bootstrap?{allowed:true,reason:'allowed',normalizedPermissions}:{allowed:false,reason:'bootstrap-owner-required',normalizedPermissions};
  }

  const issuer=activeIssuer(vehicleGrants,proposed.vehicleId,proposed.issuedByProfileId,nowMs);
  if(!issuer)return{allowed:false,reason:'issuer-not-active',normalizedPermissions};
  if(!roleAllowsPermission(issuer.role,'keys.share')||!issuer.permissions.includes('keys.share'))return{allowed:false,reason:'issuer-cannot-share-keys',normalizedPermissions};
  if(ROLE_RANK[issuer.role]<=ROLE_RANK[proposed.role])return{allowed:false,reason:'issuer-role-insufficient',normalizedPermissions};
  const issuerPermissions=new Set(activeVehiclePermissions(issuer,proposed.vehicleId,issuer.profileId,nowMs));
  if(normalizedPermissions.some((permission)=>!issuerPermissions.has(permission)))return{allowed:false,reason:'issuer-permission-exceeded',normalizedPermissions};
  if(proposed.validFromMs<issuer.validFromMs)return{allowed:false,reason:'issuer-validity-exceeded',normalizedPermissions};
  if(issuer.validUntilMs!==null&&(proposed.validUntilMs===null||proposed.validUntilMs>issuer.validUntilMs))return{allowed:false,reason:'issuer-validity-exceeded',normalizedPermissions};
  return{allowed:true,reason:'allowed',normalizedPermissions};
}

export function grantRoleSummary(role:DriverRole){return{role,rank:ROLE_RANK[role],permissionCeiling:rolePermissionCeiling(role),maxDurationMs:MAX_ROLE_DURATION_MS[role]??null};}
