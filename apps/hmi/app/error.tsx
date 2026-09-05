'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('[KINGMAST] HMI render failure',error);},[error]);
  return <main role="alert" style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#090b0e',color:'#f5f7fa',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}><section style={{width:'min(520px,100%)',padding:26,border:'1px solid rgba(255,255,255,.12)',borderRadius:22,background:'rgba(25,28,34,.96)'}}><p style={{margin:'0 0 8px',fontSize:12,letterSpacing:'.12em',textTransform:'uppercase',color:'#8fbfff'}}>KINGMAST</p><h1 style={{margin:'0 0 10px',fontSize:24}}>Driver display unavailable</h1><p style={{margin:'0 0 20px',lineHeight:1.5,color:'#b8bec7'}}>The HMI stopped rendering this view. Warning-only software does not gain vehicle-control authority during recovery.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" onClick={reset} style={{minHeight:48,padding:'0 18px',border:0,borderRadius:14,background:'#0a84ff',color:'#fff',fontWeight:700,cursor:'pointer'}}>Retry view</button><button type="button" onClick={()=>window.location.reload()} style={{minHeight:48,padding:'0 18px',border:'1px solid rgba(255,255,255,.14)',borderRadius:14,background:'rgba(255,255,255,.06)',color:'#f5f7fa',fontWeight:650,cursor:'pointer'}}>Reload display</button></div></section></main>;
}
