'use client';

import { AlertTriangle,Bell,Camera,Check,Map,Route,Settings2,ShieldCheck,Volume2,VolumeX,X } from 'lucide-react';
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

export default function DriverInteractionLayer(props:DriverInteractionLayerProps){
  const[sheet,setSheet]=useState<SheetKind>(null);
  const[acknowledgedCamera,setAcknowledgedCamera]=useState<string|null>(null);
  const sheetRef=useRef<HTMLElement|null>(null);
  const returnFocusRef=useRef<HTMLElement|null>(null);
  const previousRouteActive=useRef(props.routeActive);
  const previousRouteLoading=useRef(props.routeLoading);
  const previousCameraBand=useRef(cameraDistanceBand(props.camera?.distanceM));
  const previousCameraLabel=useRef(props.camera?.label??null);
  const{notice,notify}=useMotionFeedback();
  const{profile}=useDriverProfile();
  const units=profile.units;
  const cameraBand=useMemo(()=>cameraDistanceBand(props.camera?.distanceM),[props.camera?.distanceM]);

  // A sheet is contextual. If its source condition disappears, the sheet disappears too.
  // Never leave a stale "driver alert" open over a safe/zero-alert state.
  useEffect(()=>{
    const staleHazard=sheet==='hazard'&&props.severity==='safe';
    const staleCamera=sheet==='camera'&&!props.camera;
    if(!staleHazard&&!staleCamera)return;
    setSheet(null);
    window.setTimeout(()=>returnFocusRef.current?.focus(),0);
  },[props.camera,props.severity,sheet]);

  // Driver hazards already own the dedicated primary alert surface. Do not mirror
  // severity changes into a second lower toast; that duplicate competes for attention.
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

  function toggleVoice(){
    const enabled=!props.voiceEnabled;
    props.onVoiceChange(enabled);
    notify('neutral',enabled?'Voice guidance on':'Voice guidance off',enabled?'Turn and advisory voice prompts are enabled.':'Visual warnings remain active.');
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
      <button type="button" className={props.voiceEnabled?'isActive':''} onClick={toggleVoice} aria-pressed={props.voiceEnabled} aria-label={props.voiceEnabled?'Turn voice guidance off':'Turn voice guidance on'}>
        {props.voiceEnabled?<Volume2/>:<VolumeX/>}<span>Voice</span>
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

    {sheet?<div className="driverSheetBackdrop" role="presentation" data-sheet-kind={sheet} onMouseDown={(event)=>{if(event.target===event.currentTarget)closeSheet();}}>
      <section ref={sheetRef} className={`driverActionSheet sheet-${sheet} severity-${sheet==='hazard'?props.severity:'caution'}`} role="dialog" aria-modal="true" aria-labelledby="driver-sheet-title" aria-describedby="driver-sheet-description" data-testid="driver-action-sheet">
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
          <button type="button" className="sheetPrimary" data-sheet-primary="true" onClick={closeSheet}><Check/><span><strong>{props.routeActive?'Keep route':'Close'}</strong><small>{props.routeActive?'Return to driving view':'Return to alerts'}</small></span></button>
          {props.routeActive?<button type="button" onClick={()=>{props.onAlternatives();closeSheet();}}><Map/><span><strong>Route options</strong><small>Compare alternatives</small></span></button>:null}
        </div>:<div className="driverSheetActions cameraActions">
          <button type="button" className="sheetPrimary" data-sheet-primary="true" onClick={acknowledgeCamera}><Check/><span><strong>Acknowledge</strong><small>Keep visual context</small></span></button>
          <button type="button" onClick={()=>{props.onNavigate();closeSheet();}}><Map/><span><strong>Open map</strong><small>Show route context</small></span></button>
        </div>}
      </section>
    </div>:null}
  </>;
}