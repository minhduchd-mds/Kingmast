import type {DriverProfile,ProfileMemoryEntry} from '@kingmast/contracts/nextgen';
import {persistenceRecord,type NextgenPersistenceAdapter} from './nextgen-persistence.js';

const PREFIX='nextgen:memory:';
const MAX_ENTRIES=64;
const MAX_LABEL=120;

function prefix(profileId:string){return`${PREFIX}${profileId}:`;}
function key(profileId:string,id:string){return`${prefix(profileId)}${id}`;}
function cleanId(value:string){return value.trim().replace(/[^A-Za-z0-9._:-]/g,'-').slice(0,96);}
function cleanEntry(profile:DriverProfile,input:ProfileMemoryEntry):ProfileMemoryEntry|null{
  if(!profile.privacy.personalization||input.profileId!==profile.id)return null;
  if((input.kind==='recent-place'||input.kind==='preferred-route')&&!profile.privacy.locationHistory)return null;
  const id=cleanId(input.id);if(!id)return null;
  const label=input.label.trim().slice(0,MAX_LABEL)||'Unnamed';
  const position=input.kind==='recent-place'&&input.position?{lat:input.position.lat,lng:input.position.lng}:null;
  const routeKey=input.kind==='preferred-route'&&input.routeKey?input.routeKey.trim().slice(0,120):input.kind==='ui-preference'&&input.routeKey?input.routeKey.trim().slice(0,120):null;
  if(input.kind==='recent-place'&&!position)return null;
  if((input.kind==='preferred-route'||input.kind==='ui-preference')&&!routeKey)return null;
  return{id,profileId:profile.id,kind:input.kind,label,position,routeKey,createdAtMs:input.createdAtMs,lastUsedAtMs:input.lastUsedAtMs};
}

export class ProfileMemoryRepository{
  constructor(private readonly persistence:NextgenPersistenceAdapter){}

  async save(profile:DriverProfile,input:ProfileMemoryEntry,nowMs=Date.now()){
    const clean=cleanEntry(profile,input);if(!clean)return null;
    const keys=await this.persistence.list(prefix(profile.id));
    const storageKey=key(profile.id,clean.id);
    if(!keys.includes(storageKey)&&keys.length>=MAX_ENTRIES){
      const existing=await this.list(profile);const oldest=[...existing].sort((a,b)=>a.lastUsedAtMs-b.lastUsedAtMs)[0];if(oldest)await this.persistence.delete(key(profile.id,oldest.id));
    }
    const previous=await this.persistence.get<ProfileMemoryEntry>(storageKey);
    const value={...clean,createdAtMs:previous?.value.createdAtMs??clean.createdAtMs,lastUsedAtMs:Math.max(clean.lastUsedAtMs,previous?.value.lastUsedAtMs??0)};
    await this.persistence.set(storageKey,persistenceRecord(value,nowMs));return structuredClone(value);
  }

  async list(profile:DriverProfile){
    if(!profile.privacy.personalization){await this.clearProfile(profile.id);return[];}
    if(!profile.privacy.locationHistory)await this.clearLocationMemory(profile.id);
    const keys=(await this.persistence.list(prefix(profile.id))).slice(0,MAX_ENTRIES);
    const values=(await Promise.all(keys.map(async storageKey=>(await this.persistence.get<ProfileMemoryEntry>(storageKey))?.value??null))).filter((value):value is ProfileMemoryEntry=>value!==null);
    return values.sort((a,b)=>b.lastUsedAtMs-a.lastUsedAtMs).map((value)=>structuredClone(value));
  }

  async remove(profileId:string,id:string){await this.persistence.delete(key(profileId,cleanId(id)));}
  async clearProfile(profileId:string){for(const storageKey of await this.persistence.list(prefix(profileId)))await this.persistence.delete(storageKey);}
  async clearLocationMemory(profileId:string){
    for(const storageKey of await this.persistence.list(prefix(profileId))){const record=await this.persistence.get<ProfileMemoryEntry>(storageKey);if(record&&record.value.kind!=='ui-preference')await this.persistence.delete(storageKey);}
  }
}
