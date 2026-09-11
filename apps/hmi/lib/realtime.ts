'use client';

import { useEffect, useState } from 'react';
import type { EdgeDiagnostics, RealtimeMessage, TelemetryFrame } from '@kingmast/contracts';
import { RealtimeLinkAccumulator,type RealtimeLinkSnapshot } from '@kingmast/contracts/realtime-health';

export type RealtimeState='disabled'|'connecting'|'live'|'stale'|'offline';
export type RealtimeQuality='excellent'|'good'|'degraded'|'none';
type ViewerSessionResult='ready'|'unavailable'|'retryable';

const MAX_REALTIME_PAYLOAD_CHARS=256_000;
const MAX_REALTIME_OBJECTS=256;
const MAX_REALTIME_ALERTS=128;
const MAX_ENVELOPE_AGE_MS=5_000;
const MAX_ENVELOPE_FUTURE_MS=5_000;

export interface KingmastTelemetryEventDetail {
  frame: TelemetryFrame;
  receivedAtMs: number;
  diagnostics: EdgeDiagnostics | null;
}

export interface KingmastRealtimeHealthEventDetail {
  transport:RealtimeLinkSnapshot;
}

function streamUrl():string|null{
  const explicit=process.env.NEXT_PUBLIC_KINGMAST_WS_URL?.trim();
  const api=process.env.NEXT_PUBLIC_KINGMAST_API_URL?.trim();
  const candidate=explicit||(api?`${api.replace(/^http/,'ws').replace(/\/$/,'')}/v3/stream`:null);
  if(!candidate)return null;
  try{
    const url=new URL(candidate);
    if(url.protocol!=='ws:'&&url.protocol!=='wss:')return null;
    if(url.username||url.password)return null;
    return url.toString();
  }catch{return null;}
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

function finiteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}
function objectRecord(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function nullableFiniteNumber(value:unknown){return value===null||finiteNumber(value);}
function validVehicle(value:unknown){
  if(!objectRecord(value))return false;
  const source=value.source;
  return finiteNumber(value.lat)&&finiteNumber(value.lng)&&finiteNumber(value.speedKmh)&&finiteNumber(value.headingDeg)&&finiteNumber(value.accuracyM)&&finiteNumber(value.timestampMs)&&(source==='gnss'||source==='device-gps'||source==='simulator');
}
function validTelemetryFrame(value:unknown):value is TelemetryFrame{
  if(!objectRecord(value)||!Number.isInteger(value.sequence)||Number(value.sequence)<0||!validVehicle(value.vehicle)||!objectRecord(value.sensors))return false;
  if(!Array.isArray(value.objects)||value.objects.length>MAX_REALTIME_OBJECTS)return false;
  if(!Array.isArray(value.alerts)||value.alerts.length>MAX_REALTIME_ALERTS)return false;
  return true;
}
function validDiagnostics(value:unknown):value is EdgeDiagnostics{
  if(!objectRecord(value)||!objectRecord(value.sensorAgesMs))return false;
  if(value.status!=='live'&&value.status!=='degraded'&&value.status!=='offline')return false;
  if(value.deviceId!==null&&typeof value.deviceId!=='string')return false;
  if(value.bootId!==null&&typeof value.bootId!=='string')return false;
  if(!Number.isInteger(value.lastSequence)||!nullableFiniteNumber(value.lastIngressAtMs)||!nullableFiniteNumber(value.lastPublishAtMs))return false;
  if(!Number.isInteger(value.connectedClients)||Number(value.connectedClients)<0||!Number.isInteger(value.rejectedPackets)||Number(value.rejectedPackets)<0)return false;
  const ages=value.sensorAgesMs;
  return nullableFiniteNumber(ages.gnss)&&nullableFiniteNumber(ages.radarFront)&&nullableFiniteNumber(ages.camera);
}
function parseRealtimeMessage(raw:unknown):RealtimeMessage|null{
  if(typeof raw!=='string'||raw.length===0||raw.length>MAX_REALTIME_PAYLOAD_CHARS)return null;
  try{
    const parsed=JSON.parse(raw) as unknown;
    if(!objectRecord(parsed)||!finiteNumber(parsed.receivedAtMs))return null;
    if(parsed.type==='heartbeat'){
      if(!Number.isInteger(parsed.lastSequence)||Number(parsed.lastSequence)<-1||!Number.isInteger(parsed.connectedClients)||Number(parsed.connectedClients)<0)return null;
      return {type:'heartbeat',receivedAtMs:parsed.receivedAtMs,lastSequence:Number(parsed.lastSequence),connectedClients:Number(parsed.connectedClients)};
    }
    if(parsed.type!=='telemetry'||(parsed.source!=='edge'&&parsed.source!=='simulator')||!validTelemetryFrame(parsed.frame))return null;
    if(parsed.diagnostics!==undefined&&!validDiagnostics(parsed.diagnostics))return null;
    const frame=parsed.frame;
    const source=parsed.source==='edge'?'edge':'simulator';
    if(source==='edge'&&frame.vehicle.source!=='gnss')return null;
    if(source==='simulator'&&frame.vehicle.source!=='simulator')return null;
    return {type:'telemetry',source,receivedAtMs:parsed.receivedAtMs,frame,diagnostics:parsed.diagnostics as EdgeDiagnostics|undefined};
  }catch{return null;}
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
    if(!enabled||!targetUrl){setFrame(null);setLastReceivedAt(null);setDiagnostics(null);setState('disabled');setQuality('none');return;}
    let socket:WebSocket|null=null;let disposed=false;let connecting=false;let reconnectMs=800;let sessionUnavailable=false;let retryTimer:number|null=null;
    let telemetryAt:number|null=null;let heartbeatAt:number|null=null;
    const sessionAbort=new AbortController();
    const link=new RealtimeLinkAccumulator();
    const publishTransport=()=>{const snapshot=link.snapshot();setTransport(snapshot);publishRealtimeHealthEvent(snapshot);};
    const invalidateSnapshot=()=>{telemetryAt=null;setFrame(null);setLastReceivedAt(null);setDiagnostics(null);};
    const degrade=(nextState:RealtimeState,nextQuality:RealtimeQuality)=>{invalidateSnapshot();setState(nextState);setQuality(nextQuality);};
    publishTransport();

    const scheduleReconnect=()=>{
      if(disposed||sessionUnavailable||retryTimer!==null)return;
      const jitter=.8+Math.random()*.4;
      retryTimer=window.setTimeout(()=>{retryTimer=null;void connect();},Math.round(reconnectMs*jitter));
      reconnectMs=Math.min(12_000,Math.round(reconnectMs*1.8));
    };
    const connect=async()=>{
      if(disposed||sessionUnavailable||connecting)return;
      if(!navigator.onLine){degrade('offline','none');return;}
      if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
      connecting=true;degrade('connecting','none');link.recordConnectAttempt();publishTransport();
      try{
        const sessionResult=await establishViewerSession(sessionAbort.signal);
        if(disposed)return;
        if(sessionResult==='unavailable'){
          sessionUnavailable=true;degrade('disabled','none');return;
        }
        if(sessionResult==='retryable'){
          degrade('offline','none');scheduleReconnect();return;
        }
        socket=new WebSocket(targetUrl);
        socket.onopen=()=>{reconnectMs=800;heartbeatAt=Date.now();link.recordConnected();publishTransport();};
        socket.onmessage=(event)=>{
          const receivedNow=Date.now();
          const message=parseRealtimeMessage(event.data);
          if(!message||message.receivedAtMs<receivedNow-MAX_ENVELOPE_AGE_MS||message.receivedAtMs>receivedNow+MAX_ENVELOPE_FUTURE_MS){
            link.recordMalformed();publishTransport();degrade('stale','degraded');return;
          }
          heartbeatAt=receivedNow;
          if(message.type==='heartbeat')return;
          const nextDiagnostics=message.diagnostics??null;
          const session=nextDiagnostics?.deviceId&&nextDiagnostics.bootId?`${nextDiagnostics.deviceId}:${nextDiagnostics.bootId}`:message.source;
          const observation=link.observeTelemetry({serverEnvelopeAtMs:message.receivedAtMs,ingressAtMs:nextDiagnostics?.lastIngressAtMs??null,clientAtMs:receivedNow,session,sequence:message.frame.sequence});
          publishTransport();
          if(!observation.accepted){degrade('stale','degraded');return;}
          telemetryAt=receivedNow;
          setFrame(message.frame);setLastReceivedAt(message.receivedAtMs);setDiagnostics(nextDiagnostics);setState('live');setQuality('excellent');
          publishTelemetryEvent({frame:message.frame,receivedAtMs:message.receivedAtMs,diagnostics:nextDiagnostics});
        };
        socket.onerror=()=>{degrade('offline','none');};
        socket.onclose=()=>{socket=null;if(disposed)return;link.recordDisconnect();publishTransport();degrade('offline','none');scheduleReconnect();};
      }catch(error){
        if(!disposed&&(error as Error).name!=='AbortError'){degrade('offline','none');scheduleReconnect();}
      }finally{connecting=false;}
    };

    const onOnline=()=>{if(!sessionUnavailable)void connect();};
    const onOffline=()=>{if(!sessionUnavailable)degrade('offline','none');socket?.close();};
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    void connect();

    const freshnessTimer=window.setInterval(()=>{
      if(sessionUnavailable)return;
      const now=Date.now();const telemetryAge=telemetryAt===null?Number.POSITIVE_INFINITY:now-telemetryAt;const heartbeatAge=heartbeatAt===null?Number.POSITIVE_INFINITY:now-heartbeatAt;
      if(heartbeatAge>5_000){degrade('offline','none');return;}
      if(telemetryAge>2_500){degrade('stale','degraded');return;}
      if(telemetryAge>1_200){setState('live');setQuality('good');return;}
      if(telemetryAge<Number.POSITIVE_INFINITY){setState('live');setQuality('excellent');}
    },500);

    return()=>{disposed=true;sessionAbort.abort();if(retryTimer!==null)window.clearTimeout(retryTimer);window.clearInterval(freshnessTimer);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);socket?.close();};
  },[enabled,targetUrl]);

  return{frame,state,quality,lastReceivedAt,diagnostics,transport,url:targetUrl};
}
