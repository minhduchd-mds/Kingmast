'use client';

import { useEffect,useMemo,useRef,useState } from 'react';

export type IgnitionState='off'|'accessory'|'on'|'unknown';
export type LifecyclePhase='active'|'sleeping'|'waking'|'recovering';
export type RecoveryReason='process-restart'|'watchdog'|'power-loss'|'page-restore'|'unknown'|null;

export interface LifecycleSnapshot {
  ignition:IgnitionState;
  phase:LifecyclePhase;
  recoveryReason:RecoveryReason;
  timestampMs:number;
  native:boolean;
}

interface NativeLifecycleSnapshot { ignition:IgnitionState; phase:LifecyclePhase; recoveryReason?:Exclude<RecoveryReason,'page-restore'>; timestampMs:number; }
interface NativeLifecycleBridge { getState:()=>Promise<NativeLifecycleSnapshot>; subscribe?:(listener:(value:NativeLifecycleSnapshot)=>void)=>(()=>void)|void; }

function nativeBridge():NativeLifecycleBridge|null{
  if(typeof window==='undefined')return null;
  const value=(window as unknown as {kingmastNative?:{lifecycle?:NativeLifecycleBridge}}).kingmastNative?.lifecycle;
  return value&&typeof value.getState==='function'?value:null;
}

function browserSnapshot(phase:LifecyclePhase='active',reason:RecoveryReason=null):LifecycleSnapshot{return{ignition:'unknown',phase,recoveryReason:reason,timestampMs:Date.now(),native:false};}
function normalize(value:NativeLifecycleSnapshot):LifecycleSnapshot{return{ignition:['off','accessory','on'].includes(value.ignition)?value.ignition:'unknown',phase:['active','sleeping','waking','recovering'].includes(value.phase)?value.phase:'active',recoveryReason:value.recoveryReason??null,timestampMs:Number.isFinite(value.timestampMs)?value.timestampMs:Date.now(),native:true};}

export function useSystemLifecycle(){
  const[state,setState]=useState<LifecycleSnapshot>(()=>browserSnapshot());
  const wakeTimer=useRef<number|null>(null);

  useEffect(()=>{
    const bridge=nativeBridge();
    let disposed=false;let unsubscribe:(()=>void)|void;
    const commit=(next:LifecycleSnapshot)=>{if(!disposed)setState(next);};
    const wakeBrowser=(reason:RecoveryReason=null)=>{
      if(wakeTimer.current!==null)window.clearTimeout(wakeTimer.current);
      commit(browserSnapshot(reason?'recovering':'waking',reason));
      wakeTimer.current=window.setTimeout(()=>commit(browserSnapshot('active')),650);
    };

    if(bridge){
      void bridge.getState().then((value)=>commit(normalize(value))).catch(()=>commit(browserSnapshot()));
      if(bridge.subscribe)unsubscribe=bridge.subscribe((value)=>commit(normalize(value)));
    }else commit(browserSnapshot(document.hidden?'sleeping':'active'));

    const onVisibility=()=>{if(bridge)return;if(document.hidden)commit(browserSnapshot('sleeping'));else wakeBrowser();};
    const onPageShow=(event:PageTransitionEvent)=>{if(!bridge&&event.persisted)wakeBrowser('page-restore');};
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pageshow',onPageShow);
    return()=>{disposed=true;if(wakeTimer.current!==null)window.clearTimeout(wakeTimer.current);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pageshow',onPageShow);unsubscribe?.();};
  },[]);

  return useMemo(()=>state,[state]);
}
