'use client';

import { AlertTriangle,Bell,CloudRain,Construction,Navigation,Route,School,ShieldCheck,WifiOff } from 'lucide-react';
import { useEffect,useMemo,useRef,useState } from 'react';
import type { ConnectedRoadAdvisory,NavigationRoute,TelemetryFrame } from '@kingmast/contracts';
import KingmastV5 from './KingmastV5';
import { createSimulationFrame } from '../lib/telemetry';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';
import { useConnectedRoadContext } from '../lib/connected-road';

const ROUTE_KEYS=['kingmast:v006:route','kingmast:v25:route'];
const LIVE_FRAME_MAX_AGE_MS=4_000;

function readCachedRoute():NavigationRoute|null{
  try{
    for(const key of ROUTE_KEYS){
      const raw=window.localStorage.getItem(key);if(!raw)continue;
      const parsed=JSON.parse(raw) as {route?:NavigationRoute};if(parsed?.route)return parsed.route;
    }
  }catch{}
  return null;
}

function advisoryIcon(item:ConnectedRoadAdvisory){
  if(item.category==='school-zone')return School;
  if(item.category==='construction-zone')return Construction;
  if(item.category==='weather'||item.category==='road-hazard')return CloudRain;
  if(item.category==='highway-exit'||item.category==='lane-guidance')return Route;
  if(item.category==='spat')return Bell;
  return AlertTriangle;
}

function DegradedConnectedRoad({title,message}:{title:string;message:string}){
  return <aside className="connectedRoadHud connectedRoadDegraded" aria-label="Connected road intelligence status" role="status">
    <div className="connectedRoadHead"><span><WifiOff strokeWidth={1.8}/><strong>{title}</strong><small>advisory unavailable</small></span></div>
    <div className="connectedClear"><AlertTriangle/><span><strong>{title}</strong><small>{message}</small></span></div>
    <div className="connectedSafetyNote"><AlertTriangle/> Continue using posted signs, signals and direct road observation.</div>
  </aside>;
}

function ConnectedRoadHud(){
  const[sequence,setSequence]=useState(0);
  const[route,setRoute]=useState<NavigationRoute|null>(null);
  const[liveFrame,setLiveFrame]=useState<TelemetryFrame|null>(null);
  const[nowMs,setNowMs]=useState(()=>Date.now());
  const liveFrameAtRef=useRef(0);

  useEffect(()=>{const timer=window.setInterval(()=>setSequence((value)=>value+1),2800);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNowMs(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{const load=()=>setRoute(readCachedRoute());load();const timer=window.setInterval(load,2_000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    const onTelemetry=(event:Event)=>{
      const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;
      if(!detail?.frame)return;
      liveFrameAtRef.current=Date.now();
      setLiveFrame(detail.frame);
    };
    window.addEventListener('kingmast:telemetry',onTelemetry);
    return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);
  },[]);

  const simulated=useMemo(()=>createSimulationFrame(sequence),[sequence]);
  const hasSeenLive=liveFrame!==null;
  const liveFresh=hasSeenLive&&nowMs-liveFrameAtRef.current<=LIVE_FRAME_MAX_AGE_MS;
  const frame=hasSeenLive?liveFrame:simulated;
  const contextVehicle=hasSeenLive?(liveFresh?liveFrame.vehicle:null):simulated.vehicle;
  const collisionCritical=liveFresh||!hasSeenLive?frame.alerts.some((item)=>item.severity==='critical'):false;
  const connected=useConnectedRoadContext(contextVehicle,route,collisionCritical);

  if(hasSeenLive&&!liveFresh)return <DegradedConnectedRoad title="Connected road paused" message="Vehicle telemetry is stale. KINGMAST will not substitute simulator road context over a live vehicle session."/>;
  if(connected.error&&!connected.context)return <DegradedConnectedRoad title="Connected road unavailable" message="The connected-road service did not return valid context. Primary collision and navigation warnings remain separate."/>;
  if(!connected.context){
    return <aside className="connectedRoadHud connectedRoadLoading" aria-label="Connected road intelligence status" role="status"><div className="connectedRoadHead"><span><ShieldCheck strokeWidth={1.8}/><strong>Connected road</strong><small>{hasSeenLive?'connecting':'demo context'}</small></span></div><div className="connectedClear"><ShieldCheck/><span><strong>Loading road context</strong><small>Checking route-relevant connected-road advisories.</small></span></div></aside>;
  }

  const context=connected.context;
  const spatAdvisory=context.advisories.find((item)=>item.category==='spat')??null;
  const relevantIntersection=spatAdvisory?context.spat.find((item)=>spatAdvisory.id===`spat-${item.intersectionId}`)??null:null;
  const signal=relevantIntersection?.movements[0]??null;
  const exitAdvisory=context.advisories.find((item)=>item.category==='highway-exit')??null;
  const lane=route?context.laneTopology:null;

  return <aside className={`connectedRoadHud coverage-${context.coverage}`} aria-label="Connected road intelligence">
    <div className="connectedRoadHead">
      <span><ShieldCheck strokeWidth={1.8}/><strong>Connected road</strong><small>{context.coverage.replaceAll('-',' ')}</small></span>
      {context.suppressionReason?<em>Driver-priority suppression active</em>:null}
    </div>
    {context.advisories.length?
      <div className="connectedAdvisories" aria-live="polite" aria-atomic="false">{context.advisories.map((item)=>{const Icon=advisoryIcon(item);return <div className={`connectedAdvisory severity-${item.severity}`} key={item.id}><Icon strokeWidth={1.9}/><span><strong>{item.title}</strong><small>{item.message}</small></span></div>;})}</div>:
      <div className="connectedClear" aria-live="polite"><ShieldCheck/><span><strong>{collisionCritical?'Connected context suppressed':'Road context clear'}</strong><small>{collisionCritical?'Collision warning has display priority.':'No route-relevant connected-road caution currently requires attention.'}</small></span></div>}
    <div className="connectedMeta" aria-hidden="true">
      <span><Bell/>{signal?<><b>{signal.state.replaceAll('-',' ')}</b><small>Route SPaT</small></>:<><b>No relevant live phase</b><small>Route SPaT</small></>}</span>
      <span><Navigation/><b>{lane?`${lane.laneCount} lanes`:'Lane data partial'}</b><small>Topology</small></span>
      <span><Route/><b>{exitAdvisory?.distanceM!==null&&exitAdvisory?.distanceM!==undefined?`${Math.round(exitAdvisory.distanceM)} m`:'No exit due'}</b><small>Next exit</small></span>
    </div>
    <div className="connectedSafetyNote"><AlertTriangle/> Advisory only · verify signs, signals, emergency vehicles and road conditions.</div>
  </aside>;
}

export default function KingmastV006(){return <><KingmastV5/><ConnectedRoadHud/></>;}
