import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const provisioning=read('services/risk-engine/src/device-provisioning.ts');
const provisioningTest=read('services/risk-engine/src/device-provisioning.test.ts');
const firmwareRelease=read('services/risk-engine/src/firmware-release.ts');
const firmwareReleaseTest=read('services/risk-engine/src/firmware-release.test.ts');
const evidenceAnchor=read('scripts/generate-evidence-anchor.mjs');
const provisioningDoc=read('docs/cybersecurity/DEVICE_PROVISIONING_V006.md');
const releaseDoc=read('docs/updates/FIRMWARE_RELEASE_SIGNING_V006.md');
const anchorDoc=read('docs/supplychain/EVIDENCE_ANCHOR_V006.md');
const pkg=read('package.json');
const ci=read('.github/workflows/ci.yml');

if(!provisioning.includes('class DeviceProvisioningRegistry')||!provisioning.includes("privateKeyCustody:'device-only'")||!provisioning.includes('exportServerRegistry'))failures.push('bounded asymmetric device provisioning lifecycle missing');
if(!provisioning.includes("if(/PRIVATE KEY/.test(candidate))")||!provisioning.includes("asymmetricKeyType!=='ed25519'"))failures.push('device provisioning must reject private/non-Ed25519 key material');
if(!provisioningTest.includes('never accepts private key material')||!provisioningTest.includes('does not reactivate revoked credentials'))failures.push('device provisioning security tests missing');
if(!firmwareRelease.includes('createSignedUpdateManifest')||!firmwareRelease.includes('createPrivateKey')||!firmwareRelease.includes("asymmetricKeyType!=='ed25519'")||!firmwareRelease.includes('canonicalUpdatePayload'))failures.push('Ed25519 firmware release signing contract missing');
if(!firmwareReleaseTest.includes('accepted by the production verifier')||!firmwareReleaseTest.includes('detects artifact tampering'))failures.push('firmware release end-to-end verification tests missing');
if(!evidenceAnchor.includes("schema:'kingmast-evidence-anchor/v1'")||!evidenceAnchor.includes("externallySigned:false")||!evidenceAnchor.includes("externalTimestampAuthority:'none'"))failures.push('evidence anchor must preserve explicit unsigned/no-trusted-timestamp boundary');
if(!provisioningDoc.includes('Private key material must never be uploaded')||!provisioningDoc.includes('not fleet PKI'))failures.push('device provisioning documentation must preserve key-custody/non-PKI boundary');
if(!releaseDoc.includes('does not yet build and sign a production ESP32 binary in CI')||!releaseDoc.includes('must not be presented as a production firmware release claim'))failures.push('firmware release documentation must preserve non-production claim boundary');
if(!anchorDoc.includes('does not by itself establish authenticity or non-repudiation')||!anchorDoc.includes('Real-time warning computation must never depend'))failures.push('evidence anchor documentation must preserve trust and safety-operation boundaries');
if(!pkg.includes('"release:identity-policy"'))failures.push('release identity policy script missing from root package');
if(!ci.includes('pnpm release:identity-policy')||!ci.includes('Generate engineering evidence anchor')||!ci.includes('/tmp/kingmast.evidence-anchor.json'))failures.push('release identity/evidence anchor gates missing from CI');

if(failures.length){console.error('KINGMAST release/identity policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST release/identity policy passed.');
