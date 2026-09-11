'use client';

import { useEffect,useState } from 'react';
import { fetchNextgenRuntime,type NextgenRuntimeClientSnapshot } from './nextgen-client';

export interface NextgenRuntimeController {
  snapshot:NextgenRuntimeClientSnapshot|null;
  loading:boolean;
  error:string|null;
  updatedAtMs:number|null;
}

export function useNextgenRuntime(enabled=true,intervalMs=2_000):NextgenRuntimeController{
  const[snapshot,setSnapshot]=useState<NextgenRuntimeClientSnapshot|null>(null);
  const[loading,setLoading]=useState(enabled);
  const[error,setError]=useState<string|null>(null);
  const[updatedAtMs,setUpdatedAtMs]=useState<number|null>(null);

  useEffect(()=>{
    if(!enabled){setLoading(false);return;}
    let disposed=false;
    let timer:number|null=null;
    let controller:AbortController|null=null;
    const period=Math.max(1_000,Math.min(30_000,intervalMs));
    const schedule=(delay:number)=>{if(disposed)return;timer=window.setTimeout(load,delay);};
    async function load(){
      if(disposed||controller)return;
      controller=new AbortController();
      try{
        const value=await fetchNextgenRuntime(controller.signal);
        if(!disposed){setSnapshot(value);setError(null);setUpdatedAtMs(Date.now());}
      }catch(cause){
        if(!disposed&&!(cause instanceof DOMException&&cause.name==='AbortError'))setError(cause instanceof Error?cause.message:'nextgen-runtime-unavailable');
      }finally{
        controller=null;
        if(!disposed){setLoading(false);schedule(document.visibilityState==='hidden'?Math.max(period,10_000):period);}
      }
    }
    void load();
    return()=>{disposed=true;if(timer!==null)window.clearTimeout(timer);controller?.abort();controller=null;};
  },[enabled,intervalMs]);

  return{snapshot,loading,error,updatedAtMs};
}
