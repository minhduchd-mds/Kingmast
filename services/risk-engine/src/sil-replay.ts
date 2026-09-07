import type { RiskAssessment, VehicleSample } from '@kingmast/contracts';
import { assessRisk } from './risk.js';

export interface SilRiskExpectation {
  severity:RiskAssessment['severity'];
  reasonsInclude:string[];
  confidenceMax?:number;
  ttcMax?:number;
  ttcNull?:boolean;
  thwNull?:boolean;
}

export interface SilRiskReplayCase {
  scenarioId:string;
  nowMs:number;
  sample:VehicleSample;
  expected:SilRiskExpectation;
}

export interface SilRiskReplayResult {
  scenarioId:string;
  passed:boolean;
  failures:string[];
  actual:RiskAssessment;
}

function closeEnoughLessOrEqual(value:number|null,limit:number,label:string,failures:string[]){
  if(value===null||value>limit)failures.push(`${label} expected <= ${limit}, got ${value===null?'null':value}`);
}

export function runSilRiskReplayCase(input:SilRiskReplayCase):SilRiskReplayResult{
  const actual=assessRisk(input.sample,input.nowMs);
  const failures:string[]=[];
  const expected=input.expected;
  if(actual.severity!==expected.severity)failures.push(`severity expected ${expected.severity}, got ${actual.severity}`);
  for(const reason of expected.reasonsInclude)if(!actual.reasons.includes(reason))failures.push(`missing reason ${reason}`);
  if(expected.confidenceMax!==undefined&&actual.confidence>expected.confidenceMax)failures.push(`confidence expected <= ${expected.confidenceMax}, got ${actual.confidence}`);
  if(expected.ttcNull===true&&actual.ttcS!==null)failures.push(`ttcS expected null, got ${actual.ttcS}`);
  if(expected.thwNull===true&&actual.thwS!==null)failures.push(`thwS expected null, got ${actual.thwS}`);
  if(expected.ttcMax!==undefined)closeEnoughLessOrEqual(actual.ttcS,expected.ttcMax,'ttcS',failures);
  return{scenarioId:input.scenarioId,passed:failures.length===0,failures,actual};
}

export function runSilRiskReplaySuite(cases:SilRiskReplayCase[]){
  const ids=new Set<string>();
  const results:SilRiskReplayResult[]=[];
  for(const replay of cases){
    if(!replay.scenarioId||ids.has(replay.scenarioId)){
      results.push({scenarioId:replay.scenarioId||'<missing>',passed:false,failures:['scenarioId must be unique and non-empty'],actual:{severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['invalid-replay-case']}});
      continue;
    }
    ids.add(replay.scenarioId);
    results.push(runSilRiskReplayCase(replay));
  }
  return{
    schema:'kingmast-sil-replay-report/v1' as const,
    mode:'warning-only' as const,
    controlAuthority:'none' as const,
    total:results.length,
    passed:results.filter((result)=>result.passed).length,
    failed:results.filter((result)=>!result.passed).length,
    allPassed:results.length>0&&results.every((result)=>result.passed),
    results,
  };
}
