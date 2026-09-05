import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const realtime=read('lib/realtime.ts');
const telemetry=read('lib/telemetry.ts');
const sessionRoute=read('app/api/kingmast/session/route.ts');
const viewerSession=read('../../packages/contracts/src/viewer-session.ts');
const envExample=read('../../.env.example');
const riskServer=read('../../services/risk-engine/src/server.ts');
const failures=[];
function expect(name,condition){if(!condition)failures.push(name);}

expect('viewer token remains server-only',!envExample.includes('NEXT_PUBLIC_KINGMAST_VIEWER_TOKEN'));
expect('browser session cookie contains a signed scoped token rather than the shared viewer secret',sessionRoute.includes('issueViewerSession(token)')&&sessionRoute.includes('name:VIEWER_SESSION_COOKIE')&&sessionRoute.includes('httpOnly:true')&&!sessionRoute.includes('value:token'));
expect('viewer session is short lived and read-only scoped',viewerSession.includes("VIEWER_SESSION_SCOPE='viewer:read'")&&viewerSession.includes('VIEWER_SESSION_TTL_S=10*60'));
expect('viewer session signature uses HMAC SHA-256 and constant-time verification',viewerSession.includes("createHmac('sha256'")&&viewerSession.includes('timingSafeEqual'));
expect('viewer session exposes verified expiry claims for realtime enforcement',viewerSession.includes('readViewerSession')&&viewerSession.includes('expiresAtMs:expiresAtS*1000'));
expect('session bootstrap rejects cross-origin issuance',sessionRoute.includes("error:'viewer-session-origin-rejected'")&&sessionRoute.includes('sameOrigin(request)'));
expect('session bootstrap refuses missing production token',sessionRoute.includes("error:'viewer-session-unavailable'")&&sessionRoute.includes('status:503'));
expect('session bootstrap supports explicit loopback development',sessionRoute.includes("KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1'")&&sessionRoute.includes("mode:'loopback-dev'"));
expect('viewer cookie domain is explicitly configurable',sessionRoute.includes('KINGMAST_VIEWER_COOKIE_DOMAIN'));
expect('backend viewer reads require signed scoped session cookie',riskServer.includes('verifyViewerSession(cookieToken(request,VIEWER_SESSION_COOKIE),VIEWER_TOKEN)'));
expect('raw viewer secret is limited to session bootstrap exchange',riskServer.includes('viewerBootstrapAuthorized')&&riskServer.includes("app.post('/v3/session'")&&!riskServer.includes('cookieToken(request,VIEWER_TOKEN)'));
expect('backend session exchange mints short-lived signed cookie',riskServer.includes('issueViewerSession(VIEWER_TOKEN)')&&riskServer.includes('Max-Age=${VIEWER_SESSION_TTL_S}'));
expect('websocket lifetime cannot outlive scoped viewer session',riskServer.includes('readViewerSession(cookieToken(request,VIEWER_SESSION_COOKIE),VIEWER_TOKEN)')&&riskServer.includes("client.close(1008,'viewer-session-expired')")&&riskServer.includes('session.expiresAtMs-Date.now()'));
expect('realtime establishes viewer session before websocket',realtime.indexOf('establishViewerSession')>=0&&realtime.indexOf('await establishViewerSession')<realtime.indexOf('new WebSocket'));
expect('realtime session request includes credentials',realtime.includes("credentials:'include'"));
expect('realtime aborts pending session request on teardown',realtime.includes('sessionAbort.abort()'));
expect('missing or invalid production viewer session fails closed without retry loop',realtime.includes("payload.error==='viewer-session-unavailable'")&&realtime.includes("payload.error==='viewer-session-misconfigured'")&&realtime.includes("sessionResult==='unavailable'")&&realtime.includes('sessionUnavailable=true')&&realtime.includes('if(disposed||sessionUnavailable||retryRef.current!==null)return'));
expect('simulator keeps left/right detections spatial-only',telemetry.includes("const lateralOnly = object.zone === 'left' || object.zone === 'right';")&&telemetry.includes('if (lateralOnly) return null;'));
expect('telemetry reads preview alert state without committing it',riskServer.includes("commit?alertStabilizer.update(rawAlerts,nowMs):alertStabilizer.preview(rawAlerts,nowMs)"));
expect('event history is committed only on publish',riskServer.includes("currentEnvelope(source,true)")&&riskServer.includes('eventBuffer.ingest(envelope.frame)')&&!riskServer.includes('eventBuffer.ingest(frame)'));
expect('LDW ingress requires edge authentication',riskServer.includes("app.post('/v3/assist/lane'")&&riskServer.includes("if(!requireEdgeAuth(request,reply))return"));
expect('DMS ingress requires edge authentication',riskServer.includes("app.post('/v3/assist/dms'")&&riskServer.includes("dms-sample-rejected"));
expect('surround ingress requires edge authentication',riskServer.includes("app.post('/v3/assist/surround'")&&riskServer.includes("surround-observation-rejected"));
expect('assistant planner requires viewer authentication',riskServer.includes("app.post('/v3/assistant/plan'")&&riskServer.includes("if(!requireViewerAuth(request,reply))return"));
expect('assistant input is bounded',riskServer.includes("max(240)"));
expect('driver assist preserves zero control authority',riskServer.includes("controlAuthority:'none'")&&riskServer.includes('readOnlyAssistantPlanner:true'));

if(failures.length){console.error('KINGMAST HMI security contract failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST HMI security contract passed.');
