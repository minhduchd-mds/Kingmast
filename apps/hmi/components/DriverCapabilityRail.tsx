'use client';

import { useEffect,useMemo,useState } from 'react';
import { Activity,Bot,Camera,Eye,Route } from 'lucide-react';
import type { DriverAssistAvailability,DriverAssistRuntimeSnapshot,SensorHealth,SensorState } from '@kingmast/contracts';
import { KINGMAST_CAPABILITIES,capabilityStateLabel,type CapabilityState } from '../lib/capability-registry';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';

const DRIVER_CAPABILITIES=[
  {key:'ldw',icon:Route,summary:'Lane departure model ready',detail:'Calibrated front-camera lane input required.'},
  {key:'dms',icon:Eye,summary:'Driver attention model ready',detail:'Cabin vision integration required.'},
  {key:'assistant',icon:Bot,summary:'Read-only assistant',detail:'Navigation, road, vehicle-health and alert context only.'},
  {key:'surround',icon:Camera,summary:'Low-speed 360 view',detail:'Native cameras and multi-camera calibration required.'},
  {key:'vehicle',icon:Activity,summary:'Vehicle sensor health',detail:'Read-only edge, radar, camera, CAN and GNSS health.'},
] as const;

type DriverCapabilityKey=typeof DRIVER_CAPABILITIES[number]['key'];
const stateTone:Record<CapabilityState,string>={available:'ready','software-ready':'staged','requires-integration':'integration',research:'research'};
const runtimeTone:Record<DriverAssistAvailability,string>={live:'ready',degraded:'degraded',unavailable:'unavailable',staged:'staged'};
const runtimeLabel:Record<DriverAssistAvailability,string>={live:'Live',degraded:'Degraded',unavailable:'Unavailable',staged:'Software ready'};
const sensorLabel:Record<keyof SensorHealth,string>={radarFront:'Front radar',radarRear:'Rear radar',camera:'Camera',can:'CAN',gnssImu:'GNSS/IMU',ecu:'ECU'};

function pct(value:number){return`${Math.round(value*100)}%`;}
function laneRuntime(runtime:DriverAssistRuntimeSnapshot){
  const status=runtime.ldw;
  if(status.availability==='unavailable')return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'Lane input unavailable',detail:'Awaiting fresh calibrated front-camera lane data.'};
  if(status.availability==='degraded')return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'Lane confidence limited',detail:`${status.reason.replaceAll('-',' ')} · confidence ${pct(status.confidence)}`};
  const departure=status.severity!=='safe'&&status.side;
  return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:departure?`Departure risk · ${status.side}`:'Lane monitoring active',detail:status.timeToLineCrossingS!==null?`TTLC ${status.timeToLineCrossingS.toFixed(1)} s · confidence ${pct(status.confidence)}`:`Fresh lane model · confidence ${pct(status.confidence)}`};
}
function dmsRuntime(runtime:DriverAssistRuntimeSnapshot){
  const status=runtime.dms;
  if(status.availability==='unavailable')return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'Cabin observation unavailable',detail:'Awaiting fresh cabin-camera attention samples.'};
  if(status.availability==='degraded')return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'Driver observation limited',detail:`${status.reason.replaceAll('-',' ')} · face ${pct(status.faceAvailability)}`};
  const labels={attentive:'Driver attentive',distracted:'Attention away','prolonged-distraction':'Prolonged distraction','drowsiness-suspected':'Drowsiness suspected','driver-unavailable':'Driver unavailable'} as const;
  return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:labels[status.state],detail:`PERCLOS ${pct(status.perclos)} · gaze away ${pct(status.gazeAwayRatio)}`};
}
function assistantRuntime(runtime:DriverAssistRuntimeSnapshot){
  const status=runtime.assistant;
  return status.availability==='live'
    ?{tone:runtimeTone.live,label:runtimeLabel.live,summary:'Read-only context online',detail:'Authenticated telemetry context · no actuator tools.'}
    :{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'Read-only assistant ready',detail:'Waiting for fresh vehicle context before live grounding.'};
}
function surroundRuntime(runtime:DriverAssistRuntimeSnapshot){
  const status=runtime.surround;
  if(status.availability==='live')return{tone:runtimeTone.live,label:runtimeLabel.live,summary:'Calibrated 360 ready',detail:`${status.synchronizedCameraCount} synchronized cameras · max error ${status.maxReprojectionErrorPx?.toFixed(1)??'—'} px`};
  if(status.availability==='degraded')return{tone:runtimeTone.degraded,label:runtimeLabel.degraded,summary:'360 readiness limited',detail:`${status.reason.replaceAll('-',' ')} · ${status.readyCameraCount}/${Math.max(status.cameraCount,4)} ready`};
  return{tone:runtimeTone[status.availability],label:runtimeLabel[status.availability],summary:'360 native feeds unavailable',detail:'Four synchronized calibrated camera feeds are required.'};
}
function sensorAvailability(sensors:SensorHealth|null):DriverAssistAvailability{
  if(!sensors)return'unavailable';
  const states=Object.values(sensors) as SensorState[];
  if(states.includes('unavailable'))return'unavailable';
  if(states.includes('degraded'))return'degraded';
  return'live';
}
function vehicleRuntime(sensors:SensorHealth|null){
  const availability=sensorAvailability(sensors);
  if(!sensors)return{tone:runtimeTone.unavailable,label:runtimeLabel.unavailable,summary:'Sensor health unavailable',detail:'Awaiting authenticated edge telemetry.'};
  const entries=Object.entries(sensors) as Array<[keyof SensorHealth,SensorState]>;
  const unhealthy=entries.filter(([,state])=>state!=='ok');
  if(!unhealthy.length)return{tone:runtimeTone.live,label:runtimeLabel.live,summary:'Sensors healthy',detail:`${entries.length}/${entries.length} sensor domains reporting OK`};
  const detail=unhealthy.slice(0,3).map(([key,state])=>`${sensorLabel[key]} ${state}`).join(' · ');
  return{tone:runtimeTone[availability],label:runtimeLabel[availability],summary:availability==='unavailable'?'Sensor coverage unavailable':'Sensor health degraded',detail};
}
function runtimePresentation(key:DriverCapabilityKey,runtime:DriverAssistRuntimeSnapshot,sensors:SensorHealth|null){
  if(key==='ldw')return laneRuntime(runtime);
  if(key==='dms')return dmsRuntime(runtime);
  if(key==='assistant')return assistantRuntime(runtime);
  if(key==='surround')return surroundRuntime(runtime);
  return vehicleRuntime(sensors);
}
function attentionRelevant(key:DriverCapabilityKey,runtime:DriverAssistRuntimeSnapshot,sensors:SensorHealth|null){
  if(key==='ldw')return runtime.ldw.availability!=='live'||runtime.ldw.severity!=='safe';
  if(key==='dms')return runtime.dms.availability!=='live'||runtime.dms.state!=='attentive';
  if(key==='vehicle')return sensorAvailability(sensors)!=='live';
  return false;
}
function runtimeState(key:DriverCapabilityKey,runtime:DriverAssistRuntimeSnapshot|null,sensors:SensorHealth|null){
  if(key==='vehicle')return sensors?sensorAvailability(sensors):'awaiting';
  return runtime?.[key].availability??'awaiting';
}

