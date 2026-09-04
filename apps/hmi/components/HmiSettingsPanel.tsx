'use client';

import { Bell, Camera, Gauge, Mic, Moon, Route, ShieldCheck, Sun } from 'lucide-react';
import type { HmiPreferences } from '../lib/use-hmi-preferences';

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

function ToggleRow({icon:Icon,label,description,checked,onChange}:{icon:typeof Mic;label:string;description:string;checked:boolean;onChange:(checked:boolean)=>void}){
  return <div className="settingsToggleRow"><span className="settingsRowIcon"><Icon strokeWidth={1.8}/></span><span className="settingsRowCopy"><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-checked={checked} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;
}

function Segmented<T extends string>({label,value,options,onChange}:{label:string;value:T;options:Array<{value:T;label:string}>;onChange:(value:T)=>void}){
  return <div className="settingsSegmented"><strong>{label}</strong><div role="group" aria-label={label}>{options.map((option)=><button type="button" key={option.value} className={value===option.value?'selected':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></div>;
}

export default function HmiSettingsPanel(props:HmiSettingsPanelProps){
  return <div className="viewEnter settingsWorkspace" data-testid="hmi-settings">
    <section className="surface settingsSurface">
      <div className="sectionTitle large"><span><ShieldCheck/> Driver assistance settings</span><b>Parked</b></div>
      <p className="settingsIntro">Tune advisory presentation while parked. Critical collision and vulnerable-road-user warnings cannot be disabled here.</p>
      <div className="settingsGrid">
        <div className="settingsColumn">
          <ToggleRow icon={Mic} label="Voice guidance" description="Turn-by-turn and advisory voice prompts" checked={props.voiceEnabled} onChange={props.onVoiceChange}/>
          <ToggleRow icon={Camera} label="Camera alerts" description="Route-relevant camera context" checked={props.preferences.cameraAlerts} onChange={(checked)=>props.onPreferencesChange({cameraAlerts:checked})}/>
          <ToggleRow icon={Gauge} label="Speed-camera warnings" description="Advisory only · subject to local law" checked={props.preferences.speedCameraWarnings} onChange={(checked)=>props.onPreferencesChange({speedCameraWarnings:checked})}/>
          <ToggleRow icon={Route} label="Lane guidance" description="Show route-based lane hints" checked={props.preferences.laneGuidance} onChange={(checked)=>props.onPreferencesChange({laneGuidance:checked})}/>
        </div>
        <div className="settingsColumn settingsControls">
          <div className="settingsControlCard"><Bell/><Segmented label="Alert volume" value={props.preferences.alertVolume} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertVolume:value})}/></div>
          <div className="settingsControlCard"><Sun/><Segmented label="Appearance" value={props.appearance} options={[{value:'auto',label:'Auto'},{value:'day',label:'Day'},{value:'night',label:'Night'}]} onChange={props.onAppearanceChange}/></div>
          <div className="settingsControlCard"><Gauge/><Segmented label="Advisory sensitivity" value={props.preferences.alertSensitivity} options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} onChange={(value)=>props.onPreferencesChange({alertSensitivity:value})}/></div>
        </div>
      </div>
      <div className="settingsFooter"><span><Moon/> Settings are saved locally on this HMI.</span><button type="button" className="settingsDone" onClick={props.onDone}>Done</button></div>
    </section>
  </div>;
}
