import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const server=read('services/risk-engine/src/server.ts');
const env=read('.env.example');
const doc=read('docs/cybersecurity/CONFIGURATION_AUTH_V006.md');
const operatorAuth=read('services/risk-engine/src/operator-auth.ts');
const configurationAudit=read('services/risk-engine/src/configuration-audit.ts');

if(!server.includes("const CONFIG_TOKEN=(process.env.KINGMAST_CONFIG_TOKEN??'').trim()"))failures.push('migration KINGMAST_CONFIG_TOKEN missing');
if(!server.includes("validateSecret('KINGMAST_CONFIG_TOKEN',CONFIG_TOKEN,32)"))failures.push('migration configuration credential must require at least 32 characters');
if(!server.includes("const REQUIRE_OPERATOR_AUTH=process.env.KINGMAST_REQUIRE_OPERATOR_AUTH==='1'"))failures.push('strict operator-auth mode missing');
if(!server.includes("parseOperatorKeyRegistry(process.env.KINGMAST_OPERATOR_KEYS_JSON??'{}')"))failures.push('operator key registry missing');
for(const header of ['x-kingmast-operator-id','x-kingmast-operator-key-id','x-kingmast-operator-timestamp-ms','x-kingmast-operator-nonce','x-kingmast-operator-signature'])if(!server.includes(header))failures.push(`operator auth header missing: ${header}`);
if(!server.includes('function configAuthorized(')||!server.includes('constantTimeEqual(candidate,CONFIG_TOKEN)'))failures.push('migration configuration credential must use constant-time verification');
if(!server.includes('function requireConfigurationAuthority(')||!server.includes('configWriteLimiter.consume(request.ip,30)'))failures.push('bounded configuration write authority gate missing');
if(!server.includes("verifyOperatorRequest({scope")||!server.includes('replayGuard:operatorReplayGuard'))failures.push('scoped operator signature/replay verification missing');
if(!server.includes("if(REQUIRE_OPERATOR_AUTH&&operatorAuthSummary(OPERATOR_KEYS).activeKeys===0)throw new Error"))failures.push('strict operator-auth startup gate missing');
if(!server.includes("app.post('/v3/geofences'")||!server.includes("const authority=requireConfigurationAuthority(request,reply,'configuration:geofences',request.body);if(!authority)return;"))failures.push('geofence writes must use scoped configuration authority');
if(!server.includes('configurationAudit.record({actorId:authority.actorId'))failures.push('configuration mutation audit record missing');
if(!server.includes("error:'configuration-auth-required'"))failures.push('configuration writes must fail closed on missing/invalid auth');
if(!operatorAuth.includes("export type OperatorScope='configuration:geofences'"))failures.push('least-privilege operator scope missing');
if(!operatorAuth.includes("key.asymmetricKeyType!=='ed25519'"))failures.push('operator public keys must be Ed25519');
if(!operatorAuth.includes("reason:'replay'"))failures.push('operator replay rejection missing');
if(!configurationAudit.includes('actorId')||!configurationAudit.includes('authMode')||!configurationAudit.includes('previousDigest')||!configurationAudit.includes('newDigest'))failures.push('configuration audit evidence is incomplete');
if(!env.includes('KINGMAST_CONFIG_TOKEN=')||env.includes('NEXT_PUBLIC_KINGMAST_CONFIG_TOKEN'))failures.push('migration configuration credential must remain server-only');
if(!env.includes('KINGMAST_REQUIRE_OPERATOR_AUTH=')||!env.includes('KINGMAST_OPERATOR_KEYS_JSON=')||env.includes('NEXT_PUBLIC_KINGMAST_OPERATOR'))failures.push('operator identity settings must be documented and server-only');
if(!doc.includes('telemetry device identity -> sensor/assist ingress only')||!doc.includes('operator identity          -> scoped configuration writes only'))failures.push('configuration authority separation documentation missing');
if(!doc.includes('does not grant telemetry identity')||!doc.includes('CAN-write authority'))failures.push('configuration authority boundary must preserve no-actuation/no-telemetry-authority claims');

if(failures.length){console.error('KINGMAST configuration auth policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST configuration auth policy passed.');
