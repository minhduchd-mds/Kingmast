import type { VehicleAccessAuditEvent,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { persistenceRecord,type NextgenPersistenceAdapter } from './nextgen-persistence.js';

const GRANT_PREFIX='nextgen:grant:';
const AUDIT_PREFIX='nextgen:access-audit:';
const MAX_GRANTS=512;
const MAX_AUDIT=1_000;

export class VehicleAccessRepository{
  constructor(private readonly persistence:NextgenPersistenceAdapter){}

  async saveGrant(grant:VehicleAccessGrant,nowMs=Date.now()){
    const clean={...grant,grantId:grant.grantId.trim().slice(0,128),vehicleId:grant.vehicleId.trim().slice(0,96),profileId:grant.profileId.trim().slice(0,96),issuedByProfileId:grant.issuedByProfileId.trim().slice(0,96),permissions:[...new Set(grant.permissions)]};
    if(!clean.grantId||!clean.vehicleId||!clean.profileId)throw new Error('invalid-access-grant');
    const keys=await this.persistence.list(GRANT_PREFIX);
    if(!keys.includes(`${GRANT_PREFIX}${clean.grantId}`)&&keys.length>=MAX_GRANTS)throw new Error('grant-capacity-reached');
    await this.persistence.set(`${GRANT_PREFIX}${clean.grantId}`,persistenceRecord(clean,nowMs));
    return clean;
  }

  async getGrant(grantId:string){return(await this.persistence.get<VehicleAccessGrant>(`${GRANT_PREFIX}${grantId}`))?.value??null;}

  async listGrants(vehicleId?:string){
    const keys=(await this.persistence.list(GRANT_PREFIX)).slice(0,MAX_GRANTS);
    const grants=await Promise.all(keys.map(async(key)=>(await this.persistence.get<VehicleAccessGrant>(key))?.value??null));
    return grants.filter((value):value is VehicleAccessGrant=>value!==null&&(!vehicleId||value.vehicleId===vehicleId)).sort((a,b)=>b.validFromMs-a.validFromMs);
  }

  async revoke(grantId:string,revokedAtMs=Date.now()){
    const grant=await this.getGrant(grantId);if(!grant)return null;
    return this.saveGrant({...grant,revokedAtMs},revokedAtMs);
  }

  async appendAudit(event:VehicleAccessAuditEvent){
    const key=`${AUDIT_PREFIX}${event.timestampMs}:${event.id.slice(0,128)}`;
    await this.persistence.set(key,persistenceRecord({...event},event.timestampMs));
    const keys=await this.persistence.list(AUDIT_PREFIX);
    if(keys.length>MAX_AUDIT){for(const stale of keys.slice(0,keys.length-MAX_AUDIT))await this.persistence.delete(stale);}
  }

  async audit(limit=100){
    const keys=(await this.persistence.list(AUDIT_PREFIX)).slice(-Math.max(1,Math.min(200,limit))).reverse();
    const values=await Promise.all(keys.map(async(key)=>(await this.persistence.get<VehicleAccessAuditEvent>(key))?.value??null));
    return values.filter((value):value is VehicleAccessAuditEvent=>value!==null);
  }
}
