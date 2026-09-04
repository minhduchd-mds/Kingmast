'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeTelemetryEnvelope, TelemetryFrame } from '@kingmast/contracts';

export type RealtimeState = 'disabled' | 'connecting' | 'live' | 'stale' | 'offline';

function streamUrl() {
  const explicit = process.env.NEXT_PUBLIC_KINGMAST_WS_URL;
  if (explicit) return explicit;
  const api = process.env.NEXT_PUBLIC_KINGMAST_API_URL;
  if (api) return `${api.replace(/^http/,'ws').replace(/\/$/,'')}/v3/stream`;
  return 'ws://localhost:4000/v3/stream';
}

export function useRealtimeTelemetry(enabled = true) {
  const [frame,setFrame] = useState<TelemetryFrame|null>(null);
  const [state,setState] = useState<RealtimeState>(enabled ? 'connecting' : 'disabled');
  const [lastReceivedAt,setLastReceivedAt] = useState<number|null>(null);
  const retryRef = useRef<number|null>(null);

  useEffect(() => {
    if (!enabled) { setState('disabled'); return; }
    let socket:WebSocket|null = null;
    let disposed = false;
    let reconnectMs = 1000;

    const connect = () => {
      if (disposed) return;
      setState((current)=>current === 'live' ? current : 'connecting');
      socket = new WebSocket(streamUrl());
      socket.onopen = () => { reconnectMs = 1000; };
      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(String(event.data)) as RealtimeTelemetryEnvelope;
          if (envelope.type !== 'telemetry' || !envelope.frame) return;
          setFrame(envelope.frame);
          setLastReceivedAt(envelope.receivedAtMs);
          setState('live');
        } catch { /* ignore malformed edge messages */ }
      };
      socket.onerror = () => setState('offline');
      socket.onclose = () => {
        if (disposed) return;
        setState('offline');
        retryRef.current = window.setTimeout(connect,reconnectMs);
        reconnectMs = Math.min(10_000,reconnectMs*1.8);
      };
    };

    connect();
    const staleTimer = window.setInterval(() => {
      setLastReceivedAt((last) => {
        if (last && Date.now()-last > 2500) setState('stale');
        return last;
      });
    },1000);

    return () => {
      disposed = true;
      if (retryRef.current !== null) window.clearTimeout(retryRef.current);
      window.clearInterval(staleTimer);
      socket?.close();
    };
  },[enabled]);

  return { frame,state,lastReceivedAt,url:streamUrl() };
}
