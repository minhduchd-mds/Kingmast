import type {
  ConnectedRoadAdvisory,
  ConnectedRoadContext,
  ConnectedRoadProviderSnapshot,
  ConnectedRoadProviderStatus,
  ConnectedRoadSource,
  EmergencyVehicleAdvisory,
  GeoPoint,
  HighwayExitGuidance,
  LaneTopology,
  NavigationRoute,
  RoadZoneContext,
  Severity,
  SpatIntersectionState,
  VehiclePosition,
  WeatherRoadContext,
} from '@kingmast/contracts';
import { distanceMeters,projectPoint } from './geo.js';

const snapshots=new Map<string,ConnectedRoadProviderSnapshot>();
const MAX_AGE={spat:5_000,emergency:8_000,weather:15*60_000,topology:30*60_000,zones:6*60*60_000};
const severityRank:Record<Severity,number>={safe:0,caution:1,critical:2};

function normalizeAngle(value:number){return((value%360)+360)%360;}
function angleDifference(a:number,b:number){return Math.abs(((normalizeAngle(a)-normalizeAngle(b)+540)%360)-180);}
function cumulative(geometry:GeoPoint[]){const values=[0];for(let index=1;index<geometry.length;index++)values[index]=(values[index-1]??0)+distanceMeters(geometry[index-1]!,geometry[index]!);return values;}
function routeDistance(point:GeoPoint,vehicle:GeoPoint,route:NavigationRoute|null){
  if(!route||route.geometry.length<2)return distanceMeters(vehicle,point);
  const distances=cumulative(route.geometry);let vehicleIndex=0,pointIndex=0,vehicleBest=Infinity,pointBest=Infinity;
  route.geometry.forEach((candidate,index)=>{const vd=distanceMeters(vehicle,candidate);if(vd<vehicleBest){vehicleBest=vd;vehicleIndex=index;}const pd=distanceMeters(point,candidate);if(pd<pointBest){pointBest=pd;pointIndex=index;}});
  if(pointBest>220)return distanceMeters(vehicle,point);
  return(distances[pointIndex]??0)-(distances[vehicleIndex]??0);
}
function fresh(timestampMs:number,maxAgeMs:number,nowMs:number){return timestampMs<=nowMs+30_000&&nowMs-timestampMs<=maxAgeMs;}
function activeZone(zone:RoadZoneContext,nowMs:number){return zone.active&&(zone.startsAtMs===null||zone.startsAtMs<=nowMs)&&(zone.endsAtMs===null||zone.endsAtMs>=nowMs);}
function advisory(id:string,category:ConnectedRoadAdvisory['category'],severity:Severity,priority:number,title:string,message:string,distanceM:number|null,dedupeKey:string,source:ConnectedRoadSource,expiresAtMs:number|null=null,suppressible=true):ConnectedRoadAdvisory{return{id,category,severity,priority,title,message,distanceM,dedupeKey,suppressible,expiresAtMs,source};}
function snapshotUsesLiveV2x(snapshot:ConnectedRoadProviderSnapshot){return(snapshot.spat??[]).some((item)=>item.source==='v2x-provider')||(snapshot.emergencyVehicles??[]).some((item)=>item.source==='v2x-provider');}
function snapshotLiveV2xTrusted(snapshot:ConnectedRoadProviderSnapshot,nowMs:number){const security=snapshot.security;if(!security)return false;if(security.certificateExpiresAtMs!==null&&security.certificateExpiresAtMs<=nowMs)return false;return security.trustStatus==='verified'||security.trustStatus==='expiring';}
function sourceAllowed(source:ConnectedRoadSource,snapshot:ConnectedRoadProviderSnapshot,nowMs:number){return source!=='v2x-provider'||snapshotLiveV2xTrusted(snapshot,nowMs);}

