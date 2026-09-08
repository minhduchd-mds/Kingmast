import { z } from 'zod';

const Label=z.string().trim().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9._:+/@-]*$/);
const MaybeLabel=Label.nullable().optional();
const Sha256=z.string().regex(/^[a-f0-9]{64}$/i);
const MaybeSha256=Sha256.nullable().optional();
const Counter=z.number().int().nonnegative().max(1_000_000_000);
const AgeMs=z.number().int().nonnegative().max(86_400_000).nullable();

const EdgeSourceSchema=z.object({
  status:z.enum(['live','degraded','offline']).default('offline'),
  rejectedPackets:Counter.default(0),
  sensorAgesMs:z.object({gnss:AgeMs.default(null),radarFront:AgeMs.default(null),camera:AgeMs.default(null)}).default({gnss:null,radarFront:null,camera:null}),
}).default({status:'offline',rejectedPackets:0,sensorAgesMs:{gnss:null,radarFront:null,camera:null}});

const ProviderStatusSchema=z.object({
  state:z.enum(['healthy','degraded','stale']),
  trustStatus:z.enum(['verified','expiring','expired','revoked','untrusted','unknown']),
  liveV2xTrusted:z.boolean(),
  snapshotAgeMs:Counter,
});

const ProviderSourceSchema=z.object({
  authRejected:Counter.default(0),
  replayRejected:Counter.default(0),
  capacityRejected:Counter.default(0),
  providers:z.array(ProviderStatusSchema).max(32).default([]),
}).default({authRejected:0,replayRejected:0,capacityRejected:0,providers:[]});

const RuntimeSourceSchema=z.object({
  edge:EdgeSourceSchema,
  providerTrust:ProviderSourceSchema,
}).default({edge:{status:'offline',rejectedPackets:0,sensorAgesMs:{gnss:null,radarFront:null,camera:null}},providerTrust:{authRejected:0,replayRejected:0,capacityRejected:0,providers:[]}});

export interface FieldDiagnosticIdentity {
  productVersion:string;
  buildCommit:string|null;
  buildId:string|null;
  hardwareTarget:string|null;
  hardwareInstanceHash:string|null;
  firmwareRevision:string|null;
  configurationRevision:string|null;
  calibrationRevision:string|null;
}

export interface FieldDiagnosticsOptions {
  identity:FieldDiagnosticIdentity;
  runtime?:unknown;
  physicalVehicleComputerTest?:boolean;
  generatedAt?:string;
}

function optionalLabel(value:string|undefined){
  const trimmed=value?.trim();
  if(!trimmed)return null;
  const parsed=MaybeLabel.safeParse(trimmed);
  return parsed.success?parsed.data:null;
}

function optionalSha256(value:string|undefined){
  const trimmed=value?.trim();
  if(!trimmed)return null;
  const parsed=MaybeSha256.safeParse(trimmed);
  return parsed.success?parsed.data.toLowerCase():null;
}

export function fieldDiagnosticIdentityFromEnv(env:NodeJS.ProcessEnv=process.env):FieldDiagnosticIdentity{
  const productVersion=optionalLabel(env.KINGMAST_PRODUCT_VERSION)??'0.0.6';
  return{
    productVersion,
    buildCommit:optionalLabel(env.KINGMAST_BUILD_COMMIT),
    buildId:optionalLabel(env.KINGMAST_BUILD_ID),
    hardwareTarget:optionalLabel(env.KINGMAST_HARDWARE_TARGET),
    hardwareInstanceHash:optionalSha256(env.KINGMAST_HARDWARE_INSTANCE_SHA256),
    firmwareRevision:optionalLabel(env.KINGMAST_FIRMWARE_REVISION),
    configurationRevision:optionalLabel(env.KINGMAST_CONFIGURATION_REVISION),
    calibrationRevision:optionalLabel(env.KINGMAST_CALIBRATION_REVISION),
  };
}

