import { NextResponse } from 'next/server';

export const runtime='nodejs';

const COOKIE_NAME='kingmast_viewer';
const MAX_AGE_S=8*60*60;

function viewerToken(){return(process.env.KINGMAST_VIEWER_TOKEN??'').trim();}
function cookieDomain(){const value=(process.env.KINGMAST_VIEWER_COOKIE_DOMAIN??'').trim();return value||undefined;}

export async function POST(){
  const token=viewerToken();
  const localBench=process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';
  if(!token){
    if(localBench)return NextResponse.json({authenticated:true,mode:'loopback-dev'},{headers:{'cache-control':'no-store'}});
    return NextResponse.json({authenticated:false,error:'viewer-session-unavailable'},{status:503,headers:{'cache-control':'no-store'}});
  }
  if(token.length<16)return NextResponse.json({authenticated:false,error:'viewer-session-misconfigured'},{status:503,headers:{'cache-control':'no-store'}});

  const response=NextResponse.json({authenticated:true,mode:'viewer-session'},{headers:{'cache-control':'no-store'}});
  response.cookies.set({
    name:COOKIE_NAME,
    value:token,
    httpOnly:true,
    secure:process.env.NODE_ENV==='production',
    sameSite:'lax',
    path:'/',
    maxAge:MAX_AGE_S,
    domain:cookieDomain(),
  });
  return response;
}
