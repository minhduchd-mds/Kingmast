'use client';

import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import type { VehiclePosition } from '@kingmast/contracts';
import type { RoadContextController } from './road-context';
import type { ActiveManeuver,RouteCameraContext } from './driver-context';
import { cameraIsDriverRelevant,cameraLabel,distanceBand,laneHint,maneuverUrgency,routeProgress } from './driver-context';

interface DriverAssistInput {
  vehicle:VehiclePosition;
  road:RoadContextController;
  maneuver:ActiveManeuver|null;
  cameraAhead:RouteCameraContext|null;
  speedLimit:number|null;
  overLimit:boolean;
}

const VOICE_KEY='kingmast:v24:voice';

export function useDriverAssist(input:DriverAssistInput){
  const[voiceEnabled,setVoiceEnabledState]=useState(true);const[rerouting,setRerouting]=useState(false);const deviationCount=useRef(0);const lastRerouteAt=useRef(0);const spoken=useRef(new Map<string,number>());const lastLimit=useRef<number|null>(null);
  const progress=useMemo(()=>routeProgress(input.vehicle,input.road.route),[input.vehicle,input.road.route]);
  const cameraBand=distanceBand(input.cameraAhead?.routeDistanceM??null);const maneuverBand=maneuverUrgency(input.maneuver?.distanceM??null);const lane=laneHint(input.maneuver?.step??null);

  useEffect(()=>{try{const raw=window.localStorage.getItem(VOICE_KEY);if(raw!==null)setVoiceEnabledState(raw!=='off');}catch{}},[]);
  const setVoiceEnabled=useCallback((enabled:boolean)=>{setVoiceEnabledState(enabled);try{window.localStorage.setItem(VOICE_KEY,enabled?'on':'off');}catch{}if(!enabled&&'speechSynthesis'in window)window.speechSynthesis.cancel();},[]);
  const speak=useCallback((key:string,text:string,minGapMs=20_000)=>{if(!voiceEnabled||typeof window==='undefined'||!('speechSynthesis'in window))return;const now=Date.now();const previous=spoken.current.get(key)??0;if(now-previous<minGapMs)return;spoken.current.set(key,now);window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.94;utterance.pitch=1;utterance.volume=.9;window.speechSynthesis.speak(utterance);},[voiceEnabled]);

  useEffect(()=>{if(!input.road.route||!progress||input.vehicle.source==='simulator'){deviationCount.current=0;return;}if(progress.offRouteM>75&&input.vehicle.speedKmh>=5)deviationCount.current+=1;else deviationCount.current=0;if(deviationCount.current<2||Date.now()-lastRerouteAt.current<20_000)return;lastRerouteAt.current=Date.now();deviationCount.current=0;setRerouting(true);speak('reroute','Recalculating route.',5_000);void input.road.reroute().finally(()=>setRerouting(false));},[input.road.route,input.road.reroute,input.vehicle,progress,speak]);

  useEffect(()=>{if(!input.cameraAhead||!cameraBand||!cameraIsDriverRelevant(input.cameraAhead.camera))return;const distanceText=cameraBand==='immediate'?'ahead':cameraBand==='1km'?'in one kilometer':cameraBand==='500m'?'in five hundred meters':'in three hundred meters';speak(`camera:${input.cameraAhead.camera.id}:${cameraBand}`,`${cameraLabel(input.cameraAhead.camera)} ${distanceText}.`,60_000);},[cameraBand,input.cameraAhead,speak]);

  useEffect(()=>{if(!input.maneuver||maneuverBand==='idle'||maneuverBand==='far')return;const distanceText=maneuverBand==='now'?'Now':maneuverBand==='prepare'?'In two hundred meters':'In five hundred meters';speak(`maneuver:${input.maneuver.step.instruction}:${maneuverBand}`,`${distanceText}. ${input.maneuver.step.instruction}.`,30_000);},[input.maneuver,maneuverBand,speak]);

  useEffect(()=>{if(input.speedLimit===null)return;if(lastLimit.current!==null&&lastLimit.current!==input.speedLimit)speak(`limit:${input.speedLimit}`,`Speed limit is now ${input.speedLimit} kilometers per hour.`,8_000);lastLimit.current=input.speedLimit;},[input.speedLimit,speak]);
  useEffect(()=>{if(input.overLimit&&input.speedLimit!==null)speak(`overspeed:${input.speedLimit}`,`Reduce speed. Posted limit ${input.speedLimit} kilometers per hour.`,25_000);},[input.overLimit,input.speedLimit,speak]);

  return{voiceEnabled,setVoiceEnabled,rerouting,progress,cameraBand,maneuverBand,laneHint:lane};
}
