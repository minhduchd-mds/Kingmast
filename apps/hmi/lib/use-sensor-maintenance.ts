'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type MaintenanceSensorId = 'radar-front' | 'radar-rear' | 'camera-front' | 'gnss-imu';
export type SensorMaintenanceState = 'ready' | 'calibration-required' | 'service-required' | 'unavailable';

export interface SensorMaintenanceRecord {
  id: MaintenanceSensorId;
  label: string;
  state: SensorMaintenanceState;
  lastCalibrationAtMs: number | null;
  replacementDetected: boolean;
  detail: string | null;
}

interface MaintenanceSnapshot { sensors: SensorMaintenanceRecord[]; updatedAtMs: number; }
interface NativeMaintenanceBridge {
  getState: () => Promise<MaintenanceSnapshot>;
  calibrate: (sensorId: MaintenanceSensorId) => Promise<MaintenanceSnapshot>;
  verifyReplacement: (sensorId: MaintenanceSensorId) => Promise<MaintenanceSnapshot>;
}

const EXPECTED: SensorMaintenanceRecord[] = [
  { id:'radar-front', label:'Front radar', state:'unavailable', lastCalibrationAtMs:null, replacementDetected:false, detail:'Vehicle-host status unavailable.' },
  { id:'radar-rear', label:'Rear radar', state:'unavailable', lastCalibrationAtMs:null, replacementDetected:false, detail:'Vehicle-host status unavailable.' },
  { id:'camera-front', label:'Forward camera', state:'unavailable', lastCalibrationAtMs:null, replacementDetected:false, detail:'Vehicle-host status unavailable.' },
  { id:'gnss-imu', label:'GNSS / IMU', state:'unavailable', lastCalibrationAtMs:null, replacementDetected:false, detail:'Vehicle-host status unavailable.' },
];

function bridge(): NativeMaintenanceBridge | null {
  if (typeof window === 'undefined') return null;
  const value = (window as unknown as { kingmastNative?: { maintenance?: NativeMaintenanceBridge } }).kingmastNative?.maintenance;
  return value && typeof value.getState === 'function' && typeof value.calibrate === 'function' && typeof value.verifyReplacement === 'function' ? value : null;
}

export function useSensorMaintenance() {
  const [mode, setMode] = useState<'native'|'host-managed'>('host-managed');
  const [sensors, setSensors] = useState<SensorMaintenanceRecord[]>(EXPECTED);
  const [busySensorId, setBusySensorId] = useState<MaintenanceSensorId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const native = bridge();
    if (!native) { setMode('host-managed'); setSensors(EXPECTED); setError(null); return; }
    setMode('native');
    try { setSensors((await native.getState()).sensors); setError(null); }
    catch { setError('Unable to read sensor maintenance state from the vehicle host.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const calibrate = useCallback(async (sensorId: MaintenanceSensorId) => {
    const native = bridge();
    if (!native) { setError('Calibration requires the native vehicle maintenance service.'); return false; }
    setBusySensorId(sensorId);
    try { setSensors((await native.calibrate(sensorId)).sensors); setError(null); return true; }
    catch { setError('Calibration did not complete. Keep the vehicle parked in the required service environment and retry.'); return false; }
    finally { setBusySensorId(null); }
  }, []);

  const verifyReplacement = useCallback(async (sensorId: MaintenanceSensorId) => {
    const native = bridge();
    if (!native) { setError('Replacement verification requires the native vehicle maintenance service.'); return false; }
    setBusySensorId(sensorId);
    try { setSensors((await native.verifyReplacement(sensorId)).sensors); setError(null); return true; }
    catch { setError('Replacement verification failed. Service inspection is required before calibration.'); return false; }
    finally { setBusySensorId(null); }
  }, []);

  return useMemo(() => ({ mode, sensors, busySensorId, error, refresh, calibrate, verifyReplacement }), [busySensorId, calibrate, error, refresh, sensors, verifyReplacement, mode]);
}
