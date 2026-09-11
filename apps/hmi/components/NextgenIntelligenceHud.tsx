'use client';

import {AlertTriangle,BrainCircuit,Eye,Route} from 'lucide-react';
import {useEffect,useMemo,useRef} from 'react';
import type {NavigationRoute} from '@kingmast/contracts';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {refreshNextgenNavigation} from '../lib/nextgen-client';
import {buildNextgenStatusCards,type NextgenStatusCard} from '../lib/nextgen-view-model';
import {useI18n} from '../lib/i18n';
import {isNavigationRoute} from '../lib/persisted-navigation';
import type {KingmastTelemetryEventDetail} from '../lib/realtime';

const ROUTE_KEYS=['kingmast:v006:route','kingmast:v25:route'];
const HORIZON_SYNC_MS=30_000;

function iconFor(card:NextgenStatusCard){
  if(card.id==='driver')return Eye;
  if(card.id.startsWith('advisory-'))return Route;
  if(card.id==='perception'||card.id==='camera')return BrainCircuit;
  return AlertTriangle;
}

function cachedRoute():NavigationRoute|null{
  try{
    for(const key of ROUTE_KEYS){
      const raw=window.localStorage.getItem(key);if(!raw)continue;
      const parsed=JSON.parse(raw) as {route?:unknown};
      if(isNavigationRoute(parsed?.route))return parsed.route;
    }
  }catch{}
  return null;
}

function useNavigationHorizonSync(){
  const latest=useRef<KingmastTelemetryEventDetail|null>(null);
  const inFlight=useRef<AbortController|null>(null);
  const lastSyncAt=useRef(0);
  useEffect(()=>{
    let disposed=false;
    const sync=async()=>{
      const now=Date.now();
      if(disposed||inFlight.current||!navigator.onLine||document.visibilityState==='hidden'||now-lastSyncAt.current<HORIZON_SYNC_MS)return;
      const detail=latest.current;if(!detail)return;
      const controller=new AbortController();inFlight.current=controller;lastSyncAt.current=now;
      try{
        await refreshNextgenNavigation({vehicleId:detail.diagnostics?.deviceId??'legacy-device',vehicle:detail.frame.vehicle,route:cachedRoute(),collisionCritical:detail.frame.alerts.some((item)=>item.severity==='critical'),lookaheadM:5_000},controller.signal);
      }catch(cause){
        if(cause instanceof DOMException&&cause.name==='AbortError')return;
      }finally{
        if(inFlight.current===controller)inFlight.current=null;
      }
    };
    const onTelemetry=(event:Event)=>{latest.current=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;void sync();};
    const onVisibility=()=>{if(document.visibilityState==='visible')void sync();};
    window.addEventListener('kingmast:telemetry',onTelemetry);document.addEventListener('visibilitychange',onVisibility);
    const timer=window.setInterval(()=>void sync(),HORIZON_SYNC_MS);
    return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener('kingmast:telemetry',onTelemetry);document.removeEventListener('visibilitychange',onVisibility);inFlight.current?.abort();inFlight.current=null;};
  },[]);
}

export default function NextgenIntelligenceHud(){
  useNavigationHorizonSync();
  const{snapshot,loading,error}=useNextgenRuntime(true,2_000);
  const{isVietnamese}=useI18n();
  const card=useMemo(()=>buildNextgenStatusCards(snapshot,isVietnamese).find((item)=>item.tone==='critical'||item.tone==='caution')??null,[snapshot,isVietnamese]);
  if((loading&&!snapshot)||error||!card)return null;
  const Icon=iconFor(card);
  const critical=card.tone==='critical';
  return <aside className={`connectedRoadHud connectedRoadCompact nextgenIntelligenceHud severity-${critical?'critical':'caution'}`} role={critical?'alert':'status'} aria-label={isVietnamese?'Trí tuệ dự báo KINGMAST':'KINGMAST predictive intelligence'} data-testid="nextgen-intelligence" data-attention={critical?'critical':'transient'}>
    <div className="connectedRoadHead"><span><BrainCircuit strokeWidth={1.8}/><strong>{isVietnamese?'Trí tuệ xe':'Vehicle intelligence'}</strong><small>{isVietnamese?'chỉ khuyến cáo':'advisory only'}</small></span></div>
    <div className={`connectedAdvisory severity-${critical?'critical':'caution'}`}><Icon strokeWidth={1.9}/><span><strong>{card.title}</strong><small>{card.detail}</small></span></div>
  </aside>;
}
