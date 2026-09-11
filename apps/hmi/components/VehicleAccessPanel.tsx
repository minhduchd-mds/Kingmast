'use client';

import {KeyRound,ShieldCheck,UserRound} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import type {VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {fetchVehicleAccessGrants} from '../lib/nextgen-client';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {useI18n} from '../lib/i18n';
import type {KingmastTelemetryEventDetail} from '../lib/realtime';

const PARKED_MAX_KMH=1;

function grantState(grant:VehicleAccessGrant,nowMs:number){
  if(grant.revokedAtMs!==null&&grant.revokedAtMs<=nowMs)return'revoked' as const;
  if(grant.validUntilMs!==null&&grant.validUntilMs<nowMs)return'expired' as const;
  if(grant.validFromMs>nowMs)return'future' as const;
  return'active' as const;
}

export default function VehicleAccessPanel(){
  const{snapshot}=useNextgenRuntime(true,5_000);
  const{isVietnamese}=useI18n();
  const[parked,setParked]=useState(false);
  const[telemetryVehicleId,setTelemetryVehicleId]=useState<string|null>(null);
  const[grants,setGrants]=useState<VehicleAccessGrant[]>([]);
  const vehicleId=snapshot?.navigationHorizon?.vehicleId??telemetryVehicleId;

  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail)return;
      setParked(detail.frame.vehicle.speedKmh<=PARKED_MAX_KMH);
      setTelemetryVehicleId(detail.diagnostics?.deviceId?.trim()||null);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  useEffect(()=>{
    if(!parked||!snapshot?.activeProfileId||!vehicleId){setGrants([]);return;}
    const controller=new AbortController();
    void fetchVehicleAccessGrants(vehicleId,controller.signal).then((view)=>setGrants(view.grants.slice(0,8))).catch((cause)=>{
      if(cause instanceof DOMException&&cause.name==='AbortError')return;
      setGrants([]);
    });
    return()=>controller.abort();
  },[parked,snapshot?.activeProfileId,vehicleId]);

  const rows=useMemo(()=>{
    const now=Date.now();
    return grants.map((grant)=>({grant,state:grantState(grant,now)})).sort((a,b)=>a.state===b.state?b.grant.validFromMs-a.grant.validFromMs:a.state==='active'?-1:b.state==='active'?1:0).slice(0,5);
  },[grants]);

  if(!parked||!snapshot?.activeProfileId||!vehicleId||rows.length===0)return null;
  return <aside className="vehicleAccessPanel" role="status" aria-label={isVietnamese?'Quyền truy cập xe':'Vehicle access'} data-testid="vehicle-access-panel" data-control-authority="none">
    <header><ShieldCheck strokeWidth={1.8}/><span><strong>{isVietnamese?'Quyền truy cập xe':'Vehicle access'}</strong><small>{isVietnamese?'chỉ xem khi xe đang đỗ':'read-only while parked'}</small></span></header>
    <div className="vehicleAccessRows">{rows.map(({grant,state})=><span className={`vehicleAccessRow state-${state}`} key={grant.grantId}><UserRound strokeWidth={1.8}/><span><b>{grant.profileId}</b><small>{grant.role} · {state}</small></span><span className="vehicleAccessScope"><KeyRound strokeWidth={1.7}/>{grant.permissions.length}</span></span>)}</div>
  </aside>;
}
