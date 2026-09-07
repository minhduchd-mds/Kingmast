import {RealtimeLinkAccumulator} from '@kingmast/contracts/realtime-health';

const link=new RealtimeLinkAccumulator();
link.recordConnectAttempt();
link.recordConnected();
const first=link.observeTelemetry({serverEnvelopeAtMs:1_000,ingressAtMs:970,clientAtMs:1_025,session:'ecu-a:boot-a',sequence:10});
link.recordDisconnect();
link.recordConnectAttempt();
link.recordConnected();
const regression=link.observeTelemetry({serverEnvelopeAtMs:1_200,ingressAtMs:1_175,clientAtMs:1_230,session:'ecu-a:boot-a',sequence:9});
const recovered=link.observeTelemetry({serverEnvelopeAtMs:1_250,ingressAtMs:1_220,clientAtMs:1_285,session:'ecu-a:boot-a',sequence:11});
const reboot=link.observeTelemetry({serverEnvelopeAtMs:1_500,ingressAtMs:1_470,clientAtMs:1_540,session:'ecu-a:boot-b',sequence:0});
const snapshot=link.snapshot();

const checks={
  initialFrameAccepted:first.accepted,
  sequenceRegressionRejected:regression.accepted===false&&snapshot.sequenceRegressions===1,
  reconnectRecovered:recovered.accepted&&snapshot.reconnects===1&&snapshot.successfulConnections===2,
  rebootSequenceResetAccepted:reboot.accepted&&reboot.sessionChanged&&snapshot.sessionChanges===1&&snapshot.lastSequence===0,
  boundedLatencyAccounting:snapshot.serverToClient.samples===3&&snapshot.ingressToClient.samples===3&&snapshot.serverToClient.maxMs<=100&&snapshot.ingressToClient.maxMs<=100,
  noClockAnomalies:snapshot.clockAnomalies===0,
};
const allPassed=Object.values(checks).every(Boolean);

const report={
  schema:'kingmast-realtime-recovery-report/v1',
  generatedAt:new Date().toISOString(),
  controlAuthority:'none',
  qualificationClaim:'deterministic-software-recovery-only-not-physical-hil',
  physicalControllerTest:false,
  targetHardwareQualified:false,
  browserNetworkMeasured:false,
  scope:'shared-realtime-accumulator-reconnect-sequence-and-latency-contract',
  note:'This deterministic software evidence exercises the same bounded accumulator used by the HMI client. It is not a target-controller, physical-network, user-study or HIL result.',
  checks,
  snapshot,
  allPassed,
};

console.log(JSON.stringify(report,null,2));
if(!allPassed)process.exitCode=1;
