'use client';

import {Brain,MapPin,Route} from 'lucide-react';
import {useEffect,useState} from 'react';
import type {ProfileMemoryEntry} from '@kingmast/contracts/nextgen';
import {fetchProfileMemory} from '../lib/nextgen-client';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {useI18n} from '../lib/i18n';
import type {KingmastTelemetryEventDetail} from '../lib/realtime';

const PARKED_MAX_KMH=1;

function MemoryIcon({entry}:{entry:ProfileMemoryEntry}){
  if(entry.kind==='recent-place')return <MapPin strokeWidth={1.8}/>;
  if(entry.kind==='preferred-route')return <Route strokeWidth={1.8}/>;
  return <Brain strokeWidth={1.8}/>;
}

export default function ProfileMemoryPanel(){
  const{snapshot}=useNextgenRuntime(true,5_000);
  const{isVietnamese}=useI18n();
  const[parked,setParked]=useState(false);
  const[entries,setEntries]=useState<ProfileMemoryEntry[]>([]);
  const[locationHistory,setLocationHistory]=useState(false);

  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail)return;
      setParked(detail.frame.vehicle.speedKmh<=PARKED_MAX_KMH);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  useEffect(()=>{
    const profileId=snapshot?.activeProfileId;
    if(!parked||!profileId){setEntries([]);setLocationHistory(false);return;}
    const controller=new AbortController();
    void fetchProfileMemory(profileId,controller.signal).then((view)=>{
      setEntries(view.entries.slice(0,4));
      setLocationHistory(view.privacy.locationHistory);
    }).catch((cause)=>{
      if(cause instanceof DOMException&&cause.name==='AbortError')return;
      setEntries([]);setLocationHistory(false);
    });
    return()=>controller.abort();
  },[parked,snapshot?.activeProfileId]);

  if(!parked||!snapshot?.activeProfileId)return null;
  return <aside className="profileMemoryPanel" role="status" aria-label={isVietnamese?'Bộ nhớ hồ sơ lái xe':'Driver profile memory'} data-testid="profile-memory-panel" data-control-authority="none">
    <header><Brain strokeWidth={1.8}/><span><strong>{isVietnamese?'Bộ nhớ cá nhân':'Personal memory'}</strong><small>{isVietnamese?'chỉ hiển thị khi xe đang đỗ':'visible only while parked'}</small></span></header>
    {!locationHistory&&entries.length===0?<p>{isVietnamese?'Lịch sử vị trí đang tắt. KINGMAST không lưu địa điểm hay tuyến đường.':'Location history is off. KINGMAST does not retain places or routes.'}</p>:null}
    {entries.length>0?<div className="profileMemoryItems">{entries.map((entry)=><span className="profileMemoryItem" key={entry.id}><MemoryIcon entry={entry}/><span><b>{entry.label}</b><small>{entry.kind==='recent-place'?(isVietnamese?'Địa điểm gần đây':'Recent place'):entry.kind==='preferred-route'?(isVietnamese?'Tuyến ưu tiên':'Preferred route'):(isVietnamese?'Tuỳ chọn giao diện':'UI preference')}</small></span></span>)}</div>:null}
  </aside>;
}