function aggregateProviders(providers:z.infer<typeof ProviderStatusSchema>[]){
  const states={healthy:0,degraded:0,stale:0};
  const trust={verified:0,expiring:0,expired:0,revoked:0,untrusted:0,unknown:0};
  let liveV2xTrusted=0;
  let maxSnapshotAgeMs=0;
  for(const provider of providers){
    states[provider.state]+=1;
    trust[provider.trustStatus]+=1;
    if(provider.liveV2xTrusted)liveV2xTrusted+=1;
    maxSnapshotAgeMs=Math.max(maxSnapshotAgeMs,provider.snapshotAgeMs);
  }
  return{total:providers.length,states,trust,liveV2xTrusted,maxSnapshotAgeMs};
}

export function buildFieldDiagnosticsReport(options:FieldDiagnosticsOptions){
  const runtime=RuntimeSourceSchema.parse(options.runtime??{});
  const identity={
    productVersion:Label.parse(options.identity.productVersion),
    buildCommit:options.identity.buildCommit?Label.parse(options.identity.buildCommit):null,
    buildId:options.identity.buildId?Label.parse(options.identity.buildId):null,
    hardwareTarget:options.identity.hardwareTarget?Label.parse(options.identity.hardwareTarget):null,
    hardwareInstanceHash:options.identity.hardwareInstanceHash?Sha256.parse(options.identity.hardwareInstanceHash).toLowerCase():null,
    firmwareRevision:options.identity.firmwareRevision?Label.parse(options.identity.firmwareRevision):null,
    configurationRevision:options.identity.configurationRevision?Label.parse(options.identity.configurationRevision):null,
    calibrationRevision:options.identity.calibrationRevision?Label.parse(options.identity.calibrationRevision):null,
  };
  const identityComplete=Boolean(identity.buildCommit&&identity.buildId&&identity.hardwareTarget&&identity.hardwareInstanceHash&&identity.firmwareRevision&&identity.configurationRevision&&identity.calibrationRevision);
  const physicalVehicleComputerTest=options.physicalVehicleComputerTest===true;
  const physicalCaptureReady=physicalVehicleComputerTest&&identityComplete;
  const providerSummary=aggregateProviders(runtime.providerTrust.providers);
  const report={
    schema:'kingmast-field-diagnostics-report/v1' as const,
    generatedAt:options.generatedAt??new Date().toISOString(),
    productVersion:identity.productVersion,
    controlAuthority:'none' as const,
    qualificationClaim:physicalVehicleComputerTest?'physical-target-diagnostic-capture-only-not-qualification':'ci-software-contract-only-not-physical-field-evidence',
    targetHardwareQualified:false,
    physicalVehicleComputerTest,
    physicalCaptureReady,
    identity:{...identity,complete:identityComplete,hardwareInstanceIsHashed:identity.hardwareInstanceHash!==null},
    health:{
      edgeStatus:runtime.edge.status,
      sensorAgesMs:runtime.edge.sensorAgesMs,
      rejectedPackets:runtime.edge.rejectedPackets,
      providerTrustFailures:{authRejected:runtime.providerTrust.authRejected,replayRejected:runtime.providerTrust.replayRejected,capacityRejected:runtime.providerTrust.capacityRejected},
      providers:providerSummary,
    },
    privacy:{rawCabinVideoIncluded:false,rawCameraFramesIncluded:false,preciseCoordinatesIncluded:false,requestPayloadsIncluded:false,secretsIncluded:false,rawHardwareSerialIncluded:false},
    bounds:{providerStatusEntriesMax:32,counterMax:1_000_000_000,sensorAgeMaxMs:86_400_000,identityLabelMaxChars:96},
    allPassed:true,
    limitations:[
      'This report is a bounded service/field-diagnostics contract and never creates vehicle-control authority.',
      'CI output is software evidence only. A physical capture requires explicit target identity, hashed hardware instance identity, firmware/configuration/calibration revisions and a physical execution flag.',
      'A physical capture does not by itself qualify target hardware or approve closed-track/public-road use.',
    ],
  };
  return report;
}
