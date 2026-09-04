'use client';

import { useEffect,useMemo,useState } from 'react';
import type { ConnectedRoadContext,NavigationRoute,VehiclePosition } from '@kingmast/contracts';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}

export interface ConnectedRoadController{context:ConnectedRoadContext|null;loading:boolean;error:string|null;}

export function useConnectedRoadContext(vehicle:VehiclePosition|null,route:NavigationRoute|null,collisionCritical:boolean):ConnectedRoadController{
  const[context,setContext]=useState<ConnectedRoadContext|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState<string|null>(null);
  const key=useMemo(()=>vehicle?`${vehicle.lat.toFixed(4)}:${vehicle.lng.toFixed(4)}:${Math.round(vehicle.speedKmh/5)}:${route?.fetchedAtMs??0}:${collisionCritical}`:'none',[collisionCritical,route?.fetchedAtMs,vehicle?.lat,vehicle?.lng,vehicle?.speedKmh]);
  useEffect(()=>{if(!vehicle){setContext(null);return;}let cancelled=false;const load=async()=>{setLoading(true);try{const response=await fetch(`${apiBase()}/connected-road/context`,{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({vehicle,route,collisionCritical})});if(!response.ok)throw new Error(`connected-road-${response.status}`);const value=await response.json() as ConnectedRoadContext;if(!cancelled){setContext(value);setError(null);}}catch(errorValue){if(!cancelled){setError(errorValue instanceof Error?errorValue.message:'connected-road-unavailable');setContext(null);}}finally{if(!cancelled)setLoading(false);}};void load();const timer=window.setInterval(()=>void load(),5_000);return()=>{cancelled=true;window.clearInterval(timer);};},[key,vehicle,route,collisionCritical]);
  return{context,loading,error};
}
