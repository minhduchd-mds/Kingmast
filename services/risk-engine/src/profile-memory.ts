import type { GeoPoint } from '@kingmast/contracts';
import type { DriverProfile,ProfileMemoryEntry } from '@kingmast/contracts/nextgen';

const MAX_ENTRIES_PER_PROFILE=64;
const MAX_LABEL_LENGTH=120;

function cleanLabel(label:string){return label.trim().slice(0,MAX_LABEL_LENGTH)||'Unnamed';}
function pointKey(point:GeoPoint){return`${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;}

export class ProfileMemoryStore{
  private readonly entries=new Map<string,ProfileMemoryEntry[]>();

  list(profile:DriverProfile):ProfileMemoryEntry[]{
    if(!profile.privacy.personalization)return[];
    const values=this.entries.get(profile.id)??[];
    return values.filter((entry)=>profile.privacy.locationHistory||entry.kind==='ui-preference').map((entry)=>({...entry,position:entry.position?{...entry.position}:null}));
  }

  rememberPlace(profile:DriverProfile,label:string,position:GeoPoint,nowMs=Date.now()):ProfileMemoryEntry|null{
    if(!profile.privacy.personalization||!profile.privacy.locationHistory)return null;
    const id=`place:${pointKey(position)}`;
    return this.upsert(profile.id,{id,profileId:profile.id,kind:'recent-place',label:cleanLabel(label),position:{...position},routeKey:null,createdAtMs:nowMs,lastUsedAtMs:nowMs});
  }

  rememberRoute(profile:DriverProfile,label:string,routeKey:string,nowMs=Date.now()):ProfileMemoryEntry|null{
    if(!profile.privacy.personalization||!profile.privacy.locationHistory)return null;
    const normalized=routeKey.trim().slice(0,240);
    if(!normalized)return null;
    const id=`route:${normalized}`;
    return this.upsert(profile.id,{id,profileId:profile.id,kind:'preferred-route',label:cleanLabel(label),position:null,routeKey:normalized,createdAtMs:nowMs,lastUsedAtMs:nowMs});
  }

  rememberUiPreference(profile:DriverProfile,label:string,preferenceKey:string,nowMs=Date.now()):ProfileMemoryEntry|null{
    if(!profile.privacy.personalization)return null;
    const key=preferenceKey.trim().slice(0,120);
    if(!key)return null;
    const id=`ui:${key}`;
    return this.upsert(profile.id,{id,profileId:profile.id,kind:'ui-preference',label:cleanLabel(label),position:null,routeKey:key,createdAtMs:nowMs,lastUsedAtMs:nowMs});
  }

  clearLocationMemory(profileId:string){
    const existing=this.entries.get(profileId)??[];
    this.entries.set(profileId,existing.filter((entry)=>entry.kind==='ui-preference'));
  }

  clearProfile(profileId:string){this.entries.delete(profileId);}

  private upsert(profileId:string,next:ProfileMemoryEntry):ProfileMemoryEntry{
    const values=this.entries.get(profileId)??[];
    const index=values.findIndex((entry)=>entry.id===next.id);
    const entry=index>=0?{...next,createdAtMs:values[index]!.createdAtMs}:next;
    if(index>=0)values[index]=entry;else values.push(entry);
    values.sort((a,b)=>b.lastUsedAtMs-a.lastUsedAtMs);
    if(values.length>MAX_ENTRIES_PER_PROFILE)values.length=MAX_ENTRIES_PER_PROFILE;
    this.entries.set(profileId,values);
    return{...entry,position:entry.position?{...entry.position}:null};
  }
}
