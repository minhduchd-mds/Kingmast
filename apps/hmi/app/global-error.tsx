'use client';

import { useEffect,useState } from 'react';
import { reportClientFailure } from '../lib/client-error-report';

const RECOVERY_KEY='kingmast:client-recovery-at';
const RECOVERY_WINDOW_MS=60_000;

function recoveryUrl(){
  const url=new URL(window.location.href);
  url.searchParams.set('km-recover',String(Date.now()));
  return url.toString();
}

async function reloadFresh(){
  try{
    if('serviceWorker' in navigator){
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration)=>registration.unregister()));
    }
  }catch{}
  window.location.replace(recoveryUrl());
}

export default function GlobalError({error}:{error:Error&{digest?:string}}){
  const[recovering,setRecovering]=useState(false);

  useEffect(()=>{
    console.error('[KINGMAST] client runtime failure',error);
    reportClientFailure(error,'global');
    try{
      const now=Date.now();const previous=Number(window.sessionStorage.getItem(RECOVERY_KEY)??'0');
      if(!Number.isFinite(previous)||now-previous>RECOVERY_WINDOW_MS){
        window.sessionStorage.setItem(RECOVERY_KEY,String(now));
        setRecovering(true);
        void reloadFresh();
      }
    }catch{}
  },[error]);

  const resetNavigation=()=>{
    try{
      window.localStorage.removeItem('kingmast:v006:route');
      window.localStorage.removeItem('kingmast:v25:route');
      window.localStorage.removeItem('kingmast:v25:recent-places');
    }catch{}
    setRecovering(true);void reloadFresh();
  };

  return <html lang="en"><body style={{margin:0,minHeight:'100vh',display:'grid',placeItems:'center',background:'#090b0e',color:'#f5f7fa',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}><main style={{width:'min(560px,calc(100vw - 40px))',padding:28,border:'1px solid rgba(255,255,255,.12)',borderRadius:22,background:'rgba(25,28,34,.96)',boxShadow:'0 20px 70px rgba(0,0,0,.35)'}}><p style={{margin:'0 0 8px',fontSize:12,letterSpacing:'.12em',textTransform:'uppercase',color:'#8fbfff'}}>KINGMAST recovery</p><h1 style={{margin:'0 0 10px',fontSize:24}}>Driver display is recovering</h1><p style={{margin:'0 0 20px',lineHeight:1.5,color:'#b8bec7'}}>{recovering?'Refreshing the current production bundle…':'The client UI stopped unexpectedly. Live vehicle control is not provided by this HMI.'}</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" onClick={()=>{setRecovering(true);void reloadFresh();}} style={{minHeight:48,padding:'0 18px',border:0,borderRadius:14,background:'#0a84ff',color:'#fff',fontWeight:700,cursor:'pointer'}}>Reload display</button><button type="button" onClick={resetNavigation} style={{minHeight:48,padding:'0 18px',border:'1px solid rgba(255,255,255,.14)',borderRadius:14,background:'rgba(255,255,255,.06)',color:'#f5f7fa',fontWeight:650,cursor:'pointer'}}>Clear route cache & reload</button></div></main></body></html>;
}
