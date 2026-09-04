'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type UpdateStatus = 'idle'|'checking'|'available'|'downloading'|'ready'|'installing'|'reboot-required'|'error';
export interface AvailableUpdate { version:string; sizeMb:number|null; releaseNotes:string; signed:boolean; }
export interface SoftwareUpdateState {
  currentVersion: string;
  firmwareVersion: string | null;
  status: UpdateStatus;
  progressPct: number;
  available: AvailableUpdate | null;
  rollbackAvailable: boolean;
  detail: string | null;
}

interface NativeUpdateBridge {
  getState: () => Promise<SoftwareUpdateState>;
  check: () => Promise<SoftwareUpdateState>;
  download: () => Promise<SoftwareUpdateState>;
  install: () => Promise<SoftwareUpdateState>;
  rollback: () => Promise<SoftwareUpdateState>;
}

const FALLBACK: SoftwareUpdateState = { currentVersion:'0.0.6', firmwareVersion:null, status:'idle', progressPct:0, available:null, rollbackAvailable:false, detail:null };

function bridge(): NativeUpdateBridge | null {
  if (typeof window === 'undefined') return null;
  const value = (window as unknown as { kingmastNative?: { updates?: NativeUpdateBridge } }).kingmastNative?.updates;
  return value && typeof value.getState === 'function' && typeof value.check === 'function' && typeof value.download === 'function' && typeof value.install === 'function' && typeof value.rollback === 'function' ? value : null;
}

export function useSoftwareUpdate() {
  const [mode, setMode] = useState<'native'|'host-managed'>('host-managed');
  const [state, setState] = useState<SoftwareUpdateState>(FALLBACK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: 'getState'|'check'|'download'|'install'|'rollback') => {
    const native = bridge();
    if (!native) { setMode('host-managed'); setState(FALLBACK); setError(null); return false; }
    setMode('native');
    setBusy(true);
    try {
      const next = await native[action]();
      if (action === 'install' && next.available && !next.available.signed) throw new Error('unsigned-update');
      setState(next); setError(null); return true;
    } catch (value) {
      setError(value instanceof Error && value.message === 'unsigned-update' ? 'Installation blocked because the update package is not verified as signed.' : 'The vehicle update service did not complete this action.');
      return false;
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void run('getState'); }, [run]);

  const install = useCallback(async () => {
    if (!state.available?.signed) { setError('Installation blocked until the vehicle host verifies a signed update package.'); return false; }
    return run('install');
  }, [run, state.available?.signed]);

  return useMemo(() => ({ mode, state, busy, error, refresh:()=>run('getState'), check:()=>run('check'), download:()=>run('download'), install, rollback:()=>run('rollback') }), [busy, error, install, mode, run, state]);
}
