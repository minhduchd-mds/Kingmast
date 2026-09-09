'use client';

import { Cable, Camera, CheckCircle2, CircleDashed, Cpu, Gauge, Radar, RefreshCw, Satellite, ScanSearch, ShieldCheck, TriangleAlert, Usb, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeviceHealth, type DeviceHealthRecord } from '../lib/use-device-health';

function DeviceIcon({device}:{device:DeviceHealthRecord}) {
  const Icon = device.category==='computer'?Cpu:device.category==='camera'?Camera:device.id.includes('radar')?Radar:device.id.includes('gnss')?Satellite:device.category==='interface'?Usb:Gauge;
  return <Icon strokeWidth={1.8}/>;
}

function connectionLabel(device:DeviceHealthRecord){
  return device.connection==='connected'?'Connected':device.connection==='disconnected'?'Not connected':device.connection==='initializing'?'Initializing':'Status unavailable';
}
function healthLabel(device:DeviceHealthRecord){
  return device.health==='ready'?'Ready':device.health==='warning'?'Warning':device.health==='fault'?'Fault':device.health==='calibration-required'?'Calibration required':'Unknown';
}
function severityRank(value:string){return value==='critical'?3:value==='warning'?2:1;}

export default function DeviceHealthPanel(){
  const devices=useDeviceHealth();
  const[selectedProfile,setSelectedProfile]=useState<string>('');
  const profileValue=selectedProfile||devices.profileId||'';
  const summary=useMemo(()=>{
    if(devices.mode==='host-managed')return 'Waiting for vehicle host';
    if(devices.counts.faults>0)return `${devices.counts.faults} fault${devices.counts.faults===1?'':'s'}`;
    if(devices.counts.warnings>0)return `${devices.counts.warnings} attention`;
    return `${devices.counts.connected} connected`;
  },[devices.counts,devices.mode]);

  async function applyProfile(){if(!profileValue||profileValue===devices.profileId)return;const ok=await devices.setProfile(profileValue);if(ok)setSelectedProfile('');}

  return <section className="systemCard deviceHealthCard" data-testid="device-health">
    <div className="systemCardHeader"><span><Cable/><span><strong>Hardware & device status</strong><small>Connection, health, fault point and parked-only diagnostics</small></span></span><b className={devices.counts.faults>0?'statusFault':''}>{summary}</b></div>

    {devices.mode==='host-managed'?<div className="systemNotice"><ShieldCheck/><span><strong>Managed by the vehicle host</strong><small>Browser preview cannot claim that hardware is connected or healthy. Connect the native device bridge to show physical status, diagnostics and hardware profiles.</small></span></div>:null}

    <div className="deviceSummaryGrid" aria-label="Device connection summary">
      <div><CheckCircle2/><span><strong>{devices.counts.connected}</strong><small>Connected</small></span></div>
      <div><CircleDashed/><span><strong>{devices.counts.disconnected}</strong><small>Not connected</small></span></div>
      <div className={devices.counts.warnings>0?'hasWarning':''}><TriangleAlert/><span><strong>{devices.counts.warnings}</strong><small>Need attention</small></span></div>
      <div className={devices.counts.faults>0?'hasFault':''}><Wrench/><span><strong>{devices.counts.faults}</strong><small>Faults</small></span></div>
    </div>

    {devices.profiles.length>0?<div className="hardwareProfileRow"><span><Cpu/><span><strong>Hardware profile</strong><small>Select the physical baseline reported by the native host. Applying a profile does not qualify the hardware.</small></span></span><div><select aria-label="Hardware profile" value={profileValue} disabled={!devices.canSetProfile||devices.profileBusy} onChange={(event)=>setSelectedProfile(event.target.value)}>{devices.profiles.map((profile)=><option key={profile.id} value={profile.id}>{profile.label} · {profile.qualificationStatus}</option>)}</select><button type="button" className="systemPrimary" disabled={!devices.canSetProfile||devices.profileBusy||!profileValue||profileValue===devices.profileId} onClick={()=>void applyProfile()}>{devices.profileBusy?<RefreshCw className="isSpinning"/>:<CheckCircle2/>} Apply</button></div></div>:null}

    <div className="deviceHealthList">{devices.devices.map((device)=>{
      const faults=[...device.faults].sort((a,b)=>severityRank(b.severity)-severityRank(a.severity));
      return <article key={device.id} data-testid={`device-row-${device.id}`} className={`deviceHealthRow connection-${device.connection} health-${device.health}`}>
        <div className="deviceHealthTop"><span className="maintenanceGlyph"><DeviceIcon device={device}/></span><span className="deviceHealthIdentity"><strong>{device.label}</strong><small>{device.interfaceLabel??device.category}{device.firmwareVersion?` · FW ${device.firmwareVersion}`:''}</small></span><span className={`connectionBadge state-${device.connection}`}>{connectionLabel(device)}</span><span className={`healthBadge state-${device.health}`}>{healthLabel(device)}</span></div>
        {device.detail?<p className="deviceHealthDetail">{device.detail}</p>:null}
        {faults.length>0?<div className="deviceFaultList" aria-label={`${device.label} faults`}>{faults.map((fault)=><div className={`deviceFaultItem severity-${fault.severity}`} key={`${fault.code}-${fault.layer}`}><TriangleAlert/><span><strong>{fault.summary}</strong><small><b>Fault point:</b> {fault.layer} · {fault.code}{fault.action?` · ${fault.action}`:''}</small></span></div>)}</div>:null}
        <div className="deviceHealthMeta"><span>{device.lastSeenAtMs?`Last seen ${new Date(device.lastSeenAtMs).toLocaleTimeString()}`:'No physical timestamp'}</span>{devices.mode==='native'?<button type="button" disabled={!devices.canDiagnose||devices.busyDeviceId!==null} onClick={()=>void devices.diagnose(device.id)}><ScanSearch/>{devices.busyDeviceId===device.id?'Diagnosing…':'Run diagnostics'}</button>:null}</div>
      </article>;
    })}</div>

    {devices.error?<div className="systemError" role="status"><TriangleAlert/><span>{devices.error}</span></div>:null}
    <div className="deviceHealthFooter"><button type="button" className="systemRefresh" onClick={()=>void devices.refresh()}><RefreshCw/> Refresh device state</button><small>Diagnostics are read-only. KINGMAST does not gain steering, braking, throttle, drivetrain or CAN-write authority.</small></div>
  </section>;
}
