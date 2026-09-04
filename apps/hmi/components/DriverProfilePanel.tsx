'use client';

import { Accessibility, Contrast, Languages, RotateCcw, Ruler, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDriverProfile } from '../lib/use-driver-profile';

function SwitchRow({label,description,checked,onChange}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void}){return <div className="privacyRow"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;}

export default function DriverProfilePanel(){
  const{profile,updateProfile,restoreDefaults}=useDriverProfile();
  const[draftName,setDraftName]=useState(profile.name);
  useEffect(()=>setDraftName(profile.name),[profile.name]);
  return <section className="systemCard" data-testid="driver-profile-controls">
    <div className="systemCardHeader"><span><UserRound/><span><strong>Driver profile, units & accessibility</strong><small>Preferences restore automatically on startup</small></span></span><b>{profile.name}</b></div>
    <div className="profileGrid">
      <label className="profileField"><span>Driver name</span><input aria-label="Driver name" value={draftName} maxLength={32} onChange={(event)=>setDraftName(event.target.value)} onBlur={()=>updateProfile({name:draftName})}/></label>
      <label className="profileField"><span><Languages/> Locale preference</span><select aria-label="Locale preference" value={profile.locale} onChange={(event)=>updateProfile({locale:event.target.value as 'en-US'|'vi-VN'})}><option value="en-US">English (US)</option><option value="vi-VN">Tiếng Việt</option></select></label>
      <div className="profileSegment"><span><Ruler/> Unit system</span><div role="group" aria-label="Unit system"><button type="button" aria-pressed={profile.units==='metric'} className={profile.units==='metric'?'selected':''} onClick={()=>updateProfile({units:'metric'})}>Metric</button><button type="button" aria-pressed={profile.units==='imperial'} className={profile.units==='imperial'?'selected':''} onClick={()=>updateProfile({units:'imperial'})}>Imperial</button></div><small>The preference is restored now. The prototype keeps safety readouts metric until every driving screen can switch units atomically, avoiding mixed-unit hazards.</small></div>
    </div>
    <div className="accessibilityGrid"><SwitchRow label="Large text" description="Increase supported HMI text scale while preserving primary driving hierarchy." checked={profile.textScale==='large'} onChange={(value)=>updateProfile({textScale:value?'large':'standard'})}/><SwitchRow label="High contrast" description="Increase contrast for supported materials and settings surfaces." checked={profile.contrast==='high'} onChange={(value)=>updateProfile({contrast:value?'high':'system'})}/><SwitchRow label="Reduce motion" description="Override decorative HMI motion with near-instant transitions." checked={profile.motion==='reduced'} onChange={(value)=>updateProfile({motion:value?'reduced':'system'})}/></div>
    <div className="profileRestore"><Accessibility/><span><strong>Accessibility restores before driving interaction</strong><small>Text, contrast and reduced-motion preferences are applied by the root HMI runtime, not only while Settings is open.</small></span><button type="button" onClick={restoreDefaults}><RotateCcw/> Restore defaults</button></div>
    <p className="systemFootnote">Locale preference is persisted for future localized strings. v0.0.6 does not claim full Vietnamese translation coverage yet.</p>
  </section>;
}
