import type { EdgeTelemetryPacket,SensorHealth,VehicleSample } from '@kingmast/contracts';
import { EdgePacketGuard,applySensorFreshness } from './edge-guard.js';
import { parseProviderKeyRegistry,signProviderRequest,verifyProviderAuth } from './provider-auth.js';
import { assessRisk } from './risk.js';

const NOW_MS=1_800_000_000_000;
const PROVIDER_SECRET='kingmast-service-fault-preflight-secret-0001';

export interface ServiceFaultPreflightCaseResult {
  id:string;
  fault:string;
  layer:'L2-service-integration';
  expected:string;
  observed:string;
  passed:boolean;
  relatedPhysicalScenario:string|null;
  physicalScenarioSatisfied:false;
}

function sensors(overrides:Partial<SensorHealth>={}):SensorHealth{
  return{radarFront:'ok',radarRear:'ok',camera:'ok',can:'ok',gnssImu:'ok',ecu:'ok',...overrides};
}

function packet(overrides:Partial<EdgeTelemetryPacket>={}):EdgeTelemetryPacket{
  const timestampMs=overrides.timestampMs??NOW_MS;
  return{
    protocolVersion:1,
    deviceId:'preflight-edge-01',
    bootId:'boot-preflight-a',
    sequence:1,
    timestampMs,
    gnss:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:3,timestampMs,source:'gnss'},
    sensors:sensors(),
    ...overrides,
  };
}

function vehicleSample(overrides:Partial<VehicleSample>={}):VehicleSample{
  return{timestampMs:NOW_MS,egoSpeedMps:20,targetSpeedMps:15,rangeM:25,confidence:0.8,canHealthy:true,radarHealthy:true,cameraHealthy:true,...overrides};
}

function result(id:string,fault:string,expected:string,observed:string,passed:boolean,relatedPhysicalScenario:string|null):ServiceFaultPreflightCaseResult{
  return{id,fault,layer:'L2-service-integration',expected,observed,passed,relatedPhysicalScenario,physicalScenarioSatisfied:false};
}

