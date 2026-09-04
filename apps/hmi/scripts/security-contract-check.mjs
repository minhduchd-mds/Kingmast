import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const realtime=read('lib/realtime.ts');
const sessionRoute=read('app/api/kingmast/session/route.ts');
const envExample=read('../../.env.example');
const failures=[];
function expect(name,condition){if(!condition)failures.push(name);}

expect('viewer token remains server-only',!envExample.includes('NEXT_PUBLIC_KINGMAST_VIEWER_TOKEN'));
expect('session bootstrap uses HttpOnly cookie',sessionRoute.includes('httpOnly:true')&&sessionRoute.includes("COOKIE_NAME='kingmast_viewer'"));
expect('session bootstrap refuses missing production token',sessionRoute.includes("error:'viewer-session-unavailable'")&&sessionRoute.includes('status:503'));
expect('session bootstrap supports explicit loopback development',sessionRoute.includes("KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1'")&&sessionRoute.includes("mode:'loopback-dev'"));
expect('viewer cookie domain is explicitly configurable',sessionRoute.includes('KINGMAST_VIEWER_COOKIE_DOMAIN'));
expect('realtime establishes viewer session before websocket',realtime.indexOf('establishViewerSession')>=0&&realtime.indexOf('await establishViewerSession')<realtime.indexOf('new WebSocket'));
expect('realtime session request includes credentials',realtime.includes("credentials:'include'"));
expect('realtime aborts pending session request on teardown',realtime.includes('sessionAbort.abort()'));

if(failures.length){console.error('KINGMAST HMI security contract failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST HMI security contract passed.');
