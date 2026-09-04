'use client';

import { AlertTriangle,Bell,CloudRain,Construction,Navigation,Route,School,ShieldCheck } from 'lucide-react';
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

function ConnectedRoadHud(){
  const[sequence,setSequence]=useState(0);
  const[route,setRoute]=useState<NavigationRoute|null>(null);
  const[liveFrame,setLiveFrame]=useState<TelemetryFrame|null>(null);
  const liveFrameAtRef=useRef(0);

  useEffect(()=>{const timer=window.setInterval(()=>setSequence((value)=>value+1),2800);return()=>window.clearInterval(timer);},[]);
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
  const liveFresh=liveFrame!==null&&Date.now()-liveFrameAtRef.current<=LIVE_FRAME_MAX_AGE_MS;
  const frame=liveFresh&&liveFrame?liveFrame:simulated;
  const collisionCritical=frame.alerts.some((item)=>item.severity==='critical');
  const connected=useConnectedRoadContext(frame.vehicle,route,collisionCritical);
  const context=connected.context;
  const signal=context?.spat[0]?.movements[0]??null;
  const nextExit=context?.exits[0]??null;
  const lane=context?.laneTopology??null;

  if(!context)return null;

  return <aside className={`connectedRoadHud coverage-${context.coverage}`} aria-label="Connected road intelligence" aria-live="polite">
    <div className="connectedRoadHead">
      <span><ShieldCheck strokeWidth={1.8}/><strong>Connected road</strong><small>{context.coverage.replaceAll('-',' ')}</small></span>
      {context.suppressionReason?<em>Driver-priority suppression active</em>:null}
    </div>
    {context.advisories.length?
      <div className="connectedAdvisories">{context.advisories.map((item)=>{const Icon=advisoryIcon(item);return <div className={`connectedAdvisory severity-${item.severity}`} key={item.id}><Icon strokeWidth={1.9}/><span><strong>{item.title}</strong><small>{item.message}</small></span></div>;})}</div>:
      <div className="connectedClear"><ShieldCheck/><span><strong>{collisionCritical?'Connected context suppressed':'Road context clear'}</strong><small>{collisionCritical?'Collision warning has display priority.':'No connected-road caution currently requires attention.'}</small></span></div>}
    <div className="connectedMeta">
      <span><Bell/>{signal?<><b>{signal.state.replaceAll('-',' ')}</b><small>SPaT</small></>:<><b>No live phase</b><small>SPaT</small></>}</span>
      <span><Navigation/><b>{lane?`${lane.laneCount} lanes`:'Lane data partial'}</b><small>Topology</small></span>
      <span><Route/><b>{nextExit?`${Math.round(nextExit.distanceM)} m`:'No exit due'}</b><small>Next exit</small></span>
    </div>
    <div className="connectedSafetyNote"><AlertTriangle/> Advisory only · verify signs, signals, emergency vehicles and road conditions.</div>
  </aside>;
}

export default function KingmastV006(){return <><KingmastV5/><ConnectedRoadHud/></>;}