export default function DriverCapabilityRail(){
  const[runtime,setRuntime]=useState<DriverAssistRuntimeSnapshot|null>(null);
  const[sensors,setSensors]=useState<SensorHealth|null>(null);
  const[moving,setMoving]=useState(false);
  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail?.frame)return;
      setMoving(detail.frame.vehicle.source!=='simulator'&&detail.frame.vehicle.speedKmh>=5);
      setSensors(detail.frame.sensors);
      if(detail.frame.assist)setRuntime(detail.frame.assist);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  const items=useMemo(()=>{
    if(!moving||!runtime)return[];
    return DRIVER_CAPABILITIES
      .map((item)=>({...item,capability:KINGMAST_CAPABILITIES.find((capability)=>capability.key===item.key)}))
      .filter((item)=>item.capability!==undefined&&attentionRelevant(item.key,runtime,sensors))
      .slice(0,2);
  },[moving,runtime,sensors]);

  if(!moving)return null;

  const introCopy=runtime
    ?'Quiet monitoring · only attention-relevant status is shown.'
    :'Assist status awaiting fresh telemetry.';

  return <aside className="driverCapabilityRail isQuiet" aria-label="Driver assistance capability status" data-testid="driver-capability-rail" data-runtime={runtime?'connected':'awaiting'} data-quiet="true">
    <div className="driverCapabilityIntro">
      <strong>Driver assist</strong>
      <span>{introCopy}</span>
    </div>
    {items.map(({key,icon:Icon,summary,detail,capability})=>{
      if(!capability)return null;
      const live=runtime?runtimePresentation(key,runtime,sensors):null;
      const tone=live?.tone??stateTone[capability.state];
      const label=live?.label??capabilityStateLabel[capability.state];
      return <article key={key} className={`driverCapabilityItem tone-${tone}`} data-capability={key} data-runtime-state={runtimeState(key,runtime,sensors)}>
        <span className="driverCapabilityIcon"><Icon strokeWidth={1.8}/></span>
        <span className="driverCapabilityCopy">
          <span className="driverCapabilityTitle"><strong>{capability.shortName}</strong><em>{label}</em></span>
          <small>{live?.summary??summary}</small>
          <p>{live?.detail??detail}</p>
        </span>
      </article>;
    })}
  </aside>;
}
