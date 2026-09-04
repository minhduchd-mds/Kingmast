'use client';

import { Bell, BellOff, Camera, Gauge, LayoutGrid, LockKeyhole, Mic, Moon, Route, ShieldCheck, SlidersHorizontal, Sun, UserRound, Wifi, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { HmiPreferences } from '../lib/use-hmi-preferences';
import CapabilityCenter from './CapabilityCenter';
import ConnectivitySettings from './ConnectivitySettings';
import DriverProfilePanel from './DriverProfilePanel';
import PrivacyDataPanel from './PrivacyDataPanel';
import SensorMaintenancePanel from './SensorMaintenancePanel';
import SoftwareUpdatePanel from './SoftwareUpdatePanel';

type Appearance = 'auto' | 'day' | 'night';
type SettingsSection='assistance'|'capabilities'|'connectivity'|'vehicle'|'privacy'|'profile';

interface HmiSettingsPanelProps {
  preferences: HmiPreferences;
  onPreferencesChange: (patch: Partial<HmiPreferences>) => void;
  voiceEnabled: boolean;
  onVoiceChange: (enabled: boolean) => void;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onDone: () => void;
}

function ToggleRow({icon:Icon,label,description,checked,onChange,disabled=false}:{icon:typeof Mic;label:string;description:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean}){return <div className={`settingsToggleRow ${disabled?'isDisabled':''}`}><span className="settingsRowIcon"><Icon strokeWidth={1.8}/></span><span className="settingsRowCopy"><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;}
function Segmented<T extends string>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:Array<{value:T;label:string}>;onChange:(value:T)=>void;disabled?:boolean}){return <div className={`settingsSegmented ${disabled?'isDisabled':''}`}><strong>{label}</strong><div role="group" aria-label={label}>{options.map((option)=><button type="button" key={option.value} disabled={disabled} className={value===option.value?'selected':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></div>;}

const sections:Array<{key:SettingsSection;label:string;icon:typeof SlidersHorizontal}>=[{key:'assistance',label:'Assistance',icon:SlidersHorizontal},{key:'capabilities',label:'Capabilities',icon:LayoutGrid},{key:'connectivity',label:'Connectivity',icon:Wifi},{key:'vehicle',label:'Vehicle & updates',icon:Wrench},{key:'privacy',label:'Privacy',icon:LockKeyhole},{key:'profile',label:'Profile',icon:UserRound}];

export default function HmiSettingsPanel(props:HmiSettingsPanelProps){
  const[confirmAdvisoriesOff,setConfirmAdvisoriesOff]=useState(false);const[section,setSection]=useState<SettingsSection>('assistance');
  function requestAdvisoryChange(enabled:boolean){if(enabled){setConfirmAdvisoriesOff(false);props.onPreferencesChange({advisoryAlerts:true});return;}setConfirmAdvisoriesOff(true);}
  function disableOptionalAdvisories(){props.onPreferencesChange({advisoryAlerts:false,cameraAlerts:false,speedCameraWarnings:false});setConfirmAdvisoriesOff(false);}
  return <div className="viewEnter settingsWorkspace" data-testid="hmi-settings"><section className="surface settingsSurface">
    <div className="sectionTitle large"><span><ShieldCheck/> KINGMAST settings</span><b>Parked</b></div>
    <p className="settingsIntro">Driving-critical information stays simple. Setup, capability status, service, privacy and profile changes use parked-only progressive disclosure.</p>
    <div className="settingsSectionTabs" role="tablist" aria-label="Settings sections">{sections.map(({key,label,icon:Icon})=><button key={key} type="button" role="tab" aria-selected={section===key} aria-controls={`settings-panel-${key}`} className={section===key?'selected':''} onClick={()=>setSection(key)}><Icon/><span>{label}</span></button>)}</div>

    {section==='assistance'?<div id="settings-panel-assistance" role="tabpanel" className="settingsSectionPanel">
      <div className="settingsSafetySummary"><ToggleRow icon={props.preferences.advisoryAlerts?Bell:BellOff} label="Optional road advisories" description="Camera, speed-camera and connected-road warning interruptions" checked={props.preferences.advisoryAlerts} onChange={requestAdvisoryChange}/><div className="protectedSafetyRow"><span className="settingsRowIcon"><ShieldCheck/></span><span className="settingsRowCopy"><strong>Critical safety warnings</strong><small>Collision and vulnerable-road-user warnings cannot be disabled in KINGMAST.</small></span><b>Always on</b></div></div>
      {confirmAdvisoriesOff?<div className="advisoryConfirm" role="group" aria-label="Confirm turning off optional road advisories"><span><BellOff/><span><strong>Turn off optional road advisories?</strong><small>Camera, speed-camera and connected-road warning interruptions will stop. Critical safety warnings remain active. You can restore advisories at any time while parked.</small></span></span><div><button type="button" onClick={()=>setConfirmAdvisoriesOff(false)}>Keep on</button><button type="button" className="advisoryOffPrimary" onClick={disableOptionalAdvisories}>Turn off advisories</button></div></div>:null}
      <div className="settingsGrid"><div className="settingsColumn"><ToggleRow icon={Mic} label="Voice guidance" description="Turn-by-turn and advisory voice prompts" checked={props.voiceEnabled} onChange={props.onVoiceChange}/><ToggleRow icon={Camera} label="Camera alerts" description="Route-relevant camera context" checked={props.preferences.cameraAlerts} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({cameraAlerts:checked})}/><ToggleRow icon={Gauge} label="Speed-camera warnings" description="Advisory only · subject to local law" checked={props.preferences.speedCameraWarnings} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({speedCameraWarnings:checked})}/><ToggleRow icon={Route} label="Lane guidance" description="Show route-based lane hints" checked={props.preferences.laneGuidance} onChange={(checked)=>props.onPreferencesChange({laneGuidance:checked})}/></div><div className="settingsColumn settingsControls"><div className="settingsControlCard"><Bell/><Segmented label="Alert volume" value={props.preferences.alertVolume} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertVolume:value})}/></div><div className="settingsControlCard"><Sun/><Segmented label="Appearance" value={props.appearance} options={[{value:'auto',label:'Auto'},{value:'day',label:'Day'},{value:'night',label:'Night'}]} onChange={props.onAppearanceChange}/></div><div className="settingsControlCard"><Gauge/><Segmented label="Advisory sensitivity" value={props.preferences.alertSensitivity} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertSensitivity:value})}/></div></div></div>
    </div>:null}
    {section==='capabilities'?<div id="settings-panel-capabilities" role="tabpanel" className="settingsSectionPanel capabilitySettingsPanel"><CapabilityCenter/></div>:null}
    {section==='connectivity'?<div id="settings-panel-connectivity" role="tabpanel" className="settingsSectionPanel"><ConnectivitySettings/></div>:null}
    {section==='vehicle'?<div id="settings-panel-vehicle" role="tabpanel" className="settingsSectionPanel systemStack"><SensorMaintenancePanel/><SoftwareUpdatePanel/></div>:null}
    {section==='privacy'?<div id="settings-panel-privacy" role="tabpanel" className="settingsSectionPanel"><PrivacyDataPanel/></div>:null}
    {section==='profile'?<div id="settings-panel-profile" role="tabpanel" className="settingsSectionPanel"><DriverProfilePanel/></div>:null}
    <div className="settingsFooter"><span><Moon/> Critical safety authority is unchanged. Service actions require native vehicle-host confirmation and remain parked-only.</span><button type="button" className="settingsDone" onClick={props.onDone}>Done</button></div>
  </section></div>;
}
