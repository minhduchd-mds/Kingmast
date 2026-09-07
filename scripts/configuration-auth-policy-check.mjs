import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const server=read('services/risk-engine/src/server.ts');
const env=read('.env.example');
const doc=read('docs/cybersecurity/CONFIGURATION_AUTH_V006.md');

if(!server.includes("const CONFIG_TOKEN=(process.env.KINGMAST_CONFIG_TOKEN??'').trim()"))failures.push('dedicated KINGMAST_CONFIG_TOKEN missing');
if(!server.includes("validateSecret('KINGMAST_CONFIG_TOKEN',CONFIG_TOKEN,32)"))failures.push('configuration credential must require at least 32 characters');
if(!server.includes("'x-kingmast-config-token'"))failures.push('configuration credential header missing');
if(!server.includes('function configAuthorized(')||!server.includes('constantTimeEqual(candidate,CONFIG_TOKEN)'))failures.push('configuration credential must use constant-time verification');
if(!server.includes('function requireConfigAuth(')||!server.includes('configWriteLimiter.consume(request.ip,30)'))failures.push('bounded configuration write rate limit missing');
if(!server.includes("app.post('/v3/geofences',async(request,reply)=>{if(!requireConfigAuth(request,reply))return;"))failures.push('geofence writes must use dedicated configuration auth');
if(!server.includes("error:'configuration-auth-required'"))failures.push('configuration writes must fail closed on missing/invalid auth');
if(!env.includes('KINGMAST_CONFIG_TOKEN=')||env.includes('NEXT_PUBLIC_KINGMAST_CONFIG_TOKEN'))failures.push('configuration credential must remain documented and server-only');
if(!doc.includes('telemetry device identity -> sensor/assist ingress only')||!doc.includes('configuration credential  -> bounded configuration writes only'))failures.push('configuration authority separation documentation missing');
if(!doc.includes('does not grant telemetry identity')||!doc.includes('CAN-write authority'))failures.push('configuration credential boundary must preserve no-actuation/no-telemetry-authority claims');

if(failures.length){console.error('KINGMAST configuration auth policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST configuration auth policy passed.');