function simulator(vehicle:VehiclePosition,route:NavigationRoute|null,nowMs:number){
  const signalPoint=projectPoint(vehicle,vehicle.headingDeg,420);const schoolPoint=projectPoint(vehicle,vehicle.headingDeg,760);const worksPoint=projectPoint(vehicle,vehicle.headingDeg,1_450);const exitPoint=projectPoint(vehicle,vehicle.headingDeg,2_350);
  const spat:SpatIntersectionState[]=[{intersectionId:'sim-spat-01',name:'Demo intersection',position:signalPoint,approachHeadingDeg:vehicle.headingDeg,movements:[{signalGroup:1,state:'protected-movement-allowed',minEndTimeMs:nowMs+12_000,maxEndTimeMs:nowMs+18_000,confidence:.82}],timestampMs:nowMs,source:'simulator'}];
  const zones:RoadZoneContext[]=[{id:'sim-school-01',kind:'school',name:'School zone',position:schoolPoint,radiusM:220,active:true,advisorySpeedKmh:30,routeDistanceM:routeDistance(schoolPoint,vehicle,route),startsAtMs:null,endsAtMs:null,source:'simulator',confidence:.82},{id:'sim-works-01',kind:'construction',name:'Road works',position:worksPoint,radiusM:320,active:true,advisorySpeedKmh:40,routeDistanceM:routeDistance(worksPoint,vehicle,route),startsAtMs:null,endsAtMs:null,source:'simulator',confidence:.78}];
  const weather:WeatherRoadContext={condition:'rain',temperatureC:27,precipitationMmH:2.4,visibilityM:4_000,windKmh:18,roadSurface:'wet',hazards:[],timestampMs:nowMs,source:'simulator',confidence:.7};
  const laneTopology:LaneTopology={roadName:'Demo arterial',roadRef:null,laneCount:3,currentLaneIndex:1,lanes:[{index:0,maneuvers:['straight'],preferred:false,exitOnly:false,destination:null},{index:1,maneuvers:['straight','right'],preferred:true,exitOnly:false,destination:null},{index:2,maneuvers:['right','exit'],preferred:false,exitOnly:true,destination:'City Center'}],drivingSide:'right',source:'simulator',confidence:.8,timestampMs:nowMs};
  const exits:HighwayExitGuidance[]=[{id:'sim-exit-01',position:exitPoint,ref:'E3',name:'Demo Expressway Exit',destination:'City Center',distanceM:Math.max(0,routeDistance(exitPoint,vehicle,route)),side:'right',targetLaneIndexes:[2],source:'simulator',confidence:.78}];
  return{spat,zones,weather,emergencyVehicles:[] as EmergencyVehicleAdvisory[],laneTopology,exits};
}

function merge(nowMs:number){
  const spat:SpatIntersectionState[]=[];const zones:RoadZoneContext[]=[];const emergencyVehicles:EmergencyVehicleAdvisory[]=[];const exits:HighwayExitGuidance[]=[];let weather:WeatherRoadContext|null=null;let laneTopology:LaneTopology|null=null;
  for(const snapshot of snapshots.values()){
    for(const item of snapshot.spat??[])if(sourceAllowed(item.source,snapshot,nowMs)&&fresh(item.timestampMs,MAX_AGE.spat,nowMs))spat.push(item);
    for(const zone of snapshot.zones??[])if(sourceAllowed(zone.source,snapshot,nowMs)&&fresh(snapshot.timestampMs,MAX_AGE.zones,nowMs))zones.push(zone);
    for(const item of snapshot.emergencyVehicles??[])if(sourceAllowed(item.source,snapshot,nowMs)&&fresh(item.timestampMs,MAX_AGE.emergency,nowMs))emergencyVehicles.push(item);
    for(const exit of snapshot.exits??[])if(sourceAllowed(exit.source,snapshot,nowMs)&&fresh(snapshot.timestampMs,MAX_AGE.topology,nowMs))exits.push(exit);
    if(snapshot.weather&&sourceAllowed(snapshot.weather.source,snapshot,nowMs)&&fresh(snapshot.weather.timestampMs,MAX_AGE.weather,nowMs)&&(!weather||snapshot.weather.timestampMs>weather.timestampMs))weather=snapshot.weather;
    if(snapshot.laneTopology&&sourceAllowed(snapshot.laneTopology.source,snapshot,nowMs)&&fresh(snapshot.laneTopology.timestampMs,MAX_AGE.topology,nowMs)&&(!laneTopology||snapshot.laneTopology.timestampMs>laneTopology.timestampMs))laneTopology=snapshot.laneTopology;
  }
  return{spat,zones,weather,emergencyVehicles,laneTopology,exits};
}

