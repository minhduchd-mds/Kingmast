'use client';

import { Cable, Camera, CheckCircle2, CircleDashed, Cpu, Gauge, Radar, RefreshCw, Satellite, ScanSearch, ShieldCheck, TriangleAlert, Usb, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeviceHealth, type DeviceHealthRecord } from '../lib/use-device-health';
import { useI18n } from '../lib/i18n';

function DeviceIcon({device}:{device:DeviceHealthRecord}) {
  const Icon = device.category==='computer'?Cpu:device.category==='camera'?Camera:device.id.includes('radar')?Radar:device.id.includes('gnss')?Satellite:device.category==='interface'?Usb:Gauge;
  return <Icon strokeWidth={1.8}/>;
}
function severityRank(value:string){return value==='critical'?3:value==='warning'?2:1;}

export default function DeviceHealthPanel(){
  const devices=useDeviceHealth();
  const{t}=useI18n();
  const[selectedProfile,setSelectedProfile]=useState<string>('');
  const profileValue=selectedProfile||devices.profileId||'';
  const connectionLabel=(device:DeviceHealthRecord)=>device.connection==='connected'?t('common.connected'):device.connection==='disconnected'?t('common.notConnected'):device.connection==='initializing'?t('common.initializing'):t('device.statusUnavailable');
  const healthLabel=(device:DeviceHealthRecord)=>device.health==='ready'?t('common.ready'):device.health==='warning'?t('common.warning'):device.health==='fault'?t('common.fault'):device.health==='calibration-required'?t('common.calibrationRequired'):t('device.healthUnknown');
  const summary=useMemo(()=>{
    if(devices.mode==='host-managed')return t('device.waitHost');
    if(devices.counts.faults>0)return `${devices.counts.faults} ${t('device.faults').toLocaleLowerCase()}`;
    if(devices.counts.warnings>0)return `${devices.counts.warnings} ${t('device.needAttention').toLocaleLowerCase()}`;
    return `${devices.counts.connected} ${t('device.connected').toLocaleLowerCase()}`;
  },[devices.counts,devices.mode,t]);

  async function applyProfile(){if(!profileValue||profileValue===devices.profileId)return;const ok=await devices.setProfile(profileValue);if(ok)setSelectedProfile('');}

  return <section className="systemCard deviceHealthCard" data-testid="device-health">
    <div className="systemCardHeader"><span><Cable/><span><strong>{t('device.title')}</strong><small>{t('device.subtitle')}</small></span></span><b className={devices.counts.faults>0?'statusFault':''}>{summary}</b></div>

    {devices.mode==='host-managed'?<div className="systemNotice"><ShieldCheck/><span><strong>{t('device.hostManaged')}</strong><small>{t('device.hostManagedDetail')}</small></span></div>:null}

    <div className="deviceSummaryGrid" aria-label={t('device.title')}>
      <div><CheckCircle2/><span><strong>{devices.counts.connected}</strong><small>{t('device.connected')}</small></span></div>
      <div><CircleDashed/><span><strong>{devices.counts.disconnected}</strong><small>{t('device.notConnected')}</small></span></div>
      <div className={devices.counts.warnings>0?'hasWarning':''}><TriangleAlert/><span><strong>{devices.counts.warnings}</strong><small>{t('device.needAttention')}</small></span></div>
      <div className={devices.counts.faults>0?'hasFault':''}><Wrench/><span><strong>{devices.counts.faults}</strong><small>{t('device.faults')}</small></span></div>
    </div>

    {devices.profiles.length>0?<div className="hardwareProfileRow"><span><Cpu/><span><strong>{t('device.profile')}</strong><small>{t('device.profileDetail')}</small></span></span><div><select aria-label={t('device.profile')} value={profileValue} disabled={!devices.canSetProfile||devices.profileBusy} onChange={(event)=>setSelectedProfile(event.target.value)}>{devices.profiles.map((profile)=><option key={profile.id} value={profile.id}>{profile.label} · {profile.qualificationStatus==='pending-physical-evidence'?t('device.profilePending'):profile.qualificationStatus}</option>)}</select><button type="button" className="systemPrimary" disabled={!devices.canSetProfile||devices.profileBusy||!profileValue||profileValue===devices.profileId} onClick={()=>void applyProfile()}>{devices.profileBusy?<RefreshCw className="isSpinning"/>:<CheckCircle2/>} {t('common.apply')}</button></div></div>:null}

    <div className="deviceHealthList">{devices.devices.map((device)=>{
      const faults=[...device.faults].sort((a,b)=>severityRank(b.severity)-severityRank(a.severity));
      return <article key={device.id} data-testid={`device-row-${device.id}`} className={`deviceHealthRow connection-${device.connection} health-${device.health}`}>
        <div className="deviceHealthTop"><span className="maintenanceGlyph"><DeviceIcon device={device}/></span><span className="deviceHealthIdentity"><strong>{device.label}</strong><small>{device.interfaceLabel??device.category}{device.firmwareVersion?` · FW ${device.firmwareVersion}`:''}</small></span><span className={`connectionBadge state-${device.connection}`}>{connectionLabel(device)}</span><span className={`healthBadge state-${device.health}`}>{healthLabel(device)}</span></div>
        {device.detail?<p className="deviceHealthDetail">{device.detail}</p>:null}
        {faults.length>0?<div className="deviceFaultList" aria-label={`${device.label} ${t('device.faults')}`}>{faults.map((fault)=><div className={`deviceFaultItem severity-${fault.severity}`} key={`${fault.code}-${fault.layer}`}><TriangleAlert/><span><strong>{fault.summary}</strong><small><b>{t('device.faultPoint')}:</b> {fault.layer} · {fault.code}{fault.action?` · ${fault.action}`:''}</small></span></div>)}</div>:null}
        <div className="deviceHealthMeta"><span>{device.lastSeenAtMs?t('device.lastSeen',{time:new Date(device.lastSeenAtMs).toLocaleTimeString()}):t('device.noTimestamp')}</span>{devices.mode==='native'?<button type="button" disabled={!devices.canDiagnose||devices.busyDeviceId!==null} onClick={()=>void devices.diagnose(device.id)}><ScanSearch/>{devices.busyDeviceId===device.id?t('device.diagnosing'):t('common.runDiagnostics')}</button>:null}</div>
      </article>;
    })}</div>

    {devices.error?<div className="systemError" role="status"><TriangleAlert/><span>{devices.error}</span></div>:null}
    <div className="deviceHealthFooter"><button type="button" className="systemRefresh" onClick={()=>void devices.refresh()}><RefreshCw/> {t('common.refreshDevice')}</button><small>{t('device.diagnosticsReadonly')}</small></div>
  </section>;
}
