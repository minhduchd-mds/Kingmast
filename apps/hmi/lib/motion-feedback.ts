'use client';

import { useCallback,useEffect,useRef,useState } from 'react';

export type MotionNoticeTone='neutral'|'positive'|'caution'|'critical';
export interface MotionNotice{id:number;tone:MotionNoticeTone;title:string;detail?:string;}

export function cameraDistanceBand(distanceM:number|null|undefined){
  if(distanceM===null||distanceM===undefined||!Number.isFinite(distanceM))return'none' as const;
  if(distanceM<=120)return'immediate' as const;
  if(distanceM<=300)return'300m' as const;
  if(distanceM<=500)return'500m' as const;
  if(distanceM<=1000)return'1km' as const;
  return'far' as const;
}

export function useMotionFeedback(){
  const[notice,setNotice]=useState<MotionNotice|null>(null);
  const timerRef=useRef<number|null>(null);
  const sequenceRef=useRef(0);

  const clear=useCallback(()=>{
    if(timerRef.current!==null){window.clearTimeout(timerRef.current);timerRef.current=null;}
    setNotice(null);
  },[]);

  const notify=useCallback((tone:MotionNoticeTone,title:string,detail?:string,durationMs?:number)=>{
    if(timerRef.current!==null)window.clearTimeout(timerRef.current);
    sequenceRef.current+=1;
    setNotice({id:sequenceRef.current,tone,title,detail});
    const duration=durationMs??(tone==='critical'?3600:2600);
    timerRef.current=window.setTimeout(()=>{setNotice(null);timerRef.current=null;},duration);
  },[]);

  useEffect(()=>()=>{if(timerRef.current!==null)window.clearTimeout(timerRef.current);},[]);
  return{notice,notify,clear};
}
