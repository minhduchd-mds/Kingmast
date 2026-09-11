'use client';

import {KeyRound,ShieldCheck,UserRound} from 'lucide-react';
import {useEffect,useState} from 'react';
import type {VehicleAccessGrant,VehiclePermission} from '@kingmast/contracts/nextgen';
import {fetchVehicleSelfAccess} from '../lib/nextgen-client';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {useI18n} from '../lib/i18n';
import type {KingmastTelemetryEventDetail} from '../lib/realtime';

const PARKED_MAX_KMH=1;

export default function VehicleAccessPanel(){
  const{snapshot}=useNextgenRuntime(true,5_000);
  const{isVietnamese}=useI18n();
  const[parked,setParked]=useState(false);
  const[telemetryVehicleId,setTelemetryVehicleId]=useState<string|null>(null);
  const[grant,setGrant]=useState<VehicleAccessGrant|null>(null);
  const[permissions,setPermissions]=useState<VehiclePermission[]>([]);
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
    if(!parked||!snapshot?.activeProfileId||!vehicleId){setGrant(null);setPermissions([]);return;}
    const controller=new AbortController();
    void fetchVehicleSelfAccess(vehicleId,controller.signal).then((view)=>{
      setGrant(view.profileId===snapshot.activeProfileId?view.grant:null);
      setPermissions(view.profileId===snapshot.activeProfileId?view.permissions:[]);
    }).catch((cause)=>{
      if(cause instanceof DOMException&&cause.name==='AbortError')return;
      setGrant(null);setPermissions([]);
    });
    return()=>controller.abort();
  },[parked,snapshot?.activeProfileId,vehicleId]);

  if(!parked||!snapshot?.activeProfileId||!vehicleId||!grant)return null;
  return <aside className="vehicleAccessPanel" role="status" aria-label={isVietnamese?'Quyền truy cập của bạn':'Your vehicle access'} data-testid="vehicle-access-panel" data-control-authority="none">
    <header><ShieldCheck strokeWidth={1.8}/><span><strong>{isVietnamese?'Quyền của bạn':'Your access'}</strong><small>{isVietnamese?'chỉ xem khi xe đang đỗ':'read-only while parked'}</small></span></header>
    <div className="vehicleAccessRows"><span className="vehicleAccessRow state-active"><UserRound strokeWidth={1.8}/><span><b>{grant.profileId}</b><small>{grant.role} · active</small></span><span className="vehicleAccessScope"><KeyRound strokeWidth={1.7}/>{permissions.length}</span></span></div>
  </aside>;
}
