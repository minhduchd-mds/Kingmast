import type { VehicleAccessAuditEvent,VehicleAccessDecision,VehicleAccessGrant,VehiclePermission } from '@kingmast/contracts/nextgen';
import { evaluateVehicleAccess } from './vehicle-access.js';

const MAX_GRANTS=512;
const MAX_AUDIT_EVENTS=1_000;

export class VehicleAccessRegistry{
  private readonly grants=new Map<string,VehicleAccessGrant>();
  private readonly audit:VehicleAccessAuditEvent[]=[];

  upsert(grant:VehicleAccessGrant){
    const normalized:VehicleAccessGrant={...grant,permissions:[...new Set(grant.permissions)]};
    if(!this.grants.has(grant.grantId)&&this.grants.size>=MAX_GRANTS){
      const oldest=[...this.grants.values()].sort((a,b)=>a.validFromMs-b.validFromMs)[0];
      if(oldest)this.grants.delete(oldest.grantId);
    }
    this.grants.set(grant.grantId,normalized);
    return this.copyGrant(normalized);
  }

  revoke(grantId:string,revokedAtMs=Date.now()){
    const grant=this.grants.get(grantId);
    if(!grant)return null;
    const next={...grant,revokedAtMs};
    this.grants.set(grantId,next);
    return this.copyGrant(next);
  }

  findActive(vehicleId:string,profileId:string,nowMs=Date.now()):VehicleAccessGrant|null{
    const candidates=[...this.grants.values()]
      .filter((grant)=>grant.vehicleId===vehicleId&&grant.profileId===profileId&&grant.validFromMs<=nowMs&&(grant.validUntilMs===null||grant.validUntilMs>=nowMs)&&(grant.revokedAtMs===null||grant.revokedAtMs>nowMs))
      .sort((a,b)=>b.validFromMs-a.validFromMs);
    return candidates[0]?this.copyGrant(candidates[0]):null;
  }

  decide(vehicleId:string,profileId:string,permission:VehiclePermission,nowMs=Date.now()):VehicleAccessDecision{
    const grant=this.findActive(vehicleId,profileId,nowMs);
    const decision=evaluateVehicleAccess({grant,vehicleId,profileId,permission,nowMs});
    this.record({id:`${nowMs}:${vehicleId}:${profileId}:${permission}:${this.audit.length}`,vehicleId,profileId,permission,allowed:decision.allowed,reason:decision.reason,timestampMs:nowMs});
    return decision;
  }

  auditLog(limit=100){return this.audit.slice(-Math.max(1,Math.min(200,limit))).reverse().map((event)=>({...event}));}
  listGrants(vehicleId?:string){return[...this.grants.values()].filter((grant)=>!vehicleId||grant.vehicleId===vehicleId).map((grant)=>this.copyGrant(grant));}

  private record(event:VehicleAccessAuditEvent){this.audit.push(event);if(this.audit.length>MAX_AUDIT_EVENTS)this.audit.splice(0,this.audit.length-MAX_AUDIT_EVENTS);}
  private copyGrant(grant:VehicleAccessGrant):VehicleAccessGrant{return{...grant,permissions:[...grant.permissions]};}
}
