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

type VoicePriority=1|2|3;

const VOICE_KEY='kingmast:v24:voice';
const GLOBAL_VOICE_GAP_MS=4_500;
const OVERSPEED_CONFIRM_MS=3_500;

export function useDriverAssist(input:DriverAssistInput){
  const[voiceEnabled,setVoiceEnabledState]=useState(true);
  const[rerouting,setRerouting]=useState(false);
  const deviationCount=useRef(0);
  const lastRerouteAt=useRef(0);
  const spoken=useRef(new Map<string,number>());
  const lastLimit=useRef<number|null>(null);
  const lastSpeechAt=useRef(0);
  const activeSpeechPriority=useRef<VoicePriority|0>(0);
  const speechToken=useRef(0);
  const overspeedTimer=useRef<number|null>(null);

  const progress=useMemo(()=>routeProgress(input.vehicle,input.road.route),[input.vehicle,input.road.route]);
  const cameraBand=distanceBand(input.cameraAhead?.routeDistanceM??null);
  const maneuverBand=maneuverUrgency(input.maneuver?.distanceM??null);
  const lane=laneHint(input.maneuver?.step??null);

  useEffect(()=>{
    try{
      const raw=window.localStorage.getItem(VOICE_KEY);
      if(raw!==null)setVoiceEnabledState(raw!=='off');
    }catch{}
  },[]);

  const setVoiceEnabled=useCallback((enabled:boolean)=>{
    setVoiceEnabledState(enabled);
    try{window.localStorage.setItem(VOICE_KEY,enabled?'on':'off');}catch{}
    if(!enabled&&'speechSynthesis'in window){
      speechToken.current+=1;
      activeSpeechPriority.current=0;
      window.speechSynthesis.cancel();
    }
  },[]);

  const speak=useCallback((key:string,text:string,minGapMs=20_000,priority:VoicePriority=1)=>{
    if(!voiceEnabled||typeof window==='undefined'||!('speechSynthesis'in window))return false;
    const now=Date.now();
    const previous=spoken.current.get(key)??0;
    if(now-previous<minGapMs)return false;

    const synthesis=window.speechSynthesis;
    if(now-lastSpeechAt.current<GLOBAL_VOICE_GAP_MS&&priority<3)return false;
    if(synthesis.speaking){
      if(priority<=activeSpeechPriority.current)return false;
      synthesis.cancel();
    }

    spoken.current.set(key,now);
    lastSpeechAt.current=now;
    activeSpeechPriority.current=priority;
    const token=++speechToken.current;
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.rate=.94;
    utterance.pitch=1;
    utterance.volume=.88;
    const release=()=>{if(speechToken.current===token)activeSpeechPriority.current=0;};
    utterance.onend=release;
    utterance.onerror=release;
    synthesis.speak(utterance);
    return true;
  },[voiceEnabled]);

  useEffect(()=>{
    if(!input.road.route||!progress||input.vehicle.source==='simulator'){
      deviationCount.current=0;
      return;
    }
    if(progress.offRouteM>75&&input.vehicle.speedKmh>=5)deviationCount.current+=1;
    else deviationCount.current=0;
    if(deviationCount.current<2||Date.now()-lastRerouteAt.current<20_000)return;
    lastRerouteAt.current=Date.now();
    deviationCount.current=0;
    setRerouting(true);
    speak('reroute','Recalculating route.',8_000,2);
    void input.road.reroute().finally(()=>setRerouting(false));
  },[input.road.route,input.road.reroute,input.vehicle,progress,speak]);

  // Camera notices stay visual until the useful 300 m preparation window.
  // We deliberately avoid speaking every distance band because repeated audio competes with navigation.
  useEffect(()=>{
    if(!input.cameraAhead||cameraBand!=='300m'||!cameraIsDriverRelevant(input.cameraAhead.camera))return;
    speak(`camera:${input.cameraAhead.camera.id}`,
      `${cameraLabel(input.cameraAhead.camera)} in three hundred meters.`,
      120_000,
      1,
    );
  },[cameraBand,input.cameraAhead,speak]);

  // Navigation speech is limited to prepare/now. The visual maneuver banner owns the farther bands.
  useEffect(()=>{
    if(!input.maneuver||!['prepare','now'].includes(maneuverBand))return;
    const now=maneuverBand==='now';
    const distanceText=now?'Now':'In two hundred meters';
    speak(
      `maneuver:${input.maneuver.step.instruction}:${maneuverBand}`,
      `${distanceText}. ${input.maneuver.step.instruction}.`,
      now?12_000:30_000,
      now?3:2,
    );
  },[input.maneuver,maneuverBand,speak]);

  // Limit changes remain glanceable visual information. Avoid narrating every map/sign update.
  useEffect(()=>{lastLimit.current=input.speedLimit;},[input.speedLimit]);

  // Overspeed voice is confirmed after a short persistence window to avoid chatter around the threshold.
  useEffect(()=>{
    if(overspeedTimer.current!==null){window.clearTimeout(overspeedTimer.current);overspeedTimer.current=null;}
    if(!input.overLimit||input.speedLimit===null)return;
    overspeedTimer.current=window.setTimeout(()=>{
      speak(
        `overspeed:${input.speedLimit}`,
        `Reduce speed. Posted limit ${input.speedLimit} kilometers per hour.`,
        45_000,
        2,
      );
      overspeedTimer.current=null;
    },OVERSPEED_CONFIRM_MS);
    return()=>{
      if(overspeedTimer.current!==null){window.clearTimeout(overspeedTimer.current);overspeedTimer.current=null;}
    };
  },[input.overLimit,input.speedLimit,speak]);

  return{voiceEnabled,setVoiceEnabled,rerouting,progress,cameraBand,maneuverBand,laneHint:lane};
}
