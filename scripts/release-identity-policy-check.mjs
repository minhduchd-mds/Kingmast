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
const evidenceVerify=read('scripts/verify-evidence-anchor.mjs');
const evidenceSignatureLib=read('scripts/evidence-signature-lib.mjs');
const evidenceSignCli=read('scripts/sign-evidence-anchor.mjs');
const evidenceSignedVerify=read('scripts/verify-signed-evidence-anchor.mjs');
const evidenceTimestampLib=read('scripts/evidence-timestamp-lib.mjs');
const evidenceTimestampVerify=read('scripts/verify-external-evidence-timestamp.mjs');
const evidenceSigningSelftest=read('scripts/evidence-signing-selftest.mjs');
const provisioningDoc=read('docs/cybersecurity/DEVICE_PROVISIONING_V006.md');
const releaseDoc=read('docs/updates/FIRMWARE_RELEASE_SIGNING_V006.md');
const anchorDoc=read('docs/supplychain/EVIDENCE_ANCHOR_V006.md');
const signingDoc=read('docs/supplychain/EVIDENCE_SIGNING_V006.md');
const pkg=read('package.json');
const ci=read('.github/workflows/ci.yml');

if(!provisioning.includes('class DeviceProvisioningRegistry')||!provisioning.includes("privateKeyCustody:'device-only'")||!provisioning.includes('exportServerRegistry'))failures.push('bounded asymmetric device provisioning lifecycle missing');
if(!provisioning.includes("if(/PRIVATE KEY/.test(candidate))")||!provisioning.includes("asymmetricKeyType!=='ed25519'"))failures.push('device provisioning must reject private/non-Ed25519 key material');
if(!provisioningTest.includes('never accepts private key material')||!provisioningTest.includes('does not reactivate revoked credentials'))failures.push('device provisioning security tests missing');
if(!firmwareRelease.includes('createSignedUpdateManifest')||!firmwareRelease.includes('createPrivateKey')||!firmwareRelease.includes("asymmetricKeyType!=='ed25519'")||!firmwareRelease.includes('canonicalUpdatePayload'))failures.push('Ed25519 firmware release signing contract missing');
if(!firmwareReleaseTest.includes('accepted by the production verifier')||!firmwareReleaseTest.includes('detects artifact tampering'))failures.push('firmware release end-to-end verification tests missing');
if(!evidenceAnchor.includes("schema:'kingmast-evidence-anchor/v1'")||!evidenceAnchor.includes("externallySigned:false")||!evidenceAnchor.includes("externalTimestampAuthority:'none'"))failures.push('evidence anchor must preserve explicit unsigned/no-trusted-timestamp boundary');
if(!evidenceVerify.includes('evidence anchor root mismatch')||!evidenceVerify.includes('timingSafeEqual')||!evidenceVerify.includes('evidence material mismatch'))failures.push('independent evidence anchor verification contract missing');
if(!evidenceSignatureLib.includes("schema:'kingmast-signed-evidence-anchor/v1'")||!evidenceSignatureLib.includes("algorithm:'ed25519'")||!evidenceSignatureLib.includes("externalTimestampAuthority:'none'")||!evidenceSignatureLib.includes('nonRepudiationClaim:false'))failures.push('detached Ed25519 evidence-signature trust boundary missing');
if(!evidenceSignCli.includes('KINGMAST_EVIDENCE_SIGNING_PRIVATE_KEY_PEM')||!evidenceSignedVerify.includes('KINGMAST_EVIDENCE_SIGNING_PUBLIC_KEY_PEM'))failures.push('out-of-repository evidence signing/verifying CLI contract missing');
if(!evidenceTimestampLib.includes("schema!=='kingmast-external-evidence-timestamp/v1'")||!evidenceTimestampLib.includes('timestamp-from-future')||!evidenceTimestampLib.includes('anchor-binding-mismatch'))failures.push('external timestamp attestation verification contract missing');
if(!evidenceTimestampVerify.includes('KINGMAST_EXTERNAL_TIMESTAMP_PUBLIC_KEY_PEM')||!evidenceTimestampVerify.includes('verifyExternalEvidenceTimestamp'))failures.push('external timestamp verification CLI missing');
if(!evidenceSigningSelftest.includes("generateKeyPairSync('ed25519')")||!evidenceSigningSelftest.includes('failed to reject tampering')||!evidenceSigningSelftest.includes('external evidence timestamp self-test failed'))failures.push('ephemeral evidence signing/timestamp self-test missing');
if(!provisioningDoc.includes('Private key material must never be uploaded')||!provisioningDoc.includes('not fleet PKI'))failures.push('device provisioning documentation must preserve key-custody/non-PKI boundary');
if(!releaseDoc.includes('does not yet build and sign a production ESP32 binary in CI')||!releaseDoc.includes('must never be presented as a production firmware release claim'))failures.push('firmware release documentation must preserve non-production claim boundary');
if(!anchorDoc.includes('authenticity or non-repudiation')||!anchorDoc.includes('Real-time warning computation must never depend'))failures.push('evidence anchor documentation must preserve trust and safety-operation boundaries');
if(!signingDoc.includes('ephemeral generated keys only')||!signingDoc.includes('not a trusted timestamp')||!signingDoc.includes('must never depend on a signing service'))failures.push('evidence signing documentation must preserve external trust/timestamp/safety boundaries');
if(!pkg.includes('"release:identity-policy"')||!pkg.includes('"evidence:anchor-verify"')||!pkg.includes('"evidence:signing-selftest"')||!pkg.includes('"evidence:timestamp-verify"'))failures.push('release identity/evidence verification scripts missing from root package');
if(!ci.includes('pnpm release:identity-policy')||!ci.includes('Detached evidence signing self-test')||!ci.includes('Generate engineering evidence anchor')||!ci.includes('Verify engineering evidence anchor')||!ci.includes('/tmp/kingmast.evidence-anchor.json'))failures.push('release identity/evidence anchor/signing gates missing from CI');

if(failures.length){console.error('KINGMAST release/identity policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST release/identity policy passed.');
