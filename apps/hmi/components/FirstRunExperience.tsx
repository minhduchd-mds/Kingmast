'use client';

import { AlertTriangle,CarFront,Check,ChevronRight,LocateFixed,MapPinned,ShieldCheck,Wifi,WifiOff } from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { useHmiPreferences } from '../lib/use-hmi-preferences';

export const FIRST_RUN_STORAGE_KEY='kingmast:v006:first-run-complete';
type LocationState='checking'|'prompt'|'requesting'|'granted'|'denied'|'unavailable';
type Step='welcome'|'location'|'connectivity'|'ready';
const STEPS:Step[]=['welcome','location','connectivity','ready'];

function locationCopy(state:LocationState){
  if(state==='granted')return{title:'Location ready',message:'Navigation can use this device location when you choose device GPS.'};
  if(state==='denied')return{title:'Location not allowed',message:'You can continue. Navigation will stay in simulator or vehicle-GNSS mode until permission changes.'};
  if(state==='unavailable')return{title:'Location unavailable',message:'This host does not expose browser geolocation. Vehicle GNSS can still provide position.'};
  if(state==='requesting')return{title:'Requesting location…',message:'Use the system permission prompt to choose whether KINGMAST may access device location.'};
  return{title:'Location is contextual',message:'KINGMAST requests location only for navigation and route-aware warnings. The first-run flow does not store coordinates.'};
}

export default function FirstRunExperience({onComplete}:{onComplete:()=>void}){
  const[index,setIndex]=useState(0);const[locationState,setLocationState]=useState<LocationState>('checking');const[online,setOnline]=useState(true);const{preferences,updatePreferences}=useHmiPreferences();const[advisories,setAdvisories]=useState(preferences.advisoryAlerts);
  const step=STEPS[index];const location=useMemo(()=>locationCopy(locationState),[locationState]);

  useEffect(()=>{setAdvisories(preferences.advisoryAlerts);},[preferences.advisoryAlerts]);
  useEffect(()=>{
    if(typeof navigator==='undefined'){setLocationState('unavailable');return;}
    setOnline(navigator.onLine);
    const onOnline=()=>setOnline(true);const onOffline=()=>setOnline(false);window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    if(!navigator.geolocation){setLocationState('unavailable');return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};}
    if(!navigator.permissions){setLocationState('prompt');return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};}
    let status:PermissionStatus|null=null;let disposed=false;
    void navigator.permissions.query({name:'geolocation' as PermissionName}).then((next)=>{if(disposed)return;status=next;const sync=()=>setLocationState(next.state==='granted'?'granted':next.state==='denied'?'denied':'prompt');sync();next.onchange=sync;}).catch(()=>{if(!disposed)setLocationState('prompt');});
    return()=>{disposed=true;if(status)status.onchange=null;window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};
  },[]);

  function requestLocation(){
    if(!navigator.geolocation){setLocationState('unavailable');return;}
    setLocationState('requesting');navigator.geolocation.getCurrentPosition(()=>setLocationState('granted'),()=>setLocationState('denied'),{enableHighAccuracy:true,maximumAge:5_000,timeout:12_000});
  }
  function next(){setIndex((value)=>Math.min(STEPS.length-1,value+1));}
  function finish(){updatePreferences({advisoryAlerts:advisories});try{window.localStorage.setItem(FIRST_RUN_STORAGE_KEY,'1');}catch{}onComplete();}

  return <main className="firstRunShell" data-testid="first-run-experience">
    <section className="firstRunHero" aria-hidden="true"><div className="firstRunHorizon"/><div className="firstRunRoad"><i/><i/><i/></div><span className="firstRunVehicle"><CarFront/></span><div className="firstRunBrand"><span><CarFront/></span><strong>KINGMAST</strong><small>Driver safety · v0.0.6</small></div></section>
    <section className="firstRunPanel" aria-labelledby="first-run-title"><div className="firstRunProgress" aria-label={`Setup step ${index+1} of ${STEPS.length}`}>{STEPS.map((item,stepIndex)=><i key={item} className={stepIndex<=index?'isActive':''}/>)}</div>
      {step==='welcome'?<div className="firstRunStep"><span className="firstRunGlyph safe"><ShieldCheck/></span><p className="eyebrow">Welcome to KINGMAST</p><h1 id="first-run-title">Safety first. Minimal setup.</h1><p>KINGMAST is a warning-only driver assistance system. It does not brake, steer, accelerate, or write vehicle-control CAN commands.</p><div className="firstRunSafety"><AlertTriangle/><span><strong>Critical collision and vulnerable-road-user warnings always stay active.</strong><small>Optional road, camera and connected-road advisories can be changed later while parked.</small></span></div><button className="firstRunPrimary" type="button" onClick={next}>Continue <ChevronRight/></button></div>:null}
      {step==='location'?<div className="firstRunStep"><span className={`firstRunGlyph ${locationState==='granted'?'safe':''}`}><LocateFixed/></span><p className="eyebrow">Location</p><h1 id="first-run-title">{location.title}</h1><p>{location.message}</p><div className="firstRunPermission"><MapPinned/><span><strong>No coordinate is stored by this setup screen.</strong><small>Trip/event retention remains a separate parked-mode privacy choice.</small></span></div><div className="firstRunActions">{locationState!=='granted'&&locationState!=='unavailable'?<button type="button" className="firstRunSecondary" disabled={locationState==='requesting'} onClick={requestLocation}>{locationState==='requesting'?'Waiting for permission…':'Allow location'}</button>:null}<button type="button" className="firstRunPrimary" onClick={next}>{locationState==='granted'?'Continue':'Continue in limited mode'} <ChevronRight/></button></div></div>:null}
      {step==='connectivity'?<div className="firstRunStep"><span className={`firstRunGlyph ${online?'safe':'caution'}`}>{online?<Wifi/>:<WifiOff/>}</span><p className="eyebrow">Connectivity</p><h1 id="first-run-title">{online?'Host network available':'Offline mode is ready'}</h1><p>{online?'Online map, traffic-camera and connected-road services can be used when providers are available.':'Primary on-vehicle warnings remain available. Online route search and connected-road context pause until connectivity returns.'}</p><div className="firstRunSafety"><ShieldCheck/><span><strong>Safety does not depend on cloud availability.</strong><small>When offline, verify posted signs and direct road conditions. Cached guidance is labeled when used.</small></span></div><button type="button" className="firstRunPrimary" onClick={next}>Continue <ChevronRight/></button></div>:null}
      {step==='ready'?<div className="firstRunStep"><span className="firstRunGlyph safe"><Check/></span><p className="eyebrow">Ready</p><h1 id="first-run-title">Your driving view is configured.</h1><p>Keep essential warnings visible while driving. Detailed network, privacy, history and calibration controls remain parked-only.</p><label className="firstRunToggle"><span><strong>Optional road advisories</strong><small>Camera, speed-camera and connected-road context. Critical safety warnings are unaffected.</small></span><button type="button" role="switch" aria-label="Optional road advisories during first-run setup" aria-checked={advisories} className={`appleSwitch ${advisories?'isOn':''}`} onClick={()=>setAdvisories((value)=>!value)}><span/></button></label><button className="firstRunPrimary" type="button" onClick={finish}>Start KINGMAST <ChevronRight/></button></div>:null}
    </section>
  </main>;
}
