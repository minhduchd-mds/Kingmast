'use client';

import { MoonStar,Power,RotateCcw,ShieldCheck } from 'lucide-react';
import { useSystemLifecycle } from '../lib/use-system-lifecycle';

function reasonLabel(value:ReturnType<typeof useSystemLifecycle>['recoveryReason']){
  if(value==='process-restart')return'Process restart';
  if(value==='watchdog')return'Watchdog recovery';
  if(value==='power-loss')return'Power recovery';
  if(value==='page-restore')return'Display session restored';
  return'System recovery';
}

export default function SystemLifecycleStatus(){
  const state=useSystemLifecycle();
  if(state.phase==='active')return null;
  const recovering=state.phase==='recovering';const sleeping=state.phase==='sleeping';
  const Icon=recovering?RotateCcw:sleeping?MoonStar:Power;
  const title=recovering?'Restoring driver view':sleeping?'Display sleeping':'Waking KINGMAST';
  const detail=recovering?`${reasonLabel(state.recoveryReason)} · cached route and preferences are restored independently from live safety telemetry.`:sleeping?'Driver display is suspended. Native safety services must continue according to the vehicle-host design.':'Restoring the driver HMI without fabricating sensor or ignition readiness.';
  return <aside className={`systemLifecycleStatus phase-${state.phase}`} role="status" aria-live="polite" data-testid="system-lifecycle-status"><Icon/><span><strong>{title}</strong><small>{detail}</small></span><em>{state.native?`${state.ignition} ignition`:'host-managed'}</em>{recovering?<ShieldCheck aria-hidden="true"/>:null}</aside>;
}
