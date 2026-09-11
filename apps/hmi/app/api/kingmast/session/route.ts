import { NextRequest,NextResponse } from 'next/server';
import { issueViewerSession,VIEWER_SESSION_COOKIE,VIEWER_SESSION_TTL_S } from '@kingmast/contracts/viewer-session';

export const runtime='nodejs';

const SECURITY_HEADERS={
  'cache-control':'no-store',
  'vary':'origin, sec-fetch-site',
  'cross-origin-resource-policy':'same-origin',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
};

function viewerToken(){return(process.env.KINGMAST_VIEWER_TOKEN??'').trim();}
function cookieDomain(){const value=(process.env.KINGMAST_VIEWER_COOKIE_DOMAIN??'').trim();return value||undefined;}
function localBenchEnabled(){return process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';}
function isLoopbackHost(host:string){const normalized=host.toLowerCase();return normalized==='localhost'||normalized.startsWith('localhost:')||normalized==='127.0.0.1'||normalized.startsWith('127.0.0.1:')||normalized==='[::1]'||normalized.startsWith('[::1]:');}
function sameOrigin(request:NextRequest){
  const origin=request.headers.get('origin');
  if(origin){
    try{return new URL(origin).origin===request.nextUrl.origin;}catch{return false;}
  }
  const fetchSite=request.headers.get('sec-fetch-site');
  if(fetchSite==='same-origin')return true;
  if(localBenchEnabled()&&isLoopbackHost(request.nextUrl.host))return true;
  return false;
}

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({authenticated:false,error:'viewer-session-origin-rejected'},{status:403,headers:SECURITY_HEADERS});

  const token=viewerToken();
  const localBench=localBenchEnabled();
  if(!token){
    if(localBench&&isLoopbackHost(request.nextUrl.host))return NextResponse.json({authenticated:true,mode:'loopback-dev'},{headers:SECURITY_HEADERS});
    return NextResponse.json({authenticated:false,error:'viewer-session-unavailable'},{status:503,headers:SECURITY_HEADERS});
  }
  if(token.length<16)return NextResponse.json({authenticated:false,error:'viewer-session-misconfigured'},{status:503,headers:SECURITY_HEADERS});

  const response=NextResponse.json({authenticated:true,mode:'scoped-viewer-session',expiresInS:VIEWER_SESSION_TTL_S},{headers:SECURITY_HEADERS});
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
