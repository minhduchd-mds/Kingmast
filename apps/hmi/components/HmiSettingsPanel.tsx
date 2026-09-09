'use client';

import { Bell, BellOff, Camera, Gauge, LayoutGrid, LockKeyhole, Mic, Moon, Route, ShieldCheck, SlidersHorizontal, Sun, UserRound, Wifi, Wrench } from 'lucide-react';
import { useMemo,useState } from 'react';
import type { HmiPreferences } from '../lib/use-hmi-preferences';
import { useI18n } from '../lib/i18n';
import CapabilityCenter from './CapabilityCenter';
import ConnectivitySettings from './ConnectivitySettings';
import DeviceHealthPanel from './DeviceHealthPanel';
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

export default function HmiSettingsPanel(props:HmiSettingsPanelProps){
  const{t,isVietnamese}=useI18n();const[confirmAdvisoriesOff,setConfirmAdvisoriesOff]=useState(false);const[section,setSection]=useState<SettingsSection>('assistance');
  const sections=useMemo<Array<{key:SettingsSection;label:string;icon:typeof SlidersHorizontal}>>(()=>[{key:'assistance',label:t('settings.assistance'),icon:SlidersHorizontal},{key:'capabilities',label:t('settings.capabilities'),icon:LayoutGrid},{key:'connectivity',label:t('settings.connectivity'),icon:Wifi},{key:'vehicle',label:t('settings.vehicle'),icon:Wrench},{key:'privacy',label:t('settings.privacy'),icon:LockKeyhole},{key:'profile',label:t('settings.profile'),icon:UserRound}],[t]);
  const levels=isVietnamese?{low:'Thấp',medium:'Vừa',high:'Cao',auto:'Tự động',day:'Ngày',night:'Đêm'}:{low:'Low',medium:'Medium',high:'High',auto:'Auto',day:'Day',night:'Night'};
  function requestAdvisoryChange(enabled:boolean){if(enabled){setConfirmAdvisoriesOff(false);props.onPreferencesChange({advisoryAlerts:true});return;}setConfirmAdvisoriesOff(true);}
  function disableOptionalAdvisories(){props.onPreferencesChange({advisoryAlerts:false,cameraAlerts:false,speedCameraWarnings:false});setConfirmAdvisoriesOff(false);}
  return <div className="viewEnter settingsWorkspace" data-testid="hmi-settings"><section className="surface settingsSurface">
    <div className="sectionTitle large"><span><ShieldCheck/> {t('settings.title')}</span><b>{t('common.parked')}</b></div>
    <p className="settingsIntro">{t('settings.intro')}</p>
    <div className="settingsSectionTabs" role="tablist" aria-label={t('settings.title')}>{sections.map(({key,label,icon:Icon})=><button key={key} type="button" role="tab" aria-selected={section===key} aria-controls={`settings-panel-${key}`} className={section===key?'selected':''} onClick={()=>setSection(key)}><Icon/><span>{label}</span></button>)}</div>

    {section==='assistance'?<div id="settings-panel-assistance" role="tabpanel" className="settingsSectionPanel">
      <div className="settingsSafetySummary"><ToggleRow icon={props.preferences.advisoryAlerts?Bell:BellOff} label={t('settings.optionalAdvisories')} description={t('settings.optionalAdvisoriesDetail')} checked={props.preferences.advisoryAlerts} onChange={requestAdvisoryChange}/><div className="protectedSafetyRow"><span className="settingsRowIcon"><ShieldCheck/></span><span className="settingsRowCopy"><strong>{t('settings.criticalWarnings')}</strong><small>{t('settings.criticalWarningsDetail')}</small></span><b>{t('settings.alwaysOn')}</b></div></div>
      {confirmAdvisoriesOff?<div className="advisoryConfirm" role="group" aria-label={isVietnamese?'Xác nhận tắt cảnh báo đường tùy chọn':'Confirm turning off optional road advisories'}><span><BellOff/><span><strong>{isVietnamese?'Tắt cảnh báo đường tùy chọn?':'Turn off optional road advisories?'}</strong><small>{isVietnamese?'Thông báo camera, camera tốc độ và đường kết nối sẽ dừng. Cảnh báo an toàn quan trọng vẫn hoạt động. Có thể bật lại khi xe đang đỗ.':'Camera, speed-camera and connected-road warning interruptions will stop. Critical safety warnings remain active. You can restore advisories at any time while parked.'}</small></span></span><div><button type="button" onClick={()=>setConfirmAdvisoriesOff(false)}>{isVietnamese?'Giữ bật':'Keep on'}</button><button type="button" className="advisoryOffPrimary" onClick={disableOptionalAdvisories}>{isVietnamese?'Tắt cảnh báo tùy chọn':'Turn off advisories'}</button></div></div>:null}
      <div className="settingsGrid"><div className="settingsColumn"><ToggleRow icon={Mic} label={t('settings.voiceGuidance')} description={t('settings.voiceGuidanceDetail')} checked={props.voiceEnabled} onChange={props.onVoiceChange}/><ToggleRow icon={Camera} label={t('settings.cameraAlerts')} description={t('settings.cameraAlertsDetail')} checked={props.preferences.cameraAlerts} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({cameraAlerts:checked})}/><ToggleRow icon={Gauge} label={t('settings.speedCameraWarnings')} description={t('settings.speedCameraWarningsDetail')} checked={props.preferences.speedCameraWarnings} disabled={!props.preferences.advisoryAlerts} onChange={(checked)=>props.onPreferencesChange({speedCameraWarnings:checked})}/><ToggleRow icon={Route} label={t('settings.laneGuidance')} description={t('settings.laneGuidanceDetail')} checked={props.preferences.laneGuidance} onChange={(checked)=>props.onPreferencesChange({laneGuidance:checked})}/></div><div className="settingsColumn settingsControls"><div className="settingsControlCard"><Bell/><Segmented label={t('settings.alertVolume')} value={props.preferences.alertVolume} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:levels.low},{value:'medium',label:levels.medium},{value:'high',label:levels.high}]} onChange={(value)=>props.onPreferencesChange({alertVolume:value})}/></div><div className="settingsControlCard"><Sun/><Segmented label={t('settings.appearance')} value={props.appearance} options={[{value:'auto',label:levels.auto},{value:'day',label:levels.day},{value:'night',label:levels.night}]} onChange={props.onAppearanceChange}/></div><div className="settingsControlCard"><Gauge/><Segmented label={t('settings.sensitivity')} value={props.preferences.alertSensitivity} disabled={!props.preferences.advisoryAlerts} options={[{value:'low',label:levels.low},{value:'medium',label:levels.medium},{value:'high',label:levels.high}]} onChange={(value)=>props.onPreferencesChange({alertSensitivity:value})}/></div></div></div>
    </div>:null}
    {section==='capabilities'?<div id="settings-panel-capabilities" role="tabpanel" className="settingsSectionPanel capabilitySettingsPanel"><CapabilityCenter/></div>:null}
    {section==='connectivity'?<div id="settings-panel-connectivity" role="tabpanel" className="settingsSectionPanel"><ConnectivitySettings/></div>:null}
    {section==='vehicle'?<div id="settings-panel-vehicle" role="tabpanel" className="settingsSectionPanel systemStack"><DeviceHealthPanel/><SensorMaintenancePanel/><SoftwareUpdatePanel/></div>:null}
    {section==='privacy'?<div id="settings-panel-privacy" role="tabpanel" className="settingsSectionPanel"><PrivacyDataPanel/></div>:null}
    {section==='profile'?<div id="settings-panel-profile" role="tabpanel" className="settingsSectionPanel"><DriverProfilePanel/></div>:null}
    <div className="settingsFooter"><span><Moon/> {t('settings.footer')}</span><button type="button" className="settingsDone" onClick={props.onDone}>{t('common.done')}</button></div>
  </section></div>;
}
