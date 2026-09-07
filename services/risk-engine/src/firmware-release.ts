import {createHash,createPrivateKey,sign as signSignature} from 'node:crypto';
import {canonicalUpdatePayload,type UpdateManifest} from './update-verifier.js';

export interface SignedFirmwareReleaseInput {
  artifact:Uint8Array;
  privateKeyPem:string;
  updateId:string;
  softwareVersion:string;
  targetPlatform:string;
  compatibleHardware:string[];
  configurationSchemaVersion:string;
  calibrationCompatibility:string;
  signerKeyId:string;
  rollbackIndex:number;
  createdAtMs?:number;
}

export function createSignedUpdateManifest(input:SignedFirmwareReleaseInput):UpdateManifest {
  if(input.artifact.byteLength===0)throw new Error('firmware artifact must not be empty');
  let key;
  try{key=createPrivateKey(input.privateKeyPem);}catch{throw new Error('firmware signing key is invalid');}
  if(key.asymmetricKeyType!=='ed25519')throw new Error('firmware signing key must be Ed25519');
  const compatibleHardware=[...new Set(input.compatibleHardware.map((item)=>item.trim()).filter(Boolean))].sort();
  if(compatibleHardware.length===0)throw new Error('compatibleHardware must not be empty');
  const createdAt=new Date(input.createdAtMs??Date.now()).toISOString();
  const unsigned:Omit<UpdateManifest,'signature'>={
    updateId:input.updateId,
    product:'KINGMAST',
    softwareVersion:input.softwareVersion.trim(),
    artifactSha256:createHash('sha256').update(input.artifact).digest('hex'),
    targetPlatform:input.targetPlatform.trim(),
    compatibleHardware,
    configurationSchemaVersion:input.configurationSchemaVersion.trim(),
    calibrationCompatibility:input.calibrationCompatibility.trim(),
    createdAt,
    signerKeyId:input.signerKeyId.trim(),
    rollbackIndex:input.rollbackIndex,
  };
  const signature=signSignature(null,Buffer.from(canonicalUpdatePayload(unsigned),'utf8'),key).toString('base64');
  return{...unsigned,signature};
}
