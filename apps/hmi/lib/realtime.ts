'use client';

import { useEffect, useRef, useState } from 'react';
import type { EdgeDiagnostics, RealtimeMessage, TelemetryFrame } from '@kingmast/contracts';

export type RealtimeState='disabled'|'connecting'|'live'|'stale'|'offline';
export type RealtimeQuality='excellent'|'good'|'degraded'|'none';

export interface KingmastTelemetryEventDetail {
  frame: TelemetryFrame;
  receivedAtMs: number;
  diagnostics: EdgeDiagnostics | null;
}

function streamUrl():string|null{
  const explicit=process.env.NEXT_PUBLIC_KINGMAST_WS_URL?.trim();if(explicit)return explicit;
  const api=process.env.NEXT_PUBLIC_KINGMAST_API_URL?.trim();if(api)return`${api.replace(/^http/,'ws').replace(/\/$/,'')}/v3/stream`;
  return null;
}

async function establishViewerSession(signal:AbortSignal){
  const response=await fetch('/api/kingmast/session',{method:'POST',credentials:'include',cache:'no-store',signal});
  return response.ok;
}

function publishTelemetryEvent(detail:KingmastTelemetryEventDetail){
  window.dispatchEvent(new CustomEvent<KingmastTelemetryEventDetail>('kingmast:telemetry',{detail}));
}

export function useRealtimeTelemetry(enabled=true){
  const targetUrl=streamUrl();
  const[frame,setFrame]=useState<TelemetryFrame|null>(null);
  const[state,setState]=useState<RealtimeState>(enabled&&targetUrl?'connecting':'disabled');
  const[quality,setQuality]=useState<RealtimeQuality>('none');
  const[lastReceivedAt,setLastReceivedAt]=useState<number|null>(null);
  const[diagnostics,setDiagnostics]=useState<EdgeDiagnostics|null>(null);
  const retryRef=useRef<number|null>(null);
  const telemetryAtRef=useRef<number|null>(null);
  const heartbeatAtRef=useRef<number|null>(null);
  const sequenceRef=useRef(-1);
  const sessionRef=useRef('');

  useEffect(()=>{
    if(!enabled||!targetUrl){setState('disabled');setQuality('none');return;}
    let socket:WebSocket|null=null;let disposed=false;let connecting=false;let reconnectMs=800;
    const sessionAbort=new AbortController();

    const scheduleReconnect=()=>{
      if(disposed||retryRef.current!==null)return;
      const jitter=.8+Math.random()*.4;
      retryRef.current=window.setTimeout(()=>{retryRef.current=null;void connect();},Math.round(reconnectMs*jitter));
      reconnectMs=Math.min(12_000,Math.round(reconnectMs*1.8));
    };
    const connect=async()=>{
      if(disposed||connecting)return;
      if(!navigator.onLine){setState('offline');setQuality('none');return;}
      if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
      connecting=true;setState('connecting');
      try{
        const sessionReady=await establishViewerSession(sessionAbort.signal);
        if(disposed)return;
        if(!sessionReady){setState('offline');setQuality('none');scheduleReconnect();return;}
        socket=new WebSocket(targetUrl);
        socket.onopen=()=>{reconnectMs=800;heartbeatAtRef.current=Date.now();};
        socket.onmessage=(event)=>{
          try{
            const message=JSON.parse(String(event.data)) as RealtimeMessage;
            const receivedNow=Date.now();heartbeatAtRef.current=receivedNow;
            if(message.type==='heartbeat')return;
            const session=message.diagnostics?.deviceId&&message.diagnostics.bootId?`${message.diagnostics.deviceId}:${message.diagnostics.bootId}`:message.source;
            if(sessionRef.current===session&&message.frame.sequence<sequenceRef.current)return;
            if(sessionRef.current!==session){sessionRef.current=session;sequenceRef.current=-1;}
            sequenceRef.current=Math.max(sequenceRef.current,message.frame.sequence);
            telemetryAtRef.current=receivedNow;
            const nextDiagnostics=message.diagnostics??null;
            setFrame(message.frame);setLastReceivedAt(message.receivedAtMs);setDiagnostics(nextDiagnostics);setState('live');setQuality('excellent');
            publishTelemetryEvent({frame:message.frame,receivedAtMs:message.receivedAtMs,diagnostics:nextDiagnostics});
          }catch{/* malformed edge messages are ignored */}
        };
        socket.onerror=()=>{setState('offline');setQuality('none');};
        socket.onclose=()=>{socket=null;if(disposed)return;setState('offline');setQuality('none');scheduleReconnect();};
      }catch(error){
        if(!disposed&&(error as Error).name!=='AbortError'){setState('offline');setQuality('none');scheduleReconnect();}
      }finally{connecting=false;}
    };

    const onOnline=()=>{void connect();};
    const onOffline=()=>{setState('offline');setQuality('none');socket?.close();};
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    void connect();

    const freshnessTimer=window.setInterval(()=>{
      const now=Date.now();const telemetryAge=telemetryAtRef.current===null?Number.POSITIVE_INFINITY:now-telemetryAtRef.current;const heartbeatAge=heartbeatAtRef.current===null?Number.POSITIVE_INFINITY:now-heartbeatAtRef.current;
      if(heartbeatAge>5_000){setState('offline');setQuality('none');return;}
      if(telemetryAge>2_500){setState('stale');setQuality('degraded');return;}
      if(telemetryAge>1_200){setState('live');setQuality('good');return;}
      if(telemetryAge<Number.POSITIVE_INFINITY){setState('live');setQuality('excellent');}
    },500);

    return()=>{disposed=true;sessionAbort.abort();if(retryRef.current!==null){window.clearTimeout(retryRef.current);retryRef.current=null;}window.clearInterval(freshnessTimer);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);socket?.close();};
  },[enabled,targetUrl]);

  return{frame,state,quality,lastReceivedAt,diagnostics,url:targetUrl};
}
