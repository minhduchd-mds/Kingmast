'use client';

import { useEffect, useRef, useState } from 'react';
import { esp32C3BenchToTelemetryFrame, type Esp32C3BenchPayload } from '../lib/esp32-c3-bench';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';

type LinkState = 'connecting' | 'live' | 'offline' | 'blocked';

export function Esp32C3BenchBridge({ endpoint = 'http://192.168.4.1' }: { endpoint?: string }) {
  const [state, setState] = useState<LinkState>('connecting');
  const [payload, setPayload] = useState<Esp32C3BenchPayload | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (window.location.protocol === 'https:' && endpoint.startsWith('http://')) {
      setState('blocked');
      return;
    }

    let disposed = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 900);
      try {
        const response = await fetch(`${endpoint}/api/telemetry`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`ESP32 telemetry HTTP ${response.status}`);
        const next = (await response.json()) as Esp32C3BenchPayload;
        if (disposed) return;
        sequenceRef.current += 1;
        const frame = esp32C3BenchToTelemetryFrame(next, sequenceRef.current);
        const detail: KingmastTelemetryEventDetail = {
          frame,
          receivedAtMs: Date.now(),
          diagnostics: null,
        };
        window.dispatchEvent(new CustomEvent<KingmastTelemetryEventDetail>('kingmast:telemetry', { detail }));
        setPayload(next);
        setState('live');
      } catch {
        if (!disposed) setState('offline');
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 500);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [endpoint]);

  const stateLabel = state === 'live' ? 'C3 LIVE' : state === 'connecting' ? 'CONNECTING' : state === 'blocked' ? 'HTTPS BLOCKED' : 'C3 OFFLINE';
  const tone = state === 'live' ? '#65e99a' : state === 'connecting' ? '#61aefa' : '#ffbc55';

  return (
    <aside
      data-testid="esp32-c3-bench-bridge"
      style={{
        position: 'fixed',
        zIndex: 9999,
        right: 16,
        top: 16,
        width: 250,
        padding: 14,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,.12)',
        background: 'rgba(8,12,18,.86)',
        backdropFilter: 'blur(18px)',
        color: '#fff',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        boxShadow: '0 12px 38px rgba(0,0,0,.24)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2.2, color: '#8190a3' }}>KINGMAST BENCH</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 7, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>ESP32-C3 Super Mini</strong>
        <span style={{ color: tone, fontSize: 10, fontWeight: 700 }}>{stateLabel}</span>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gap: 5, fontSize: 11, color: '#a9b4c2' }}>
        <span>Endpoint: {endpoint}</span>
        <span>Mode: {payload?.mode ?? '--'}</span>
        <span>Risk: {payload?.risk ?? '--'}</span>
        <span>Distance: {payload?.sensorOnline ? `${payload.distanceM.toFixed(1)} m` : '--'}</span>
        <span>TTC: {payload && payload.ttc > 0 ? `${payload.ttc.toFixed(2)} s` : '--'}</span>
      </div>
      {state === 'blocked' ? (
        <p style={{ margin: '10px 0 0', color: '#ffbc55', fontSize: 10, lineHeight: 1.45 }}>
          Trang HTTPS không được phép đọc HTTP trực tiếp từ ESP32. Chạy HMI local bằng HTTP để bench test.
        </p>
      ) : null}
    </aside>
  );
}
