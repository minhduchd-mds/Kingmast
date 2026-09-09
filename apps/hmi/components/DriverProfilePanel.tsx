'use client';

import { Accessibility, Contrast, Languages, RotateCcw, Ruler, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDriverProfile } from '../lib/use-driver-profile';
import { useI18n } from '../lib/i18n';

function SwitchRow({label,description,checked,onChange}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void}){return <div className="privacyRow"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;}

export default function DriverProfilePanel(){
  const{profile,updateProfile,restoreDefaults}=useDriverProfile();
  const{t}=useI18n();
  const[draftName,setDraftName]=useState(profile.name);
  useEffect(()=>setDraftName(profile.name),[profile.name]);
  return <section className="systemCard" data-testid="driver-profile-controls">
    <div className="systemCardHeader"><span><UserRound/><span><strong>{t('profile.title')}</strong><small>{t('profile.subtitle')}</small></span></span><b>{profile.name}</b></div>
    <div className="profileGrid">
      <label className="profileField"><span>{t('profile.driverName')}</span><input aria-label={t('profile.driverName')} value={draftName} maxLength={32} onChange={(event)=>setDraftName(event.target.value)} onBlur={()=>updateProfile({name:draftName})}/></label>
      <label className="profileField"><span><Languages/> {t('profile.locale')}</span><select aria-label={t('profile.locale')} value={profile.locale} onChange={(event)=>updateProfile({locale:event.target.value as 'en-US'|'vi-VN'})}><option value="en-US">English (US)</option><option value="vi-VN">Tiếng Việt</option></select></label>
      <div className="profileSegment"><span><Ruler/> {t('profile.units')}</span><div role="group" aria-label={t('profile.units')}><button type="button" aria-pressed={profile.units==='metric'} className={profile.units==='metric'?'selected':''} onClick={()=>updateProfile({units:'metric'})}>{t('profile.metric')}</button><button type="button" aria-pressed={profile.units==='imperial'} className={profile.units==='imperial'?'selected':''} onClick={()=>updateProfile({units:'imperial'})}>{t('profile.imperial')}</button></div><small>{t('profile.unitsDetail')}</small></div>
    </div>
    <div className="accessibilityGrid"><SwitchRow label={t('profile.largeText')} description={t('profile.largeTextDetail')} checked={profile.textScale==='large'} onChange={(value)=>updateProfile({textScale:value?'large':'standard'})}/><SwitchRow label={t('profile.highContrast')} description={t('profile.highContrastDetail')} checked={profile.contrast==='high'} onChange={(value)=>updateProfile({contrast:value?'high':'system'})}/><SwitchRow label={t('profile.reduceMotion')} description={t('profile.reduceMotionDetail')} checked={profile.motion==='reduced'} onChange={(value)=>updateProfile({motion:value?'reduced':'system'})}/></div>
    <div className="profileRestore"><Accessibility/><span><strong>{t('profile.accessibilityRestores')}</strong><small>{t('profile.accessibilityRestoresDetail')}</small></span><button type="button" onClick={restoreDefaults}><RotateCcw/> {t('profile.restoreDefaults')}</button></div>
    <p className="systemFootnote">{t('profile.coverage')}</p>
  </section>;
}
