'use client';

import { useEffect, useState } from 'react';
import type { EdgeDiagnostics, RealtimeMessage, TelemetryFrame } from '@kingmast/contracts';
import { RealtimeLinkAccumulator,type RealtimeLinkSnapshot } from '@kingmast/contracts/realtime-health';

export type RealtimeState='disabled'|'connecting'|'live'|'stale'|'offline';
export type RealtimeQuality='excellent'|'good'|'degraded'|'none';
type ViewerSessionResult='ready'|'unavailable'|'retryable';

export interface KingmastTelemetryEventDetail {
  frame: TelemetryFrame;
  receivedAtMs: number;
  diagnostics: EdgeDiagnostics | null;
}

export interface KingmastRealtimeHealthEventDetail {
  transport:RealtimeLinkSnapshot;
}

function streamUrl():string|null{
  const explicit=process.env.NEXT_PUBLIC_KINGMAST_WS_URL?.trim();if(explicit)return explicit;
  const api=process.env.NEXT_PUBLIC_KINGMAST_API_URL?.trim();if(api)return`${api.replace(/^http/,'ws').replace(/\/$/,'')}/v3/stream`;
  return null;
}

async function establishViewerSession(signal:AbortSignal):Promise<ViewerSessionResult>{
  const response=await fetch('/api/kingmast/session',{method:'POST',credentials:'include',cache:'no-store',signal});
  if(response.ok)return'ready';
  if(response.status===401||response.status===403)return'unavailable';
  if(response.status===503){
    try{
      const payload=await response.json() as {error?:string};
      if(payload.error==='viewer-session-unavailable'||payload.error==='viewer-session-misconfigured')return'unavailable';
    }catch{}
  }
  return'retryable';
}

function publishTelemetryEvent(detail:KingmastTelemetryEventDetail){
  window.dispatchEvent(new CustomEvent<KingmastTelemetryEventDetail>('kingmast:telemetry',{detail}));
}
function publishRealtimeHealthEvent(transport:RealtimeLinkSnapshot){
  window.dispatchEvent(new CustomEvent<KingmastRealtimeHealthEventDetail>('kingmast:realtime-health',{detail:{transport}}));
}

export function useRealtimeTelemetry(enabled=true){
  const targetUrl=streamUrl();
  const[frame,setFrame]=useState<TelemetryFrame|null>(null);
  const[state,setState]=useState<RealtimeState>(enabled&&targetUrl?'connecting':'disabled');
  const[quality,setQuality]=useState<RealtimeQuality>('none');
  const[lastReceivedAt,setLastReceivedAt]=useState<number|null>(null);
  const[diagnostics,setDiagnostics]=useState<EdgeDiagnostics|null>(null);
  const[transport,setTransport]=useState<RealtimeLinkSnapshot>(()=>new RealtimeLinkAccumulator().snapshot());

  useEffect(()=>{
    if(!enabled||!targetUrl){setState('disabled');setQuality('none');return;}
    let socket:WebSocket|null=null;let disposed=false;let connecting=false;let reconnectMs=800;let sessionUnavailable=false;let retryTimer:number|null=null;
    let telemetryAt:number|null=null;let heartbeatAt:number|null=null;
    const sessionAbort=new AbortController();
    const link=new RealtimeLinkAccumulator();
    const publishTransport=()=>{const snapshot=link.snapshot();setTransport(snapshot);publishRealtimeHealthEvent(snapshot);};
    publishTransport();

    const scheduleReconnect=()=>{
      if(disposed||sessionUnavailable||retryTimer!==null)return;
      const jitter=.8+Math.random()*.4;
      retryTimer=window.setTimeout(()=>{retryTimer=null;void connect();},Math.round(reconnectMs*jitter));
      reconnectMs=Math.min(12_000,Math.round(reconnectMs*1.8));
    };
    const connect=async()=>{
      if(disposed||sessionUnavailable||connecting)return;
      if(!navigator.onLine){setState('offline');setQuality('none');return;}
      if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
      connecting=true;setState('connecting');link.recordConnectAttempt();publishTransport();
      try{
        const sessionResult=await establishViewerSession(sessionAbort.signal);
        if(disposed)return;
        if(sessionResult==='unavailable'){
          sessionUnavailable=true;setState('disabled');setQuality('none');return;
        }
        if(sessionResult==='retryable'){
          setState('offline');setQuality('none');scheduleReconnect();return;
        }
        socket=new WebSocket(targetUrl);
        socket.onopen=()=>{reconnectMs=800;heartbeatAt=Date.now();link.recordConnected();publishTransport();};
        socket.onmessage=(event)=>{
          try{
            const message=JSON.parse(String(event.data)) as RealtimeMessage;
            const receivedNow=Date.now();heartbeatAt=receivedNow;
            if(message.type==='heartbeat')return;
            const nextDiagnostics=message.diagnostics??null;
            const session=nextDiagnostics?.deviceId&&nextDiagnostics.bootId?`${nextDiagnostics.deviceId}:${nextDiagnostics.bootId}`:message.source;
            const observation=link.observeTelemetry({serverEnvelopeAtMs:message.receivedAtMs,ingressAtMs:nextDiagnostics?.lastIngressAtMs??null,clientAtMs:receivedNow,session,sequence:message.frame.sequence});
            publishTransport();
            if(!observation.accepted)return;
            telemetryAt=receivedNow;
            setFrame(message.frame);setLastReceivedAt(message.receivedAtMs);setDiagnostics(nextDiagnostics);setState('live');setQuality('excellent');
            publishTelemetryEvent({frame:message.frame,receivedAtMs:message.receivedAtMs,diagnostics:nextDiagnostics});
          }catch{link.recordMalformed();publishTransport();}
        };
        socket.onerror=()=>{setState('offline');setQuality('none');};
        socket.onclose=()=>{socket=null;if(disposed)return;link.recordDisconnect();publishTransport();setState('offline');setQuality('none');scheduleReconnect();};
      }catch(error){
        if(!disposed&&(error as Error).name!=='AbortError'){setState('offline');setQuality('none');scheduleReconnect();}
      }finally{connecting=false;}
    };

    const onOnline=()=>{if(!sessionUnavailable)void connect();};
    const onOffline=()=>{if(!sessionUnavailable){setState('offline');setQuality('none');}socket?.close();};
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    void connect();

    const freshnessTimer=window.setInterval(()=>{
      if(sessionUnavailable)return;
      const now=Date.now();const telemetryAge=telemetryAt===null?Number.POSITIVE_INFINITY:now-telemetryAt;const heartbeatAge=heartbeatAt===null?Number.POSITIVE_INFINITY:now-heartbeatAt;
      if(heartbeatAge>5_000){setState('offline');setQuality('none');return;}
      if(telemetryAge>2_500){setState('stale');setQuality('degraded');return;}
      if(telemetryAge>1_200){setState('live');setQuality('good');return;}
      if(telemetryAge<Number.POSITIVE_INFINITY){setState('live');setQuality('excellent');}
    },500);

    return()=>{disposed=true;sessionAbort.abort();if(retryTimer!==null)window.clearTimeout(retryTimer);window.clearInterval(freshnessTimer);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);socket?.close();};
  },[enabled,targetUrl]);

  return{frame,state,quality,lastReceivedAt,diagnostics,transport,url:targetUrl};
}
