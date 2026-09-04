'use client';

import { AlertTriangle,Bell,Camera,Check,ChevronRight,Map,Mic,Route,Settings2,ShieldCheck,Volume2,VolumeX,X } from 'lucide-react';
import { useEffect,useMemo,useRef,useState } from 'react';
import type { Severity } from '@kingmast/contracts';
import { cameraDistanceBand,useMotionFeedback } from '../lib/motion-feedback';
import { useDriverProfile } from '../lib/use-driver-profile';
import { formatDistance,speedText } from '../lib/units';

interface CameraActionContext {
  label:string;
  distanceM:number;
  speedLimit:number|null;
}

interface DriverInteractionLayerProps {
  visible:boolean;
  parked:boolean;
  severity:Severity;
  title:string;
  message:string;
  routeActive:boolean;
  routeLoading:boolean;
  camera:CameraActionContext|null;
  voiceEnabled:boolean;
  onVoiceChange:(enabled:boolean)=>void;
  onNavigate:()=>void;
  onAlerts:()=>void;
  onSettings:()=>void;
  onReroute:()=>Promise<unknown>;
  onAlternatives:()=>void;
}

type SheetKind='hazard'|'camera'|null;
const severityRank:Record<Severity,number>={safe:1,caution:2,critical:3};

export default function DriverInteractionLayer(props:DriverInteractionLayerProps){
  const[sheet,setSheet]=useState<SheetKind>(null);
  const[rerouting,setRerouting]=useState(false);
  const[mutedUntilMs,setMutedUntilMs]=useState<number|null>(null);
  const[nowMs,setNowMs]=useState(()=>Date.now());
  const[acknowledgedCamera,setAcknowledgedCamera]=useState<string|null>(null);
  const muteTimer=useRef<number|null>(null);
  const restoreVoice=useRef(false);
  const sheetRef=useRef<HTMLElement|null>(null);
  const returnFocusRef=useRef<HTMLElement|null>(null);
  const previousSeverity=useRef(props.severity);
  const previousRouteActive=useRef(props.routeActive);
  const previousRouteLoading=useRef(props.routeLoading);
  const previousCameraBand=useRef(cameraDistanceBand(props.camera?.distanceM));
  const previousCameraLabel=useRef(props.camera?.label??null);
  const{notice,notify}=useMotionFeedback();
  const{profile}=useDriverProfile();
  const units=profile.units;
  const cameraBand=useMemo(()=>cameraDistanceBand(props.camera?.distanceM),[props.camera?.distanceM]);
  const mutedMinutes=mutedUntilMs?Math.max(0,Math.ceil((mutedUntilMs-nowMs)/60_000)):0;

  useEffect(()=>()=>{if(muteTimer.current!==null)window.clearTimeout(muteTimer.current);},[]);
  useEffect(()=>{
    if(mutedUntilMs===null)return;
    const timer=window.setInterval(()=>setNowMs(Date.now()),15_000);
    return()=>window.clearInterval(timer);
  },[mutedUntilMs]);
  useEffect(()=>{
    if(mutedUntilMs!==null&&nowMs>=mutedUntilMs)setMutedUntilMs(null);
  },[mutedUntilMs,nowMs]);

  useEffect(()=>{
    const previous=previousSeverity.current;
    if(previous===props.severity)return;
    if(severityRank[props.severity]>severityRank[previous]){
      notify(props.severity==='critical'?'critical':'caution',props.title,props.message);
    }else if(props.severity==='safe'){
      notify('positive','Road context clear','Primary advisory returned to normal.');
    }
    previousSeverity.current=props.severity;
  },[notify,props.message,props.severity,props.title]);

  useEffect(()=>{
    const previous=previousRouteActive.current;
    if(previous!==props.routeActive){
      if(props.routeActive)notify('positive','Guidance ready','Route guidance is active.');
      else if(previous)notify('neutral','Route ended','Navigation guidance is no longer active.');
      previousRouteActive.current=props.routeActive;
    }
  },[notify,props.routeActive]);

  useEffect(()=>{
    const previous=previousRouteLoading.current;
    if(previous&&!props.routeLoading&&props.routeActive)notify('positive','Route updated','Guidance has been refreshed.');
    previousRouteLoading.current=props.routeLoading;
  },[notify,props.routeActive,props.routeLoading]);

  useEffect(()=>{
    const label=props.camera?.label??null;
    if(previousCameraLabel.current!==label){
      setAcknowledgedCamera(null);
      previousCameraLabel.current=label;
      previousCameraBand.current=cameraBand;
      return;
    }
    if(!props.camera||cameraBand==='none'||cameraBand==='far'){
      previousCameraBand.current=cameraBand;
      return;
    }
    if(previousCameraBand.current!==cameraBand){
      if(cameraBand==='300m'||cameraBand==='immediate')setAcknowledgedCamera(null);
      notify('caution','Camera warning',`${props.camera.label} · ${formatDistance(props.camera.distanceM,units)} ahead.`);
      previousCameraBand.current=cameraBand;
    }
  },[cameraBand,notify,props.camera,units]);

  useEffect(()=>{
    if(!sheet)return;
    const focusTimer=window.setTimeout(()=>{
      const target=sheetRef.current?.querySelector<HTMLElement>('[data-sheet-primary="true"]')??sheetRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      target?.focus();
    },0);
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        closeSheet();
        return;
      }
      if(event.key!=='Tab'||!sheetRef.current)return;
      const focusable=Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((item)=>item.offsetParent!==null);
      if(focusable.length===0)return;
      const first=focusable[0]!;
      const last=focusable[focusable.length-1]!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',onKeyDown);
    return()=>{window.clearTimeout(focusTimer);document.removeEventListener('keydown',onKeyDown);};
  },[sheet]);

  if(!props.visible)return null;

  function openSheet(kind:Exclude<SheetKind,null>){
    returnFocusRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setSheet(kind);
  }

  function closeSheet(){
    setSheet(null);
    window.setTimeout(()=>returnFocusRef.current?.focus(),0);
  }

  function clearTemporaryMute(){
    if(muteTimer.current!==null){window.clearTimeout(muteTimer.current);muteTimer.current=null;}
    restoreVoice.current=false;
    setMutedUntilMs(null);
  }

  function toggleVoice(){
    clearTemporaryMute();
    const enabled=!props.voiceEnabled;
    props.onVoiceChange(enabled);
    notify('neutral',enabled?'Voice guidance on':'Voice guidance off',enabled?'Turn and advisory voice prompts are enabled.':'Visual warnings remain active.');
  }

  function muteFiveMinutes(){
    clearTemporaryMute();
    restoreVoice.current=props.voiceEnabled;
    props.onVoiceChange(false);
    const until=Date.now()+5*60_000;
    setNowMs(Date.now());
    setMutedUntilMs(until);
    muteTimer.current=window.setTimeout(()=>{
      if(restoreVoice.current)props.onVoiceChange(true);
      restoreVoice.current=false;
      setMutedUntilMs(null);
      muteTimer.current=null;
      notify('neutral','Voice guidance restored','Temporary mute ended.');
    },5*60_000);
    notify('neutral','Voice muted for 5 minutes','Critical visual safety warnings remain active.');
    closeSheet();
  }

  async function reroute(){
    if(!props.routeActive||rerouting)return;
    setRerouting(true);
    notify('neutral','Updating route','Searching for a safer available route.');
    try{
      const result=await props.onReroute();
      if(result===null||result===false){
        notify('caution','Reroute unavailable','Current route remains active.');
        return;
      }
      notify('positive','Route updated','New guidance is ready.');
      closeSheet();
    }catch{
      notify('caution','Reroute unavailable','Current route remains active.');
    }finally{
      setRerouting(false);
    }
  }

  function openAlerts(){
    if(props.severity==='safe')props.onAlerts();
    else openSheet('hazard');
  }

  function acknowledgeCamera(){
    if(!props.camera)return;
    setAcknowledgedCamera(props.camera.label);
    notify('positive','Camera warning acknowledged','Visual route context remains active.');
    closeSheet();
  }

  const cameraAcknowledged=Boolean(props.camera&&acknowledgedCamera===props.camera.label);

  return <>
    <nav className="driverActionDock" aria-label="Driver quick actions" data-testid="driver-action-dock">
      <button type="button" className={props.voiceEnabled?'isActive':''} onClick={toggleVoice} aria-pressed={props.voiceEnabled} aria-label={mutedMinutes>0?`Voice muted, ${mutedMinutes} minutes remaining`:props.voiceEnabled?'Turn voice guidance off':'Turn voice guidance on'}>
        {props.voiceEnabled?<Volume2/>:<VolumeX/>}<span>{mutedMinutes>0?`Muted ${mutedMinutes}m`:'Voice'}</span>
      </button>
      <button type="button" className={cameraAcknowledged?'isAcknowledged':''} disabled={!props.camera} onClick={()=>props.camera&&openSheet('camera')} aria-label={props.camera?`Camera warning, ${props.camera.label}${cameraAcknowledged?', acknowledged':''}`:'No route camera warning'}>
        <Camera/><span>Camera</span>{props.camera&&!cameraAcknowledged?<i/>:null}
      </button>
      <button type="button" className={props.routeLoading?'isBusy':''} aria-busy={props.routeLoading} onClick={props.onNavigate}>
        <Route/><span>{props.routeLoading?'Updating':'Route'}</span>
      </button>
      <button type="button" className={props.severity!=='safe'?`hasAlert severity-${props.severity}`:''} onClick={openAlerts}>
        <Bell/><span>Alerts</span>{props.severity!=='safe'?<i/>:null}
      </button>
      <button type="button" disabled={!props.parked} onClick={props.onSettings} aria-label={props.parked?'Open settings':'Settings available while parked'}>
        <Settings2/><span>More</span>
      </button>
    </nav>

    {notice?<div key={notice.id} className={`interactionToast tone-${notice.tone}`} role={notice.tone==='critical'?'alert':'status'} aria-live={notice.tone==='critical'?'assertive':'polite'} data-testid="interaction-toast">
      {notice.tone==='critical'?<AlertTriangle/>:notice.tone==='positive'?<ShieldCheck/>:<Bell/>}<span><strong>{notice.title}</strong>{notice.detail?<small>{notice.detail}</small>:null}</span>
    </div>:null}

    {sheet?<div className="driverSheetBackdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeSheet();}}>
      <section ref={sheetRef} className={`driverActionSheet sheet-${sheet} severity-${sheet==='hazard'?props.severity:'caution'}`} role="dialog" aria-modal="true" aria-labelledby="driver-sheet-title" aria-describedby="driver-sheet-description" data-testid="driver-action-sheet">
        <div className="driverSheetHandle" aria-hidden="true"/>
        <header>
          <span className="driverSheetIcon">{sheet==='camera'?<Camera/>:<Bell/>}</span>
          <span>
            <small>{sheet==='camera'?'ROUTE CAMERA':'DRIVER ALERT'}</small>
            <strong id="driver-sheet-title">{sheet==='camera'?props.camera?.label:props.title}</strong>
            <em id="driver-sheet-description">{sheet==='camera'&&props.camera?`${formatDistance(props.camera.distanceM,units)} ahead${props.camera.speedLimit!==null?` · limit ${speedText(props.camera.speedLimit,units)}`:''}`:props.message}</em>
          </span>
          <button type="button" className="driverSheetClose" onClick={closeSheet} aria-label="Close action sheet"><X/></button>
        </header>

        {sheet==='hazard'?<div className="driverSheetActions hazardActions">
          <button type="button" className="sheetPrimary" data-sheet-primary="true" onClick={closeSheet}><Check/><span><strong>Keep current route</strong><small>Continue with current guidance</small></span></button>
          <button type="button" onClick={()=>void reroute()} disabled={!props.routeActive||rerouting}><Route/><span><strong>{rerouting?'Rerouting…':'Reroute'}</strong><small>{props.routeActive?'Recalculate around the issue':'No active route'}</small></span></button>
          <button type="button" onClick={()=>{props.onAlternatives();closeSheet();}}><Map/><span><strong>View alternatives</strong><small>Compare route options</small></span></button>
          <button type="button" onClick={muteFiveMinutes}><VolumeX/><span><strong>Mute voice</strong><small>5 minutes</small></span></button>
        </div>:<div className="driverSheetActions cameraActions">
          <button type="button" className="sheetPrimary" data-sheet-primary="true" onClick={acknowledgeCamera}><Check/><span><strong>Acknowledge</strong><small>Keep visual warning active</small></span></button>
          <button type="button" onClick={muteFiveMinutes}><VolumeX/><span><strong>Mute voice</strong><small>5 minutes</small></span></button>
          <button type="button" onClick={()=>{props.onNavigate();closeSheet();}}><Map/><span><strong>Open map</strong><small>Show route context</small></span></button>
        </div>}

        <footer>
          <Mic/><span>Critical collision and vulnerable-road-user warnings remain active regardless of advisory preferences.</span><ChevronRight aria-hidden="true"/>
        </footer>
      </section>
    </div>:null}
  </>;
}