function candidates(input:{vehicle:VehiclePosition;route:NavigationRoute|null;spat:SpatIntersectionState[];zones:RoadZoneContext[];weather:WeatherRoadContext|null;emergencyVehicles:EmergencyVehicleAdvisory[];laneTopology:LaneTopology|null;exits:HighwayExitGuidance[];nowMs:number}){
  const out:ConnectedRoadAdvisory[]=[];const{vehicle,route,nowMs}=input;
  for(const emergency of input.emergencyVehicles){const distance=emergency.distanceM??distanceMeters(vehicle,emergency.position);if(emergency.approach!=='approaching'||distance>1_500)continue;out.push(advisory(`emergency-${emergency.id}`,'emergency-vehicle',distance<=280?'critical':'caution',100,'Emergency vehicle approaching',`${emergency.kind==='unknown'?'Emergency vehicle':emergency.kind} ${Math.round(distance)} m away. Keep a safe path and follow local rules.`,distance,`emergency:${emergency.id}`,emergency.source,nowMs+4_000,false));}
  for(const intersection of input.spat){const distance=routeDistance(intersection.position,vehicle,route);if(distance<0||distance>1_000)continue;if(intersection.approachHeadingDeg!==null&&angleDifference(vehicle.headingDeg,intersection.approachHeadingDeg)>75)continue;const movement=intersection.movements[0];if(!movement)continue;if(movement.state==='stop-and-remain'&&distance<=450)out.push(advisory(`spat-${intersection.intersectionId}`,'spat','caution',88,'Signal ahead',`Connected signal reports red${movement.minEndTimeMs?` for at least ${Math.max(0,Math.ceil((movement.minEndTimeMs-nowMs)/1000))} s`:''}.`,distance,`spat:${intersection.intersectionId}`,intersection.source,movement.maxEndTimeMs));if((movement.state==='protected-clearance'||movement.state==='permissive-clearance')&&distance<=300)out.push(advisory(`spat-${intersection.intersectionId}`,'spat','caution',82,'Signal changing',`Signal phase is clearing in ${Math.round(distance)} m.`,distance,`spat:${intersection.intersectionId}`,intersection.source,movement.maxEndTimeMs));}
  for(const zone of input.zones){if(!activeZone(zone,nowMs))continue;const distance=zone.routeDistanceM??routeDistance(zone.position,vehicle,route);if(distance<-zone.radiusM||distance>2_000)continue;const inside=distance<=zone.radiusM;const overspeed=zone.advisorySpeedKmh!==null&&vehicle.speedKmh>zone.advisorySpeedKmh+3;const severity:Severity=inside&&overspeed?'caution':distance<=600?'caution':'safe';const title=zone.kind==='school'?(inside?'School zone':'School zone ahead'):(inside?'Construction zone':'Road works ahead');const speedPart=zone.advisorySpeedKmh?` · ${zone.advisorySpeedKmh} km/h advisory`:'';out.push(advisory(`zone-${zone.id}`,zone.kind==='school'?'school-zone':'construction-zone',severity,zone.kind==='school'?72:76,title,`${inside?'Zone active':'Approaching'}${speedPart}. Verify posted signs.`,Math.max(0,distance),`zone:${zone.id}`,zone.source,zone.endsAtMs));}
  if(input.weather){const weather=input.weather;const reduced=(weather.visibilityM!==null&&weather.visibilityM<1_000)||['heavy-rain','fog','storm','snow'].includes(weather.condition)||['standing-water','icy','snow-covered'].includes(weather.roadSurface);if(reduced)out.push(advisory('weather-context','weather','caution',66,'Reduced road conditions',`${weather.condition.replace('-',' ')} · ${weather.roadSurface} surface${weather.visibilityM?` · ${Math.round(weather.visibilityM)} m visibility`:''}.`,null,'weather:context',weather.source,weather.timestampMs+MAX_AGE.weather));for(const hazard of weather.hazards){const distance=hazard.distanceM??distanceMeters(vehicle,hazard.position);if(distance<=2_000)out.push(advisory(`hazard-${hazard.id}`,'road-hazard',hazard.severity,84,hazard.title,`${hazard.kind.replace('-',' ')} reported ${Math.round(distance)} m away.`,distance,`hazard:${hazard.id}`,hazard.source,hazard.expiresAtMs));}}
  if(input.laneTopology&&route){const preferred=input.laneTopology.lanes.filter((lane)=>lane.preferred).map((lane)=>lane.index+1);if(preferred.length)out.push(advisory('lane-guidance','lane-guidance','safe',32,'Lane guidance',`Prefer lane ${preferred.join(', ')} of ${input.laneTopology.laneCount} for the upcoming route.`,null,'lane:guidance',input.laneTopology.source,input.laneTopology.timestampMs+MAX_AGE.topology));}
  const nextExit=input.exits.filter((exit)=>exit.distanceM>=0&&exit.distanceM<=5_000).sort((a,b)=>a.distanceM-b.distanceM)[0];if(nextExit){const lanes=nextExit.targetLaneIndexes.length?` · lane ${nextExit.targetLaneIndexes.map((value)=>value+1).join(', ')}`:'';out.push(advisory(`exit-${nextExit.id}`,'highway-exit',nextExit.distanceM<750?'caution':'safe',nextExit.distanceM<750?58:36,`Exit ${nextExit.ref??nextExit.name??'ahead'}`,`${nextExit.destination??nextExit.name??'Highway exit'} in ${Math.round(nextExit.distanceM)} m${nextExit.side!=='unknown'?` · ${nextExit.side}`:''}${lanes}.`,nextExit.distanceM,`exit:${nextExit.id}`,nextExit.source));}
  return out;
}

