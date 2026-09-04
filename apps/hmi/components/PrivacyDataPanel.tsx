'use client';

import { Database, History, LockKeyhole, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { usePrivacyControls } from '../lib/use-privacy-controls';

function PrivacySwitch({label,description,checked,onChange}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void}){return <div className="privacyRow"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;}

export default function PrivacyDataPanel(){
  const privacy=usePrivacyControls();
  const[confirmClear,setConfirmClear]=useState(false);
  return <section className="systemCard" data-testid="privacy-data-controls">
    <div className="systemCardHeader"><span><LockKeyhole/><span><strong>Privacy & data controls</strong><small>Data minimization by default · destructive actions require confirmation</small></span></span><b>Local HMI</b></div>
    <div className="privacyGrid">
      <PrivacySwitch label="Retain trip summaries" description="Store trip summary metadata on this HMI for later review." checked={privacy.preferences.retainTripSummaries} onChange={(value)=>privacy.updatePreferences({retainTripSummaries:value})}/>
      <PrivacySwitch label="Location history" description="Allow recent destination and route history to remain on this HMI." checked={privacy.preferences.locationHistory} onChange={(value)=>privacy.updatePreferences({locationHistory:value})}/>
      <PrivacySwitch label="Diagnostic upload" description="Allow diagnostic metadata upload when an authorized backend is configured. Off by default." checked={privacy.preferences.diagnosticUpload} onChange={(value)=>privacy.updatePreferences({diagnosticUpload:value})}/>
    </div>
    <div className="privacyInventory"><div><Database/><span><strong>Stored locally</strong><small>HMI preferences, optional route cache, recent destinations and driver profile.</small></span></div><div><ShieldCheck/><span><strong>Not stored by web UI</strong><small>Wi-Fi passwords and arbitrary firmware packages are not persisted by KINGMAST web UI.</small></span></div><div><UploadCloud/><span><strong>No silent upload</strong><small>Diagnostic upload remains disabled unless the driver enables it and an authorized backend exists.</small></span></div></div>
    <div className="privacyActions"><button type="button" onClick={()=>setConfirmClear(true)}><History/> Clear navigation history</button>{privacy.historyClearedAtMs?<span role="status"><Trash2/> History cleared</span>:null}</div>
    {confirmClear?<div className="privacyConfirm" role="group" aria-label="Confirm clearing navigation history"><Trash2/><span><strong>Clear cached routes and recent destinations?</strong><small>This action cannot be undone. Driver profile, safety preferences and first-run setup remain intact.</small></span><div><button type="button" onClick={()=>setConfirmClear(false)}>Cancel</button><button type="button" className="systemDestructive" onClick={()=>{privacy.clearNavigationHistory();setConfirmClear(false);}}>Clear history</button></div></div>:null}
    <p className="systemFootnote">No cloud account is connected in v0.0.6, so this screen does not pretend to offer account deletion. Account-level deletion must be added only when identity/backend services exist.</p>
  </section>;
}