export function runServiceFaultPreflight(){
  const cases:ServiceFaultPreflightCaseResult[]=[];

  {
    const guard=new EdgePacketGuard();
    const first=guard.accept(packet({sequence:1}),NOW_MS);
    const duplicate=guard.accept(packet({sequence:1}),NOW_MS);
    const observed=!duplicate.ok?duplicate.reason:'accepted';
    cases.push(result('L2-FI-001','duplicate edge sequence','sequence-replay',observed,first.ok&&!duplicate.ok&&duplicate.reason==='sequence-replay','HIL-002'));
  }

  {
    const guard=new EdgePacketGuard();
    const first=guard.accept(packet({sequence:2}),NOW_MS);
    const reordered=guard.accept(packet({sequence:1}),NOW_MS);
    const observed=!reordered.ok?reordered.reason:'accepted';
    cases.push(result('L2-FI-002','reordered edge sequence','sequence-replay',observed,first.ok&&!reordered.ok&&reordered.reason==='sequence-replay','HIL-002'));
  }

  {
    const guard=new EdgePacketGuard();
    const futureTimestamp=NOW_MS+6_000;
    const future=guard.accept(packet({sequence:1,timestampMs:futureTimestamp,gnss:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:3,timestampMs:futureTimestamp,source:'gnss'}}),NOW_MS);
    const observed=!future.ok?future.reason:'accepted';
    cases.push(result('L2-FI-003','future edge clock skew','clock-skew',observed,!future.ok&&future.reason==='clock-skew','HIL-002'));
  }

  {
    const guard=new EdgePacketGuard();
    const first=guard.accept(packet({sequence:1,timestampMs:NOW_MS}),NOW_MS);
    const regressedTimestamp=NOW_MS-3_000;
    const regressed=guard.accept(packet({sequence:2,timestampMs:regressedTimestamp,gnss:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:3,timestampMs:regressedTimestamp,source:'gnss'}}),NOW_MS);
    const observed=!regressed.ok?regressed.reason:'accepted';
    cases.push(result('L2-FI-004','edge timestamp regression','clock-regression',observed,first.ok&&!regressed.ok&&regressed.reason==='clock-regression','HIL-002'));
  }

  {
    const fresh=applySensorFreshness({sensors:sensors(),vehicle:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:3,timestampMs:NOW_MS,source:'gnss'},radarTimestampMs:NOW_MS-1_000,cameraTimestampMs:NOW_MS,nowMs:NOW_MS});
    cases.push(result('L2-FI-005','frozen/stale front radar','radarFront=unavailable',`radarFront=${fresh.radarFront}`,fresh.radarFront==='unavailable','HIL-001'));
  }

  {
    const fresh=applySensorFreshness({sensors:sensors(),vehicle:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:3,timestampMs:NOW_MS,source:'gnss'},radarTimestampMs:NOW_MS,cameraTimestampMs:NOW_MS-1_000,nowMs:NOW_MS});
    cases.push(result('L2-FI-006','stale camera frame','camera=unavailable',`camera=${fresh.camera}`,fresh.camera==='unavailable',null));
  }

  {
    const fresh=applySensorFreshness({sensors:sensors(),vehicle:{lat:21.0285,lng:105.8542,speedKmh:45,headingDeg:90,accuracyM:80,timestampMs:NOW_MS,source:'gnss'},radarTimestampMs:NOW_MS,cameraTimestampMs:NOW_MS,nowMs:NOW_MS});
    cases.push(result('L2-FI-007','low-quality GNSS position','gnssImu=unavailable',`gnssImu=${fresh.gnssImu}`,fresh.gnssImu==='unavailable','HIL-009'));
  }

  {
    const assessment=assessRisk(vehicleSample({canHealthy:false}),NOW_MS);
    const passed=assessment.severity==='caution'&&assessment.reasons.includes('can-degraded');
    cases.push(result('L2-FI-008','CAN receive-path degraded','caution with can-degraded reason',`${assessment.severity}:${assessment.reasons.join(',')}`,passed,'HIL-008'));
  }

  {
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-preflight':[{keyId:'key-a',algorithm:'hmac-sha256',secret:PROVIDER_SECRET,state:'active',scopes:['connected-road:v2x']}]}));
    const payload={providerId:'provider-preflight',timestampMs:NOW_MS,zones:[]};
    const signature=signProviderRequest('connected-road:v2x','provider-preflight','key-a',NOW_MS,payload,PROVIDER_SECRET);
    const auth=verifyProviderAuth({scope:'connected-road:v2x',providerId:'provider-preflight',keyId:'key-a',signature,timestampMs:NOW_MS,payload:{...payload,zones:[{id:'tampered'}]},registry,nowMs:NOW_MS});
    const observed=auth.ok?'accepted':auth.reason;
    cases.push(result('L2-FI-009','forged/tampered V2X provider payload','provider-signature-invalid',observed,!auth.ok&&auth.reason==='provider-signature-invalid',null));
  }

  {
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-preflight':[{keyId:'key-a',algorithm:'hmac-sha256',secret:PROVIDER_SECRET,state:'active',scopes:['connected-road:v2x']}]}));
    const staleTimestamp=NOW_MS-31_000;
    const payload={providerId:'provider-preflight',timestampMs:staleTimestamp,zones:[]};
    const signature=signProviderRequest('connected-road:v2x','provider-preflight','key-a',staleTimestamp,payload,PROVIDER_SECRET);
    const auth=verifyProviderAuth({scope:'connected-road:v2x',providerId:'provider-preflight',keyId:'key-a',signature,timestampMs:staleTimestamp,payload,registry,nowMs:NOW_MS,maxSkewMs:30_000});
    const observed=auth.ok?'accepted':auth.reason;
    cases.push(result('L2-FI-010','stale signed V2X provider state','provider-clock-skew',observed,!auth.ok&&auth.reason==='provider-clock-skew',null));
  }

  const failed=cases.filter((item)=>!item.passed);
  const physicalScenarios=[...new Set(cases.map((item)=>item.relatedPhysicalScenario).filter((item):item is string=>item!==null))];
  return{
    schema:'kingmast-service-fault-preflight-report/v1' as const,
    generatedAt:new Date().toISOString(),
    productVersion:'0.0.6' as const,
    controlAuthority:'none' as const,
    qualificationClaim:'ci-service-fault-preflight-only-not-physical-hil' as const,
    validationLayer:'L2-service-integration' as const,
    physicalHilExecuted:false,
    physicalHilQualified:false,
    targetHardwareQualified:false,
    total:cases.length,
    passed:cases.length-failed.length,
    failed:failed.length,
    allPassed:failed.length===0,
    cases,
    relatedPhysicalScenarios:physicalScenarios,
    limitations:[
      'This deterministic preflight exercises software fault-handling paths only and does not satisfy any physical HIL scenario.',
      'Related HIL scenario references are traceability hints; every physicalScenarioSatisfied field remains false.',
      'No sensor bench, controller harness, power supply, CAN analyzer, GNSS simulator, radar/camera generator or vehicle target is exercised here.',
      'Level-0 warning-only authority remains unchanged.',
    ],
  };
}
