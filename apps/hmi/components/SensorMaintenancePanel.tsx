'use client';

import { Camera, CheckCircle2, Radar, RefreshCw, Satellite, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useSensorMaintenance, type MaintenanceSensorId, type SensorMaintenanceRecord } from '../lib/use-sensor-maintenance';

function SensorIcon({id}:{id:MaintenanceSensorId}) { const Icon=id==='camera-front'?Camera:id==='gnss-imu'?Satellite:Radar; return <Icon strokeWidth={1.8}/>; }
function statusLabel(sensor:SensorMaintenanceRecord){return sensor.state==='ready'?'Ready':sensor.state==='calibration-required'?'Calibration required':sensor.state==='service-required'?'Service required':'Host status unavailable';}

export default function SensorMaintenancePanel(){
  const maintenance=useSensorMaintenance();
  const[pending,setPending]=useState<{sensor:SensorMaintenanceRecord;action:'calibrate'|'replacement'}|null>(null);
  async function confirm(){if(!pending)return;const ok=pending.action==='calibrate'?await maintenance.calibrate(pending.sensor.id):await maintenance.verifyReplacement(pending.sensor.id);if(ok)setPending(null);}
  return <section className="systemCard" data-testid="sensor-maintenance">
    <div className="systemCardHeader"><span><Wrench/><span><strong>Sensor calibration & replacement</strong><small>Parked-only service workflow · no vehicle-control authority</small></span></span><b>{maintenance.mode==='native'?'Vehicle service':'Host managed'}</b></div>
    {maintenance.mode==='host-managed'?<div className="systemNotice"><ShieldCheck/><span><strong>Managed by the vehicle host</strong><small>The browser preview does not claim sensor calibration success. Production hardware must expose the native maintenance bridge and enforce stationary/service prerequisites.</small></span></div>:null}
    <div className="sensorMaintenanceList">{maintenance.sensors.map((sensor)=><div className={`sensorMaintenanceRow state-${sensor.state}`} key={sensor.id}><span className="maintenanceGlyph"><SensorIcon id={sensor.id}/></span><span><strong>{sensor.label}</strong><small>{sensor.detail??(sensor.lastCalibrationAtMs?`Last calibrated ${new Date(sensor.lastCalibrationAtMs).toLocaleDateString()}`:'No calibration timestamp')}</small></span><em>{statusLabel(sensor)}</em>{maintenance.mode==='native'?<div className="maintenanceActions">{sensor.state==='calibration-required'?<button type="button" disabled={maintenance.busySensorId!==null} onClick={()=>setPending({sensor,action:'calibrate'})}>Calibrate</button>:null}<button type="button" disabled={maintenance.busySensorId!==null} onClick={()=>setPending({sensor,action:'replacement'})}>Replacement check</button></div>:null}</div>)}</div>
    {pending?<div className="maintenanceConfirm" role="group" aria-label="Confirm sensor maintenance action"><TriangleAlert/><span><strong>{pending.action==='calibrate'?`Calibrate ${pending.sensor.label}?`:`Verify replacement for ${pending.sensor.label}?`}</strong><small>{pending.action==='calibrate'?'Keep the vehicle parked on the service surface and follow the native host instructions. Calibration completion must come from the vehicle service, not the web UI.':'Use this only after physical service work. Replacement verification does not bypass required calibration or inspection.'}</small></span><div><button type="button" onClick={()=>setPending(null)}>Cancel</button><button type="button" className="systemPrimary" onClick={()=>void confirm()}>{maintenance.busySensorId?<RefreshCw className="isSpinning"/>:<CheckCircle2/>}{pending.action==='calibrate'?'Start calibration':'Verify replacement'}</button></div></div>:null}
    {maintenance.error?<div className="systemError" role="status"><TriangleAlert/><span>{maintenance.error}</span></div>:null}
    <button type="button" className="systemRefresh" onClick={()=>void maintenance.refresh()}><RefreshCw/> Refresh sensor state</button>
  </section>;
}