export function suppressConnectedRoadAdvisories(items:ConnectedRoadAdvisory[],collisionCritical:boolean,nowMs=Date.now()){
  const live=items.filter((item)=>item.expiresAtMs===null||item.expiresAtMs>=nowMs);if(collisionCritical)return{advisories:[] as ConnectedRoadAdvisory[],suppressedCount:live.length,suppressionReason:'collision-critical-warning-active'};
  const hasSpecificHazard=live.some((item)=>item.category==='road-hazard');const deduped=new Map<string,ConnectedRoadAdvisory>();for(const item of live){if(hasSpecificHazard&&item.category==='weather')continue;const previous=deduped.get(item.dedupeKey);if(!previous||severityRank[item.severity]>severityRank[previous.severity]||item.priority>previous.priority)deduped.set(item.dedupeKey,item);}
  const sorted=[...deduped.values()].sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]||b.priority-a.priority||(a.distanceM??Infinity)-(b.distanceM??Infinity));const advisories=sorted.slice(0,3);return{advisories,suppressedCount:Math.max(0,live.length-advisories.length),suppressionReason:live.length>advisories.length?'priority-and-deduplication':null};
}

export function replaceConnectedRoadProvider(snapshot:ConnectedRoadProviderSnapshot){snapshots.set(snapshot.providerId,snapshot);return snapshot;}
export function configuredConnectedRoadProviderCount(){return snapshots.size;}
export function clearConnectedRoadProviders(){snapshots.clear();}
export function connectedRoadProviderStatus(nowMs=Date.now()):ConnectedRoadProviderStatus[]{return[...snapshots.values()].map((snapshot)=>{const snapshotAgeMs=Math.max(0,nowMs-snapshot.timestampMs);const usesLiveV2x=snapshotUsesLiveV2x(snapshot);const liveV2xTrusted=usesLiveV2x&&snapshotLiveV2xTrusted(snapshot,nowMs);const security=snapshot.security??null;const securityBad=security!==null&&(['expired','revoked','untrusted'].includes(security.trustStatus)||(security.certificateExpiresAtMs!==null&&security.certificateExpiresAtMs<=nowMs));const state:ConnectedRoadProviderStatus['state']=snapshotAgeMs>MAX_AGE.topology?'stale':(usesLiveV2x&&!liveV2xTrusted)||securityBad?'degraded':'healthy';return{providerId:snapshot.providerId,snapshotAgeMs,state,security,liveV2xTrusted};}).sort((a,b)=>a.providerId.localeCompare(b.providerId));}

export async function getConnectedRoadContext(input:{vehicle:VehiclePosition;route:NavigationRoute|null;collisionCritical:boolean}):Promise<ConnectedRoadContext>{
  const nowMs=Date.now();const provider=merge(nowMs);const demo=input.vehicle.source==='simulator'?simulator(input.vehicle,input.route,nowMs):null;const spat=provider.spat.length?provider.spat:(demo?.spat??[]);const zones=(provider.zones.length?provider.zones:(demo?.zones??[])).map((zone)=>({...zone,routeDistanceM:zone.routeDistanceM??routeDistance(zone.position,input.vehicle,input.route)}));const weather=provider.weather??demo?.weather??null;const emergencyVehicles=provider.emergencyVehicles.length?provider.emergencyVehicles:(demo?.emergencyVehicles??[]);const laneTopology=provider.laneTopology??demo?.laneTopology??null;const exits=(provider.exits.length?provider.exits:(demo?.exits??[])).sort((a,b)=>a.distanceM-b.distanceM);const built=candidates({vehicle:input.vehicle,route:input.route,spat,zones,weather,emergencyVehicles,laneTopology,exits,nowMs});const suppressed=suppressConnectedRoadAdvisories(built,input.collisionCritical,nowMs);const providerBacked=provider.spat.length>0||provider.zones.length>0||provider.weather!==null||provider.emergencyVehicles.length>0||provider.laneTopology!==null||provider.exits.length>0;const coverage:ConnectedRoadContext['coverage']=providerBacked?'provider-backed':demo?'simulator':'unavailable';
  return{spat,zones,weather,emergencyVehicles,laneTopology,exits,advisories:suppressed.advisories,suppressedCount:suppressed.suppressedCount,suppressionReason:suppressed.suppressionReason,coverage,generatedAtMs:nowMs,notes:['Connected-road data is advisory only and never creates steering, braking, throttle or CAN-write authority.','Live SPaT and emergency-vehicle state from a V2X provider is accepted only when provider security is verified or explicitly expiring and the certificate is not expired.','School/construction, weather, lane and exit data may be incomplete. Posted signs, signals, road conditions and driver observation remain authoritative.']};
}