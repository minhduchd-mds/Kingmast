import type { ConnectedRoadContext,RouteIntelligence,VehiclePosition } from '@kingmast/contracts';
import type { EvidenceMeta,NavigationHorizon,NavigationHorizonEvent,NextgenDataSource } from '@kingmast/contracts/nextgen';

const DEFAULT_LOOKAHEAD_M=5_000;

function sourceOf(value:string):NextgenDataSource{return value==='authorized-provider'||value==='v2x-provider'?'authorized-provider':value==='vehicle-sensor'?'camera':'map';}
function evidence(source:NextgenDataSource,capturedAtMs:number,nowMs:number,confidence:number):EvidenceMeta{return{source,capturedAtMs,receivedAtMs:nowMs,confidence:Math.max(0,Math.min(1,confidence)),health:nowMs-capturedAtMs<=30_000?'ok':'degraded'};}
function within(distanceM:number|null,lookaheadM:number){return distanceM!==null&&Number.isFinite(distanceM)&&distanceM>=0&&distanceM<=lookaheadM;}

export function buildNavigationHorizonFromRoad(input:{vehicleId:string;vehicle:VehiclePosition;intelligence:RouteIntelligence|null;connected:ConnectedRoadContext|null;lookaheadM?:number;nowMs?:number}):NavigationHorizon{
  const nowMs=input.nowMs??Date.now();
  const lookaheadM=Math.max(250,Math.min(20_000,input.lookaheadM??DEFAULT_LOOKAHEAD_M));
  const events:NavigationHorizonEvent[]=[];
  const intelligence=input.intelligence;
  if(intelligence){
    for(const zone of intelligence.speedZones){if(within(zone.distanceAlongRouteM,lookaheadM))events.push({id:`speed:${zone.id}`,kind:'speed-limit',title:`Speed limit ${zone.limitKmh} km/h`,position:zone.position,distanceM:zone.distanceAlongRouteM,severity:'safe',advisorySpeedKmh:zone.limitKmh,curvature1pm:null,gradePct:null,confidence:zone.confidence,evidence:evidence(sourceOf(zone.source),intelligence.generatedAtMs,nowMs,zone.confidence)});}
    for(const junction of intelligence.junctions){if(within(junction.distanceAlongRouteM,lookaheadM))events.push({id:`junction:${junction.id}`,kind:'junction',title:junction.roadName?`Junction · ${junction.roadName}`:'Junction ahead',position:junction.position,distanceM:junction.distanceAlongRouteM,severity:'safe',advisorySpeedKmh:null,curvature1pm:null,gradePct:null,confidence:.8,evidence:evidence('map',intelligence.generatedAtMs,nowMs,.8)});}
  }
  const connected=input.connected;
  if(connected){
    for(const zone of connected.zones){if(zone.active&&within(zone.routeDistanceM,lookaheadM))events.push({id:`zone:${zone.id}`,kind:zone.kind==='school'?'school-zone':'construction-zone',title:zone.name??(zone.kind==='school'?'School zone':'Construction zone'),position:zone.position,distanceM:zone.routeDistanceM!,severity:zone.kind==='school'?'caution':'caution',advisorySpeedKmh:zone.advisorySpeedKmh,curvature1pm:null,gradePct:null,confidence:zone.confidence,evidence:evidence(sourceOf(zone.source),connected.generatedAtMs,nowMs,zone.confidence)});}
    for(const hazard of connected.weather?.hazards??[]){if(within(hazard.distanceM,lookaheadM))events.push({id:`hazard:${hazard.id}`,kind:'hazard',title:hazard.title,position:hazard.position,distanceM:hazard.distanceM!,severity:hazard.severity,advisorySpeedKmh:null,curvature1pm:null,gradePct:null,confidence:hazard.confidence,evidence:evidence(sourceOf(hazard.source),connected.generatedAtMs,nowMs,hazard.confidence)});}
    for(const exit of connected.exits){if(within(exit.distanceM,lookaheadM))events.push({id:`exit:${exit.id}`,kind:'lane-guidance',title:exit.destination??exit.name??'Highway exit',position:exit.position,distanceM:exit.distanceM,severity:'safe',advisorySpeedKmh:null,curvature1pm:null,gradePct:null,confidence:exit.confidence,evidence:evidence(sourceOf(exit.source),connected.generatedAtMs,nowMs,exit.confidence)});}
  }
  events.sort((a,b)=>a.distanceM-b.distanceM||b.confidence-a.confidence);
  const providerBacked=intelligence?.coverage==='provider-backed'||connected?.coverage==='provider-backed';
  const anyData=Boolean(intelligence||connected);
  return{vehicleId:input.vehicleId,generatedAtMs:nowMs,origin:{lat:input.vehicle.lat,lng:input.vehicle.lng},headingDeg:input.vehicle.headingDeg,lookaheadM,coverage:providerBacked?'provider-backed':anyData?'partial':'unavailable',events:events.slice(0,128),notes:anyData?[]:['No road intelligence source available']};
}
