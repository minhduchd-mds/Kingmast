'use client';

type ClientBoundary='route'|'global';

function clip(value:unknown,max:number){return typeof value==='string'?value.slice(0,max):'';}

export function reportClientFailure(error:Error&{digest?:string},boundary:ClientBoundary){
  try{
    const payload={
      boundary,
      name:clip(error.name,80),
      message:clip(error.message,800),
      stack:clip(error.stack,5000),
      digest:clip(error.digest,160),
      path:clip(window.location.pathname,300),
      occurredAtMs:Date.now(),
    };
    void fetch('/api/kingmast/client-error',{
      method:'POST',
      headers:{'content-type':'application/json','x-kingmast-client-error':'1'},
      cache:'no-store',
      credentials:'same-origin',
      keepalive:true,
      body:JSON.stringify(payload),
    }).catch(()=>{});
  }catch{}
}
