import type {VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {activeVehiclePermissions} from './vehicle-access.js';
import {roleRank} from './vehicle-grant-policy.js';

export type GrantRevocationReason='allowed'|'target-not-found'|'target-already-revoked'|'actor-not-active'|'actor-cannot-share-keys'|'actor-role-insufficient'|'last-owner-protected';
export interface GrantRevocationDecision{allowed:boolean;reason:GrantRevocationReason;target:VehicleAccessGrant|null;}

function activeGrant(grants:VehicleAccessGrant[],vehicleId:string,profileId:string,nowMs:number){
  return grants.filter((grant)=>grant.vehicleId===vehicleId&&grant.profileId===profileId&&grant.validFromMs<=nowMs&&(grant.validUntilMs===null||grant.validUntilMs>=nowMs)&&(grant.revokedAtMs===null||grant.revokedAtMs>nowMs)).sort((a,b)=>b.validFromMs-a.validFromMs)[0]??null;
}
function activeOwners(grants:VehicleAccessGrant[],vehicleId:string,nowMs:number){return grants.filter((grant)=>grant.vehicleId===vehicleId&&grant.role==='owner'&&grant.validFromMs<=nowMs&&(grant.validUntilMs===null||grant.validUntilMs>=nowMs)&&(grant.revokedAtMs===null||grant.revokedAtMs>nowMs));}

export function validateGrantRevocation(input:{grantId:string;actorProfileId:string;grants:VehicleAccessGrant[];nowMs?:number}):GrantRevocationDecision{
  const nowMs=input.nowMs??Date.now();
  const target=input.grants.find((grant)=>grant.grantId===input.grantId)??null;
  if(!target)return{allowed:false,reason:'target-not-found',target:null};
  if(target.revokedAtMs!==null&&target.revokedAtMs<=nowMs)return{allowed:false,reason:'target-already-revoked',target};
  const actor=activeGrant(input.grants,target.vehicleId,input.actorProfileId,nowMs);
  if(!actor)return{allowed:false,reason:'actor-not-active',target};
  const permissions=activeVehiclePermissions(actor,target.vehicleId,input.actorProfileId,nowMs);
  if(!permissions.includes('keys.share'))return{allowed:false,reason:'actor-cannot-share-keys',target};
  if(target.role==='owner'){
    const owners=activeOwners(input.grants,target.vehicleId,nowMs);
    if(actor.role!=='owner'||actor.profileId===target.profileId||owners.length<=1)return{allowed:false,reason:owners.length<=1?'last-owner-protected':'actor-role-insufficient',target};
    return{allowed:true,reason:'allowed',target};
  }
  if(roleRank(actor.role)<=roleRank(target.role))return{allowed:false,reason:'actor-role-insufficient',target};
  return{allowed:true,reason:'allowed',target};
}
