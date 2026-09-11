'use client';

import {Camera,Clock3,Gauge,TriangleAlert} from 'lucide-react';
import {useEffect,useState} from 'react';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {useI18n} from '../lib/i18n';
import type {CameraRuntimeHealthView} from '../lib/nextgen-client';
import type {KingmastTelemetryEventDetail} from '../lib/realtime';

const PARKED_MAX_KMH=1;

function statusLabel(item:CameraRuntimeHealthView,isVietnamese:boolean){
  if(item.status==='overloaded')return isVietnamese?'Quá tải':'Overloaded';
  if(item.status==='degraded')return isVietnamese?'Suy giảm':'Degraded';
  if(item.status==='unavailable')return isVietnamese?'Chưa sẵn sàng':'Unavailable';
  return isVietnamese?'Ổn định':'Healthy';
}

export default function CameraRuntimeDiagnosticsPanel(){
  const{snapshot}=useNextgenRuntime(true,3_000);
  const{isVietnamese}=useI18n();
  const[parked,setParked]=useState(false);

  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail)return;
      setParked(detail.frame.vehicle.speedKmh<=PARKED_MAX_KMH);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  const cameras=(snapshot?.cameraRuntimeHealth??[]).slice(0,4);
  if(!parked||cameras.length===0)return null;
  const unhealthy=cameras.some((camera)=>camera.status!=='ok');

  return <aside className="cameraRuntimeDiagnostics" role="status" aria-label={isVietnamese?'Chẩn đoán camera':'Camera diagnostics'} data-testid="camera-runtime-diagnostics" data-control-authority="none">
    <header><Camera strokeWidth={1.8}/><span><strong>{isVietnamese?'Hiệu năng camera':'Camera runtime'}</strong><small>{isVietnamese?'chỉ xem khi xe đang đỗ':'read-only while parked'}</small></span>{unhealthy?<TriangleAlert className="cameraRuntimeAlert" aria-hidden="true"/>:null}</header>
    <div className="cameraRuntimeRows">{cameras.map((camera)=><div className={`cameraRuntimeRow state-${camera.status}`} key={camera.cameraId}>
      <span className="cameraRuntimeName"><b>{camera.cameraId}</b><small>{statusLabel(camera,isVietnamese)}</small></span>
      <span><Clock3/><b>{camera.p95LatencyMs===null?'—':`${Math.round(camera.p95LatencyMs)} ms`}</b><small>P95</small></span>
      <span><Gauge/><b>{Math.round(camera.dropRate*100)}%</b><small>{isVietnamese?'bỏ frame':'dropped'}</small></span>
    </div>)}</div>
  </aside>;
}
