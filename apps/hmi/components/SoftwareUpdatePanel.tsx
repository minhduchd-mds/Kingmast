'use client';

import { CheckCircle2, Download, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useSoftwareUpdate } from '../lib/use-software-update';

export default function SoftwareUpdatePanel(){
  const updates=useSoftwareUpdate();
  const[confirm,setConfirm]=useState<'install'|'rollback'|null>(null);
  async function confirmAction(){if(confirm==='install')await updates.install();else if(confirm==='rollback')await updates.rollback();setConfirm(null);}
  const state=updates.state;
  return <section className="systemCard" data-testid="software-update">
    <div className="systemCardHeader"><span><Download/><span><strong>Software & firmware update</strong><small>Signed-package workflow · install and rollback remain parked-only</small></span></span><b>{updates.mode==='native'?state.status.replaceAll('-',' '):'Host managed'}</b></div>
    <div className="updateVersionGrid"><div><small>HMI software</small><strong>v{state.currentVersion}</strong></div><div><small>Vehicle firmware</small><strong>{state.firmwareVersion??'Host reported'}</strong></div><div><small>Update security</small><strong>{state.available?state.available.signed?'Signed package':'Verification required':'No package staged'}</strong></div></div>
    {updates.mode==='host-managed'?<div className="systemNotice"><ShieldCheck/><span><strong>Updates are controlled by the native vehicle host</strong><small>KINGMAST web UI does not fetch arbitrary firmware URLs or flash devices. Package signature, compatibility, stable power, rollback slot and stationary state must be verified by the native updater.</small></span></div>:null}
    {state.available?<div className="updateAvailable"><Download/><span><strong>v{state.available.version} available</strong><small>{state.available.releaseNotes}{state.available.sizeMb?` · ${state.available.sizeMb} MB`:''}</small></span><b>{state.available.signed?'Verified':'Blocked'}</b></div>:null}
    {state.status==='downloading'||state.status==='installing'?<div className="updateProgress" aria-label={`Update progress ${Math.round(state.progressPct)} percent`}><i style={{width:`${Math.max(0,Math.min(100,state.progressPct))}%`}}/><span>{Math.round(state.progressPct)}%</span></div>:null}
    {state.status==='reboot-required'?<div className="systemSuccess"><CheckCircle2/><span><strong>Restart required</strong><small>Complete the update through the vehicle host while parked. KINGMAST will not restart the vehicle controller from this web UI.</small></span></div>:null}
    <div className="systemButtonRow"><button type="button" disabled={updates.busy||updates.mode!=='native'} onClick={()=>void updates.check()}><RefreshCw/> Check for updates</button>{state.available&&state.status==='available'?<button type="button" disabled={updates.busy||!state.available.signed} onClick={()=>void updates.download()}><Download/> Download</button>:null}{state.available&&state.status==='ready'?<button type="button" className="systemPrimary" disabled={updates.busy||!state.available.signed} onClick={()=>setConfirm('install')}><ShieldCheck/> Install signed update</button>:null}{state.rollbackAvailable?<button type="button" disabled={updates.busy} onClick={()=>setConfirm('rollback')}><RotateCcw/> Roll back</button>:null}</div>
    {confirm?<div className="maintenanceConfirm" role="group" aria-label="Confirm software update action"><TriangleAlert/><span><strong>{confirm==='install'?'Install this signed update?':'Roll back to the previous verified slot?'}</strong><small>{confirm==='install'?'Keep the vehicle parked with stable power. The native host remains responsible for signature and compatibility verification and interrupted-update recovery.':'Rollback can change software behavior. Use only a previously verified rollback slot and keep the vehicle parked.'}</small></span><div><button type="button" onClick={()=>setConfirm(null)}>Cancel</button><button type="button" className="systemPrimary" onClick={()=>void confirmAction()}>{confirm==='install'?'Install update':'Confirm rollback'}</button></div></div>:null}
    {updates.error?<div className="systemError" role="status"><TriangleAlert/><span>{updates.error}</span></div>:null}
  </section>;
}
