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
  internetReachable?: boolean;
  captivePortal?: boolean;
}

interface NativeWifiBridge {
  getState: () => Promise<NativeWifiState>;
  setEnabled: (enabled: boolean) => Promise<NativeWifiState>;
  scan: () => Promise<WifiNetwork[]>;
  connect: (input: { ssid: string; password?: string }) => Promise<NativeWifiState>;
  disconnect: () => Promise<NativeWifiState>;
  forget?: (ssid: string) => Promise<NativeWifiState>;
  openCaptivePortal?: () => Promise<void>;
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
  captivePortal: boolean;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  scan: () => Promise<void>;
  connect: (ssid: string, password?: string) => Promise<boolean>;
  reconnect: (ssid: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  forget: (ssid: string) => Promise<void>;
  openCaptivePortal: () => Promise<void>;
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

function stateOnline(state: NativeWifiState) {
  if (typeof state.internetReachable === 'boolean') return state.internetReachable;
  return Boolean(state.connectedSsid) && !state.captivePortal;
}

export function useWifiConnectivity(): WifiConnectivityController {
  const [mode, setMode] = useState<'native' | 'host-managed'>('host-managed');
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [connectedSsid, setConnectedSsid] = useState<string | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [online, setOnline] = useState(true);
  const [captivePortal, setCaptivePortal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyState = useCallback((state: NativeWifiState) => {
    setEnabledState(Boolean(state.enabled));
    setConnectedSsid(state.connectedSsid ?? null);
    setCaptivePortal(Boolean(state.captivePortal));
    setOnline(stateOnline(state));
  }, []);

  const refresh = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setMode('host-managed');
      setEnabledState(null);
      setConnectedSsid(null);
      setCaptivePortal(false);
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
      setError(null);
      return;
    }
    setMode('native');
    setBusy(true);
    try {
      applyState(await bridge.getState());
      setError(null);
    } catch {
      setError('Unable to read Wi-Fi status from the vehicle host.');
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  useEffect(() => {
    void refresh();
    const updateOnline = () => {
      if (getBridge()) void refresh();
      else setOnline(navigator.onLine);
    };
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
      applyState(state);
      setNetworks(next ? networks : []);
      setError(null);
    } catch {
      setError('Unable to change Wi-Fi state.');
    } finally {
      setBusy(false);
    }
  }, [applyState, networks]);

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
      setError('Unable to scan Wi-Fi networks. Move to a stronger signal area and try again.');
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  const connect = useCallback(async (ssid: string, password?: string) => {
    const bridge = getBridge();
    if (!bridge) {
      setError('Wi-Fi connection requires the native vehicle Wi-Fi bridge.');
      return false;
    }
    setBusy(true);
    try {
      const state = await bridge.connect(password ? { ssid, password } : { ssid });
      applyState(state);
      if (!state.connectedSsid) {
        setError('Connection did not complete. Verify the network and try again.');
        return false;
      }
      if (state.captivePortal) {
        setError('Connected to Wi-Fi, but sign-in is required before online services can be used.');
      } else if (!stateOnline(state)) {
        setError('Connected to Wi-Fi, but internet access is unavailable. KINGMAST will use offline behavior.');
      } else setError(null);
      return true;
    } catch {
      setError('Unable to connect to this Wi-Fi network. Verify credentials and signal.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  const reconnect = useCallback(async (ssid: string) => connect(ssid), [connect]);

  const disconnect = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) return;
    setBusy(true);
    try {
      applyState(await bridge.disconnect());
      setError(null);
    } catch {
      setError('Unable to disconnect Wi-Fi.');
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  const forget = useCallback(async (ssid: string) => {
    const bridge = getBridge();
    if (!bridge?.forget) {
      setError('Forget network is not available on this vehicle host.');
      return;
    }
    setBusy(true);
    try {
      applyState(await bridge.forget(ssid));
      setNetworks((items) => items.map((item) => item.ssid === ssid ? { ...item, saved: false } : item));
      setError(null);
    } catch {
      setError('Unable to forget this Wi-Fi network.');
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  const openCaptivePortal = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge?.openCaptivePortal) {
      setError('Network sign-in must be completed on the host device.');
      return;
    }
    try {
      await bridge.openCaptivePortal();
      setError(null);
    } catch {
      setError('Unable to open network sign-in.');
    }
  }, []);

  return useMemo(() => ({ mode, enabled, connectedSsid, networks, online, captivePortal, busy, error, refresh, setEnabled, scan, connect, reconnect, disconnect, forget, openCaptivePortal }), [mode, enabled, connectedSsid, networks, online, captivePortal, busy, error, refresh, setEnabled, scan, connect, reconnect, disconnect, forget, openCaptivePortal]);
}
