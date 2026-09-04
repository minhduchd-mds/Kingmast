'use client';

import { useEffect,useRef,useState } from 'react';
import type { ConnectedRoadContext,NavigationRoute,VehiclePosition } from '@kingmast/contracts';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}

export interface ConnectedRoadController{context:ConnectedRoadContext|null;loading:boolean;error:string|null;}

export function useConnectedRoadContext(vehicle:VehiclePosition|null,route:NavigationRoute|null,collisionCritical:boolean,enabled=true):ConnectedRoadController{
  const[context,setContext]=useState<ConnectedRoadContext|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState<string|null>(null);
  const vehicleRef=useRef<VehiclePosition|null>(vehicle);const routeRef=useRef<NavigationRoute|null>(route);const collisionRef=useRef(collisionCritical);
  vehicleRef.current=vehicle;routeRef.current=route;collisionRef.current=collisionCritical;
  const active=vehicle!==null&&enabled;const routeRevision=route?.fetchedAtMs??0;

  useEffect(()=>{
    if(!active){setContext(null);setLoading(false);setError(null);return;}
    let cancelled=false;let inFlight=false;
    const load=async()=>{
      const currentVehicle=vehicleRef.current;if(!currentVehicle||inFlight)return;
      inFlight=true;setLoading(true);
      try{
        const response=await fetch(`${apiBase()}/connected-road/context`,{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({vehicle:currentVehicle,route:routeRef.current,collisionCritical:collisionRef.current})});
        if(!response.ok)throw new Error(`connected-road-${response.status}`);
        const value=await response.json() as ConnectedRoadContext;
        if(!cancelled){setContext(value);setError(null);}
      }catch(errorValue){
        if(!cancelled){setError(errorValue instanceof Error?errorValue.message:'connected-road-unavailable');setContext(null);}
      }finally{inFlight=false;if(!cancelled)setLoading(false);}
    };
    void load();const timer=window.setInterval(()=>void load(),5_000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[active,routeRevision,collisionCritical,enabled]);

  return{context,loading,error};
}
