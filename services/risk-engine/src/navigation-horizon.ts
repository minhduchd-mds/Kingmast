import type { GeoPoint } from '@kingmast/contracts';
import type { NavigationHorizon,NavigationHorizonEvent } from '@kingmast/contracts/nextgen';

const DEFAULT_LOOKAHEAD_M=2_000;
const MAX_LOOKAHEAD_M=10_000;
const MAX_EVENT_AGE_MS=60_000;
const MAX_FUTURE_SKEW_MS=5_000;

export interface BuildNavigationHorizonInput {
  vehicleId:string;
  origin:GeoPoint;
  headingDeg:number;
  events:NavigationHorizonEvent[];
  lookaheadM?:number;
  nowMs?:number;
  coverage?:NavigationHorizon['coverage'];
}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function finite(value:number){return Number.isFinite(value);}

function eventEligible(event:NavigationHorizonEvent,nowMs:number,lookaheadM:number){
  if(!event.id||!finite(event.distanceM)||event.distanceM<0||event.distanceM>lookaheadM)return false;
  if(!finite(event.confidence)||event.confidence<0||event.confidence>1)return false;
  const capturedAtMs=event.evidence.capturedAtMs;
  if(!finite(capturedAtMs))return false;
  if(capturedAtMs>nowMs+MAX_FUTURE_SKEW_MS)return false;
  if(nowMs-capturedAtMs>MAX_EVENT_AGE_MS)return false;
  if(event.evidence.health==='unavailable')return false;
  return true;
}

export function buildNavigationHorizon(input:BuildNavigationHorizonInput):NavigationHorizon{
  const nowMs=input.nowMs??Date.now();
  const lookaheadM=clamp(input.lookaheadM??DEFAULT_LOOKAHEAD_M,100,MAX_LOOKAHEAD_M);
  const unique=new Map<string,NavigationHorizonEvent>();
  for(const event of input.events){
    if(!eventEligible(event,nowMs,lookaheadM))continue;
    const previous=unique.get(event.id);
    if(!previous||event.evidence.capturedAtMs>previous.evidence.capturedAtMs)unique.set(event.id,event);
  }
  const events=[...unique.values()].sort((a,b)=>a.distanceM-b.distanceM||b.severity.localeCompare(a.severity)||b.confidence-a.confidence);
  const coverage=input.coverage??(events.length?'partial':'unavailable');
  const notes:string[]=[];
  if(!events.length)notes.push('No fresh trusted horizon events are currently available.');
  if(events.some((event)=>event.evidence.health==='degraded'))notes.push('Some horizon inputs are degraded; advisories remain informational.');
  return{
    vehicleId:input.vehicleId,
    generatedAtMs:nowMs,
    origin:input.origin,
    headingDeg:((input.headingDeg%360)+360)%360,
    lookaheadM,
    coverage,
    events,
    notes,
  };
}

export function nextNavigationAdvisory(horizon:NavigationHorizon){
  return horizon.events.find((event)=>event.severity==='critical')??horizon.events.find((event)=>event.severity==='caution')??horizon.events[0]??null;
}
