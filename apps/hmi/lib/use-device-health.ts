'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type DeviceConnectionState = 'connected' | 'disconnected' | 'initializing' | 'unavailable';
export type DeviceHealthState = 'ready' | 'warning' | 'fault' | 'calibration-required' | 'unavailable';
export type DeviceFaultLayer = 'power' | 'link' | 'sensor' | 'firmware' | 'calibration' | 'time-sync' | 'thermal' | 'host' | 'unknown';
export type DeviceFaultSeverity = 'info' | 'warning' | 'critical';

export interface DeviceFault {
  code: string;
  layer: DeviceFaultLayer;
  severity: DeviceFaultSeverity;
  summary: string;
  action: string | null;
}

export interface DeviceHealthRecord {
  id: string;
  label: string;
  category: 'computer' | 'sensor' | 'camera' | 'interface' | 'display' | 'other';
  connection: DeviceConnectionState;
  health: DeviceHealthState;
  interfaceLabel: string | null;
  firmwareVersion: string | null;
  lastSeenAtMs: number | null;
  detail: string | null;
  faults: DeviceFault[];
}

export interface HardwareProfile {
  id: string;
  label: string;
  description: string;
  qualificationStatus: 'development' | 'pending-physical-evidence' | 'reviewed-pass' | 'reviewed-fail';
}

interface DeviceHealthSnapshot {
  profileId: string | null;
  profiles: HardwareProfile[];
  devices: DeviceHealthRecord[];
  updatedAtMs: number;
}

interface NativeDeviceBridge {
  getState: () => Promise<DeviceHealthSnapshot>;
  diagnose?: (deviceId: string) => Promise<DeviceHealthSnapshot>;
  setProfile?: (profileId: string) => Promise<DeviceHealthSnapshot>;
  subscribe?: (listener: (snapshot:DeviceHealthSnapshot) => void) => (() => void) | void;
}

const EXPECTED_DEVICES: DeviceHealthRecord[] = [
  { id:'vehicle-computer-aarch64', label:'Vehicle computer', category:'computer', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
  { id:'front-radar', label:'Front radar', category:'sensor', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
  { id:'surround-camera-set', label:'Surround camera set', category:'camera', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
  { id:'dms-camera', label:'Driver monitoring camera', category:'camera', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
  { id:'gnss-imu', label:'GNSS / IMU', category:'sensor', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
  { id:'read-only-can-interface', label:'Read-only CAN interface', category:'interface', connection:'unavailable', health:'unavailable', interfaceLabel:null, firmwareVersion:null, lastSeenAtMs:null, detail:'Vehicle-host status unavailable.', faults:[] },
];

function bridge(): NativeDeviceBridge | null {
  if (typeof window === 'undefined') return null;
  const value = (window as unknown as { kingmastNative?: { devices?: NativeDeviceBridge } }).kingmastNative?.devices;
  return value && typeof value.getState === 'function' ? value : null;
}

function fallbackSnapshot(): DeviceHealthSnapshot {
  return { profileId:null, profiles:[], devices:EXPECTED_DEVICES, updatedAtMs:Date.now() };
}

export function useDeviceHealth() {
  const [mode, setMode] = useState<'native'|'host-managed'>('host-managed');
  const [monitoring, setMonitoring] = useState<'events'|'polling'|'unavailable'>('unavailable');
  const [snapshot, setSnapshot] = useState<DeviceHealthSnapshot>(fallbackSnapshot);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const native = bridge();
    if (!native) { setMode('host-managed'); setMonitoring('unavailable'); setSnapshot(fallbackSnapshot()); setError(null); return; }
    setMode('native');
    try { setSnapshot(await native.getState()); setError(null); }
    catch { setError('Unable to read device state from the vehicle host.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const native=bridge();
    if(!native)return;
    let disposed=false;
    if(typeof native.subscribe==='function'){
      try{
        const unsubscribe=native.subscribe((next)=>{if(disposed)return;setMode('native');setSnapshot(next);setError(null);});
        setMonitoring('events');
        return ()=>{disposed=true;if(typeof unsubscribe==='function')unsubscribe();};
      }catch{
        // Fall through to bounded polling when the host event channel is unavailable.
      }
    }
    setMonitoring('polling');
    const timer=window.setInterval(()=>{
      void native.getState().then((next)=>{if(disposed)return;setMode('native');setSnapshot(next);setError(null);}).catch(()=>{if(!disposed)setError('Live device refresh failed. Manual refresh remains available.');});
    },3000);
    return ()=>{disposed=true;window.clearInterval(timer);};
  },[]);

  const diagnose = useCallback(async (deviceId:string) => {
    const native = bridge();
    if (!native?.diagnose) { setError('Device diagnostics require the native vehicle service.'); return false; }
    setBusyDeviceId(deviceId);
    try { setSnapshot(await native.diagnose(deviceId)); setError(null); return true; }
    catch { setError('Device diagnostics did not complete. Inspect power, harness and host logs before retrying.'); return false; }
    finally { setBusyDeviceId(null); }
  }, []);

  const setProfile = useCallback(async (profileId:string) => {
    const native = bridge();
    if (!native?.setProfile) { setError('Hardware profile changes require the native vehicle service.'); return false; }
    setProfileBusy(true);
    try { setSnapshot(await native.setProfile(profileId)); setError(null); return true; }
    catch { setError('Hardware profile could not be applied. Keep the vehicle parked and verify the selected hardware baseline.'); return false; }
    finally { setProfileBusy(false); }
  }, []);

  const counts = useMemo(() => ({
    connected: snapshot.devices.filter((device)=>device.connection==='connected').length,
    disconnected: snapshot.devices.filter((device)=>device.connection==='disconnected').length,
    faults: snapshot.devices.filter((device)=>device.health==='fault').length,
    warnings: snapshot.devices.filter((device)=>device.health==='warning'||device.health==='calibration-required').length,
  }), [snapshot.devices]);

  return useMemo(() => ({ mode, monitoring, ...snapshot, counts, busyDeviceId, profileBusy, error, refresh, diagnose, setProfile, canDiagnose:typeof bridge()?.diagnose==='function', canSetProfile:typeof bridge()?.setProfile==='function' }), [busyDeviceId, counts, diagnose, error, monitoring, profileBusy, refresh, setProfile, snapshot, mode]);
}
