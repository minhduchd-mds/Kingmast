import type { DriverProfile } from '@kingmast/contracts/nextgen';
import { persistenceRecord,type NextgenPersistenceAdapter } from './nextgen-persistence.js';

const PROFILE_PREFIX='nextgen:profile:';
const MAX_PROFILES=64;

function sanitize(profile:DriverProfile):DriverProfile{
  const locationAllowed=profile.privacy.personalization&&profile.privacy.locationHistory;
  return{
    ...profile,
    id:profile.id.trim().slice(0,96),
    displayName:profile.displayName.trim().slice(0,120),
    trustedDeviceIds:[...new Set(profile.trustedDeviceIds.map((id)=>id.trim().slice(0,128)).filter(Boolean))].slice(0,16),
    home:locationAllowed&&profile.home?{...profile.home}:null,
    work:locationAllowed&&profile.work?{...profile.work}:null,
    ui:{...profile.ui,mapZoom:Math.max(8,Math.min(20,profile.ui.mapZoom)),warningVolume:Math.max(0,Math.min(100,profile.ui.warningVolume))},
    privacy:{...profile.privacy},
  };
}

export class DriverProfileRepository{
  constructor(private readonly persistence:NextgenPersistenceAdapter){}

  async save(profile:DriverProfile,nowMs=Date.now()){
    const clean=sanitize({...profile,updatedAtMs:nowMs});
    if(!clean.id)throw new Error('invalid-profile-id');
    const keys=await this.persistence.list(PROFILE_PREFIX);
    if(!keys.includes(`${PROFILE_PREFIX}${clean.id}`)&&keys.length>=MAX_PROFILES)throw new Error('profile-capacity-reached');
    await this.persistence.set(`${PROFILE_PREFIX}${clean.id}`,persistenceRecord(clean,nowMs));
    return clean;
  }

  async get(profileId:string){
    const record=await this.persistence.get<DriverProfile>(`${PROFILE_PREFIX}${profileId}`);
    return record?sanitize(record.value):null;
  }

  async list(){
    const keys=(await this.persistence.list(PROFILE_PREFIX)).slice(0,MAX_PROFILES);
    const profiles=await Promise.all(keys.map(async(key)=>(await this.persistence.get<DriverProfile>(key))?.value??null));
    return profiles.filter((value):value is DriverProfile=>value!==null).map(sanitize).sort((a,b)=>b.updatedAtMs-a.updatedAtMs);
  }

  async delete(profileId:string){await this.persistence.delete(`${PROFILE_PREFIX}${profileId}`);}
}
