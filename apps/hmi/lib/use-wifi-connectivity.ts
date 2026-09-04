'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface WifiNetwork {
  ssid: string;
  signal: number;
  secure: boolean;
  saved?: boolean;
}

interface NativeWifiState {
  enabled: boolean;
  connectedSsid: string | null;
}

interface NativeWifiBridge {
  getState: () => Promise<NativeWifiState>;
  setEnabled: (enabled: boolean) => Promise<NativeWifiState>;
  scan: () => Promise<WifiNetwork[]>;
  connect: (input: { ssid: string; password?: string }) => Promise<NativeWifiState>;
  disconnect: () => Promise<NativeWifiState>;
}

declare global {
  interface Window {
    kingmastNative?: {
      wifi?: NativeWifiBridge;
    };
  }
}

export interface WifiConnectivityController {
  mode: 'native' | 'host-managed';
  enabled: boolean | null;
  connectedSsid: string | null;
  networks: WifiNetwork[];
  online: boolean;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  scan: () => Promise<void>;
  connect: (ssid: string, password?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

function getBridge() {
  if (typeof window === 'undefined') return null;
  const bridge = window.kingmastNative?.wifi;
  if (!bridge || typeof bridge.getState !== 'function' || typeof bridge.setEnabled !== 'function' || typeof bridge.scan !== 'function' || typeof bridge.connect !== 'function' || typeof bridge.disconnect !== 'function') return null;
  return bridge;
}

function normalizeNetworks(items: WifiNetwork[]) {
  return [...items]
    .filter((item) => typeof item.ssid === 'string' && item.ssid.trim().length > 0)
    .map((item) => ({ ...item, ssid: item.ssid.trim(), signal: Math.max(0, Math.min(4, Math.round(item.signal))) }))
    .sort((a, b) => Number(Boolean(b.saved)) - Number(Boolean(a.saved)) || b.signal - a.signal || a.ssid.localeCompare(b.ssid));
}

export function useWifiConnectivity(): WifiConnectivityController {
  const [mode, setMode] = useState<'native' | 'host-managed'>('host-managed');
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [connectedSsid, setConnectedSsid] = useState<string | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setMode('host-managed');
      setEnabledState(null);
      setConnectedSsid(null);
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
      setError(null);
      return;
    }
    setMode('native');
    setBusy(true);
    try {
      const state = await bridge.getState();
      setEnabledState(Boolean(state.enabled));
      setConnectedSsid(state.connectedSsid ?? null);
      setOnline(Boolean(state.connectedSsid));
      setError(null);
    } catch {
      setError('Unable to read Wi-Fi status from the vehicle host.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, [refresh]);

  const setEnabled = useCallback(async (next: boolean) => {
    const bridge = getBridge();
    if (!bridge) {
      setError('Wi-Fi radio control is managed by the host device in this web preview.');
      return;
    }
    setBusy(true);
    try {
      const state = await bridge.setEnabled(next);
      setEnabledState(Boolean(state.enabled));
      setConnectedSsid(state.connectedSsid ?? null);
      setNetworks(next ? networks : []);
      setOnline(Boolean(state.connectedSsid));
      setError(null);
    } catch {
      setError('Unable to change Wi-Fi state.');
    } finally {
      setBusy(false);
    }
  }, [networks]);

  const scan = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError('Network scanning requires the native vehicle Wi-Fi bridge.');
      return;
    }
    if (enabled === false) return;
    setBusy(true);
    try {
      setNetworks(normalizeNetworks(await bridge.scan()));
      setError(null);
    } catch {
      setError('Unable to scan Wi-Fi networks.');
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  const connect = useCallback(async (ssid: string, password?: string) => {
    const bridge = getBridge();
    if (!bridge) {
      setError('Wi-Fi connection requires the native vehicle Wi-Fi bridge.');
      return;
    }
    setBusy(true);
    try {
      const state = await bridge.connect(password ? { ssid, password } : { ssid });
      setEnabledState(Boolean(state.enabled));
      setConnectedSsid(state.connectedSsid ?? null);
      setOnline(Boolean(state.connectedSsid));
      setError(state.connectedSsid ? null : 'Connection did not complete.');
    } catch {
      setError('Unable to connect to this Wi-Fi network. Verify credentials and signal.');
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) return;
    setBusy(true);
    try {
      const state = await bridge.disconnect();
      setEnabledState(Boolean(state.enabled));
      setConnectedSsid(state.connectedSsid ?? null);
      setOnline(Boolean(state.connectedSsid));
      setError(null);
    } catch {
      setError('Unable to disconnect Wi-Fi.');
    } finally {
      setBusy(false);
    }
  }, []);

  return useMemo(() => ({ mode, enabled, connectedSsid, networks, online, busy, error, refresh, setEnabled, scan, connect, disconnect }), [mode, enabled, connectedSsid, networks, online, busy, error, refresh, setEnabled, scan, connect, disconnect]);
}
