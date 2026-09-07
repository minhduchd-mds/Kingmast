import {existsSync,readFileSync} from 'node:fs';

const failures=[];
function read(path){if(!existsSync(path)){failures.push(`${path}: missing`);return'';}return readFileSync(path,'utf8');}
const auth=read('services/risk-engine/src/provider-auth.ts');
const authTest=read('services/risk-engine/src/provider-auth.test.ts');
const cert=read('services/risk-engine/src/provider-certificate.ts');
const certTest=read('services/risk-engine/src/provider-certificate.test.ts');
const routes=read('services/risk-engine/src/road-context-routes.ts');
const doc=read('docs/cybersecurity/PROVIDER_IDENTITY_V006.md');
const env=read('.env.example');

if(!auth.includes("type ProviderScope='road-context:cameras'|'connected-road:provider'|'connected-road:v2x'")||!auth.includes('verifyProviderAuth')||!auth.includes('provider-key-revoked')||!auth.includes('provider-scope-denied'))failures.push('provider-scoped identity/rotation/revocation contract missing');
if(!auth.includes("'ed25519'")||!auth.includes("createHmac('sha256'")||!auth.includes('maxSkewMs'))failures.push('provider asymmetric/transitional signature and replay-window contract missing');
if(!authTest.includes('rejects tampering')&&!authTest.includes('rejecting tampering'))failures.push('provider tamper-rejection test missing');
if(!authTest.includes('scope, validity and revocation')||!authTest.includes('supports Ed25519'))failures.push('provider scope/revocation/Ed25519 tests missing');
if(!cert.includes('class Provider')&&!cert.includes('parseProviderCertificateRegistry'))failures.push('provider certificate lifecycle scaffold missing');
if(!cert.includes("enforcement:'trusted-gateway-required'")||!cert.includes('certificate-revoked')||!cert.includes('certificate-scope-denied'))failures.push('mTLS certificate lifecycle/revocation policy missing');
if(!certTest.includes('overlapping certificate rotation')||!certTest.includes('scope escalation'))failures.push('provider certificate lifecycle tests missing');
if(!routes.includes('KINGMAST_REQUIRE_PROVIDER_AUTH')||!routes.includes('KINGMAST_PROVIDER_KEYS_JSON')||!routes.includes("'/v4/provider-identity/status'"))failures.push('provider strict-auth runtime migration gate missing');
if(!routes.includes("'connected-road:v2x'")||!routes.includes("'road-context:cameras'"))failures.push('provider-owned routes must use provider-scoped authority');
if(!doc.includes('does **not** infer mTLS success from arbitrary HTTP headers')||!doc.includes('not proof that mTLS is deployed'))failures.push('mTLS trust boundary documentation missing');
if(!env.includes('KINGMAST_REQUIRE_PROVIDER_AUTH=')||!env.includes('KINGMAST_PROVIDER_KEYS_JSON=')||!env.includes('KINGMAST_PROVIDER_CERTIFICATES_JSON='))failures.push('provider identity environment contract missing');
if(failures.length){console.error('KINGMAST provider identity policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST provider identity policy passed.');
