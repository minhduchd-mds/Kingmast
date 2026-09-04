'use client';

import { useCallback,useEffect,useMemo,useState } from 'react';
import type { GeoPoint,NavigationRoute,RoadContext,VehiclePosition } from '@kingmast/contracts';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}
function simulatorFallback(vehicle:VehiclePosition):RoadContext{return{position:{lat:vehicle.lat,lng:vehicle.lng},speedLimit:{currentKmh:50,source:'simulator',confidence:0.35,roadName:'Simulator road',conditional:null,observedAtMs:Date.now()},compliance:vehicle.speedKmh>53?'over-limit':vehicle.speedKmh>=47?'near-limit':'within-limit',cameras:[],fetchedAtMs:Date.now(),coverage:'unavailable',notes:['Simulated speed limit shown because the road-context API is unavailable. No camera locations are simulated.']};}

export function useRoadContext(vehicle:VehiclePosition,radiusM:number){
  const [context,setContext]=useState<RoadContext|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [route,setRoute]=useState<NavigationRoute|null>(null);const [routeLoading,setRouteLoading]=useState(false);
  const key=useMemo(()=>`${vehicle.lat.toFixed(4)}:${vehicle.lng.toFixed(4)}:${Math.round(vehicle.speedKmh/5)}`,[vehicle.lat,vehicle.lng,vehicle.speedKmh]);
  useEffect(()=>{let cancelled=false;const load=async()=>{try{setError(null);const url=`${apiBase()}/v4/road-context?lat=${encodeURIComponent(vehicle.lat)}&lng=${encodeURIComponent(vehicle.lng)}&speedKmh=${encodeURIComponent(vehicle.speedKmh)}&radiusM=${radiusM}`;const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`road-context-${response.status}`);const value=await response.json() as RoadContext;if(!cancelled)setContext(value);}catch(errorValue){if(!cancelled){setError(errorValue instanceof Error?errorValue.message:'road-context-unavailable');setContext(vehicle.source==='simulator'?simulatorFallback(vehicle):null);}}finally{if(!cancelled)setLoading(false);}};void load();const timer=window.setInterval(()=>void load(),10_000);return()=>{cancelled=true;window.clearInterval(timer);};},[key,radiusM,vehicle.lat,vehicle.lng,vehicle.source,vehicle.speedKmh]);
  const navigate=useCallback(async(destination:GeoPoint)=>{setRouteLoading(true);setError(null);try{const response=await fetch(`${apiBase()}/v4/navigation/route`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:{lat:vehicle.lat,lng:vehicle.lng},destination})});if(!response.ok)throw new Error(`navigation-${response.status}`);const value=await response.json() as NavigationRoute;setRoute(value);return value;}catch(errorValue){setError(errorValue instanceof Error?errorValue.message:'navigation-unavailable');return null;}finally{setRouteLoading(false);}},[vehicle.lat,vehicle.lng]);
  return{context,loading,error,route,routeLoading,navigate};
}
