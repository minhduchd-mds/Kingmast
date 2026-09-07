import { createHash,verify as verifySignature } from 'node:crypto';
import { z } from 'zod';

const UpdateManifestSchema=z.object({
  updateId:z.string().uuid(),
  product:z.literal('KINGMAST'),
  softwareVersion:z.string().trim().min(1).max(64),
  artifactSha256:z.string().regex(/^[a-f0-9]{64}$/),
  targetPlatform:z.string().trim().min(1).max(96),
  compatibleHardware:z.array(z.string().trim().min(1).max(96)).min(1).max(64),
  configurationSchemaVersion:z.string().trim().min(1).max(64),
  calibrationCompatibility:z.string().trim().min(1).max(128),
  createdAt:z.string().datetime({offset:true}),
  signerKeyId:z.string().trim().min(1).max(96),
  rollbackIndex:z.number().int().nonnegative().max(2_147_483_647),
  signature:z.string().min(40).max(512),
});

export type UpdateManifest=z.infer<typeof UpdateManifestSchema>;
export type UpdateVerificationReason='invalid-manifest'|'artifact-hash-mismatch'|'incompatible-target'|'rollback-rejected'|'signature-invalid'|'manifest-from-future';
export type UpdateVerificationResult={verified:true;manifest:UpdateManifest}|{verified:false;reason:UpdateVerificationReason};

export function canonicalUpdatePayload(manifest:Omit<UpdateManifest,'signature'>){
  return JSON.stringify({
    updateId:manifest.updateId,
    product:manifest.product,
    softwareVersion:manifest.softwareVersion,
    artifactSha256:manifest.artifactSha256,
    targetPlatform:manifest.targetPlatform,
    compatibleHardware:[...manifest.compatibleHardware],
    configurationSchemaVersion:manifest.configurationSchemaVersion,
    calibrationCompatibility:manifest.calibrationCompatibility,
    createdAt:manifest.createdAt,
    signerKeyId:manifest.signerKeyId,
    rollbackIndex:manifest.rollbackIndex,
  });
}

export function verifyUpdatePackage(input:{
  manifest:unknown;
  artifact:Uint8Array;
  publicKeyPem:string;
  expectedPlatform:string;
  hardwareId:string;
  minimumRollbackIndex:number;
  nowMs?:number;
}):UpdateVerificationResult {
  const parsed=UpdateManifestSchema.safeParse(input.manifest);
  if(!parsed.success)return{verified:false,reason:'invalid-manifest'};
  const manifest=parsed.data;
  const nowMs=input.nowMs??Date.now();
  if(Date.parse(manifest.createdAt)>nowMs+5*60_000)return{verified:false,reason:'manifest-from-future'};
  if(manifest.targetPlatform!==input.expectedPlatform||!manifest.compatibleHardware.includes(input.hardwareId))return{verified:false,reason:'incompatible-target'};
  if(manifest.rollbackIndex<input.minimumRollbackIndex)return{verified:false,reason:'rollback-rejected'};
  const digest=createHash('sha256').update(input.artifact).digest('hex');
  if(digest!==manifest.artifactSha256)return{verified:false,reason:'artifact-hash-mismatch'};
  const{signature,...unsigned}=manifest;
  let signatureOk=false;
  try{signatureOk=verifySignature(null,Buffer.from(canonicalUpdatePayload(unsigned)),input.publicKeyPem,Buffer.from(signature,'base64'));}catch{signatureOk=false;}
  if(!signatureOk)return{verified:false,reason:'signature-invalid'};
  return{verified:true,manifest};
}

export interface InstallEligibilityInput {
  packageVerified:boolean;
  parked:boolean;
  speedKmh:number|null;
  powerStable:boolean;
  energyReserveOk:boolean;
  thermalOk:boolean;
  storageOk:boolean;
  criticalOperationActive:boolean;
}
export interface InstallEligibilityResult { eligible:boolean; reasons:string[]; }

export function evaluateInstallEligibility(input:InstallEligibilityInput):InstallEligibilityResult {
  const reasons:string[]=[];
  if(!input.packageVerified)reasons.push('package-not-verified');
  if(input.speedKmh===null)reasons.push('vehicle-motion-state-unverified');
  else if(input.speedKmh>0.5)reasons.push('vehicle-moving');
  if(!input.parked)reasons.push('parked-state-not-verified');
  if(!input.powerStable)reasons.push('power-not-stable');
  if(!input.energyReserveOk)reasons.push('energy-reserve-insufficient');
  if(!input.thermalOk)reasons.push('thermal-state-not-acceptable');
  if(!input.storageOk)reasons.push('storage-insufficient');
  if(input.criticalOperationActive)reasons.push('critical-operation-active');
  return{eligible:reasons.length===0,reasons};
}
