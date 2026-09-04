'use client';

import { Bell, BellOff, Camera, Gauge, Mic, Moon, Route, ShieldCheck, Sun } from 'lucide-react';
import { useState } from 'react';
import type { HmiPreferences } from '../lib/use-hmi-preferences';
import ConnectivitySettings from './ConnectivitySettings';

type Appearance = 'auto' | 'day' | 'night';

interface HmiSettingsPanelProps {
  preferences: HmiPreferences;
  onPreferencesChange: (patch: Partial<HmiPreferences>) => void;
  voiceEnabled: boolean;
  onVoiceChange: (enabled: boolean) => void;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onDone: () => void;
}

function ToggleRow({icon:Icon,label,description,checked,onChange,disabled=false}:{icon:typeof Mic;label:string;description:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean}){
  return <div className={`settingsToggleRow ${disabled?'isDisabled':''}`}><span className="settingsRowIcon"><Icon strokeWidth={1.8}/></span><span className="settingsRowCopy"><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;
}

function Segmented<T extends string>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:Array<{value:T;label:string}>;onChange:(value:T)=>void;disabled?:boolean}){
  return <div className={`settingsSegmented ${disabled?'isDisabled':''}`}><strong>{label}</strong><div role="group" aria-label={label}>{options.map((option)=><button type="button" key={option.value} disabled={disabled} className={value===option.value?'selected':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></div>;
}

export default function HmiSettingsPanel(props:HmiSettingsPanelProps){
  const[confirmAdvisoriesOff,setConfirmAdvisoriesOff]=useState(false);
  function requestAdvisoryChange(enabled:boolean){
    if(enabled){setConfirmAdvisoriesOff(false);props.onPreferencesChange({advisoryAlerts:true});return;}
    setConfirmAdvisoriesOff(true);
  }
  function disableOptionalAdvisories(){
    props.onPreferencesChange({advisoryAlerts:false,cameraAlerts:false,speedCameraWarnings:false});
    setConfirmAdvisoriesOff(false);
  }
  return <div className="viewEnter settingsWorkspace" data-testid="hmi-settings">
    <section className="surface settingsSurface">
      <div className="sectionTitle large"><span><ShieldCheck/> Driver assistance settings</span><b>Parked</b></div>
      <p className="settingsIntro">Keep high-value driving information glanceable. Optional road advisories can be silenced while parked; critical collision and vulnerable-road-user safety warnings stay active.</p>
      <div className="settingsSafetySummary">
        <ToggleRow icon={props.preferences.advisoryAlerts?Bell:BellOff} label="Optional road advisories" description="Camera, speed-camera and connected-road warning interruptions" checked={props.preferences.advisoryAlerts} onChange={requestAdvisoryChange}/>
        <div className="protectedSafetyRow"><span className="settingsRowIcon"><ShieldCheck/></span><span className="settingsRowCopy"><strong>Critical safety warnings</strong><small>Collision and vulnerable-road-user warnings cannot be disabled in KINGMAST.</small></span><b>Always on</b></div>
      </div>
      {confirmAdvisoriesOff?<div className="advisoryConfirm" role="group" aria-label="Confirm turning off optional road advisories"><span><BellOff/><span><strong>Turn off optional road advisories?</strong><small>Camera, speed-camera and connected-road warning interruptions will stop. Critical safety warnings remain active. You can restore advisories at any time while parked.</small></span></span><div><button type="button" onClick={()=>setConfirmAdvisoriesOff(false)}>Keep on</button><button type="button" className="advisoryOffPrimary" onClick={disableOptionalAdvisories}>Turn off advisories</button></div></div>:null}
      <div className="settingsGrid">
        <div className="settingsColumn">
          <ToggleRow icon={Mic} label="Voice guidance" description="Turn-by-turn and advisory voice prompts" checked={props.voiceEnabled} onChange={props.onVoiceChange}/>
          <ToggleRow icon={Camera} label="Camera alerts" description="Route-relevant camera context" checked={props.preferences.cameraAlerts} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({cameraAlerts:checked})}/>
          <ToggleRow icon={Gauge} label="Speed-camera warnings" description="Advisory only · subject to local law" checked={props.preferences.speedCameraWarnings} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({speedCameraWarnings:checked})}/>
          <ToggleRow icon={Route} label="Lane guidance" description="Show route-based lane hints" checked={props.preferences.laneGuidance} onChange={(checked)=>props.onPreferencesChange({laneGuidance:checked})}/>
        </div>
        <div className="settingsColumn settingsControls">
          <div className="settingsControlCard"><Bell/><Segmented label="Alert volume" value={props.preferences.alertVolume} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertVolume:value})}/></div>
          <div className="settingsControlCard"><Sun/><Segmented label="Appearance" value={props.appearance} options={[{value:'auto',label:'Auto'},{value:'day',label:'Day'},{value:'night',label:'Night'}]} onChange={props.onAppearanceChange}/></div>
          <div className="settingsControlCard"><Gauge/><Segmented label="Advisory sensitivity" value={props.preferences.alertSensitivity} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertSensitivity:value})}/></div>
        </div>
      </div>
      <ConnectivitySettings/>
      <div className="settingsFooter"><span><Moon/> Settings are saved locally on this HMI. Wi-Fi credentials are handled only by the native vehicle network service when available.</span><button type="button" className="settingsDone" onClick={props.onDone}>Done</button></div>
    </section>
  </div>;
}
