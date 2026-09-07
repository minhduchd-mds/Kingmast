'use client';

import { createPortal } from 'react-dom';
import { useEffect,useMemo,useRef,useState } from 'react';
import type { DetectedObject,RelativeZone,TelemetryFrame } from '@kingmast/contracts';
import { ObjectGlyph } from './GpsSafetyMap';
import { createSimulationFrame } from '../lib/telemetry';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';
import { useDriverProfile } from '../lib/use-driver-profile';
import { formatDistance } from '../lib/units';

const LIVE_FRAME_MAX_AGE_MS=4_000;
const ZONE_ORDER:RelativeZone[]=['front','front-left','front-right','left','right','rear'];

type RangeBand='clear'|'watch'|'near';

function distanceBand(object:DetectedObject):RangeBand{
  if(object.severity==='critical'||object.distanceM<=12)return'near';
  if(object.severity==='caution'||object.distanceM<=24)return'watch';
  return'clear';
}

function nearestByZone(objects:DetectedObject[]){
  const byZone=new Map<RelativeZone,DetectedObject>();
  for(const object of objects){
    if(object.confidence<0.55)continue;
    const current=byZone.get(object.zone);
    if(!current||object.distanceM<current.distanceM)byZone.set(object.zone,object);
  }
  return ZONE_ORDER.map((zone)=>byZone.get(zone)).filter((object):object is DetectedObject=>Boolean(object)).slice(0,6);
}

function objectLabel(object:DetectedObject){
  if(object.kind==='person')return'Pedestrian';
  if(object.kind==='motorcycle')return'Motorcycle';
  if(object.kind==='bicycle')return'Bicycle';
  if(object.kind==='obstacle')return'Obstacle';
  if(object.kind==='unknown')return'Object';
  return object.kind.charAt(0).toUpperCase()+object.kind.slice(1);
}

export default function SurroundSpatialOverlay(){
  const[target,setTarget]=useState<HTMLElement|null>(null);
  const[liveFrame,setLiveFrame]=useState<TelemetryFrame|null>(null);
  const[liveTick,setLiveTick]=useState(0);
  const[sequence,setSequence]=useState(0);
  const liveFrameAtRef=useRef(0);
  const{profile}=useDriverProfile();

  useEffect(()=>{
    const resolveTarget=()=>{
      const next=document.querySelector<HTMLElement>('.v5RoadScene');
      setTarget((current)=>current===next?current:next);
    };
    resolveTarget();
    const observer=new MutationObserver(resolveTarget);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail?.frame)return;
      liveFrameAtRef.current=Date.now();
      setLiveFrame(detail.frame);
      setLiveTick((value)=>value+1);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  useEffect(()=>{
    const simulationTimer=window.setInterval(()=>setSequence((value)=>value+1),2_800);
    const freshnessTimer=window.setInterval(()=>setLiveTick((value)=>value+1),1_000);
    return()=>{window.clearInterval(simulationTimer);window.clearInterval(freshnessTimer);};
  },[]);

  const simulated=useMemo(()=>createSimulationFrame(sequence),[sequence]);
  const liveFresh=liveFrame!==null&&Date.now()-liveFrameAtRef.current<=LIVE_FRAME_MAX_AGE_MS;
  const frame=liveFrame?(liveFresh?liveFrame:null):simulated;
  const objects=useMemo(()=>nearestByZone(frame?.objects??[]),[frame]);

  if(!target)return null;

  return createPortal(
    <div className="surroundSpatialLayer" data-testid="surround-spatial-layer" data-source={liveFrame?(liveFresh?'live':'stale'):'simulator'} aria-hidden="true">
      <div className="surroundPrecisionGrid" data-testid="surround-precision-grid"/>
      <div className="surroundSensorField" data-testid="surround-sensor-field">
        <i data-sector="front"/><i data-sector="right"/><i data-sector="rear"/><i data-sector="left"/>
        <span className="surroundScanSweep"/>
      </div>
      <div className="surroundRangeRings">
        <i data-range="clear"/><i data-range="watch"/><i data-range="near"/>
      </div>
      <div className="surroundAxis"/>
      {objects.map((object)=>{
        const band=distanceBand(object);
        return <div className={`surroundMarker range-${band}`} data-zone={object.zone} data-range={band} data-kind={object.kind} key={object.id}>
          <span className="surroundMarkerRay"/>
          <span className="surroundMarkerTarget"><span className="surroundMarkerGlyph"><ObjectGlyph kind={object.kind}/></span></span>
          <span className="surroundMarkerCopy"><strong>{formatDistance(object.distanceM,profile.units)}</strong><small>{objectLabel(object)}</small></span>
        </div>;
      })}
    </div>,
    target,
  );
}
