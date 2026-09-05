import { NextRequest,NextResponse } from 'next/server';
import { issueViewerSession,VIEWER_SESSION_COOKIE,VIEWER_SESSION_TTL_S } from '@kingmast/contracts/viewer-session';

export const runtime='nodejs';

function viewerToken(){return(process.env.KINGMAST_VIEWER_TOKEN??'').trim();}
function cookieDomain(){const value=(process.env.KINGMAST_VIEWER_COOKIE_DOMAIN??'').trim();return value||undefined;}
function sameOrigin(request:NextRequest){
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try{return new URL(origin).host===request.nextUrl.host;}catch{return false;}
}

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({authenticated:false,error:'viewer-session-origin-rejected'},{status:403,headers:{'cache-control':'no-store'}});

  const token=viewerToken();
  const localBench=process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';
  if(!token){
    if(localBench)return NextResponse.json({authenticated:true,mode:'loopback-dev'},{headers:{'cache-control':'no-store'}});
    return NextResponse.json({authenticated:false,error:'viewer-session-unavailable'},{status:503,headers:{'cache-control':'no-store'}});
  }
  if(token.length<16)return NextResponse.json({authenticated:false,error:'viewer-session-misconfigured'},{status:503,headers:{'cache-control':'no-store'}});

  const response=NextResponse.json({authenticated:true,mode:'scoped-viewer-session',expiresInS:VIEWER_SESSION_TTL_S},{headers:{'cache-control':'no-store'}});
  response.cookies.set({
    name:VIEWER_SESSION_COOKIE,
    value:issueViewerSession(token),
    httpOnly:true,
    secure:process.env.NODE_ENV==='production',
    sameSite:'lax',
    path:'/',
    maxAge:VIEWER_SESSION_TTL_S,
    domain:cookieDomain(),
  });
  return response;
}
