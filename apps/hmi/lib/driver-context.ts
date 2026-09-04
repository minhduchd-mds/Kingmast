import type { GeoPoint,NavigationRoute,NavigationStep,RoadContext,Severity,TrafficCamera,VehiclePosition } from '@kingmast/contracts';

const EARTH_RADIUS_M=6_371_000;
const toRad=(value:number)=>value*Math.PI/180;
const toDeg=(value:number)=>value*180/Math.PI;

export function distanceMeters(a:GeoPoint,b:GeoPoint){
  const dLat=toRad(b.lat-a.lat);const dLng=toRad(b.lng-a.lng);const lat1=toRad(a.lat),lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS_M*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function bearingDegrees(a:GeoPoint,b:GeoPoint){
  const lat1=toRad(a.lat),lat2=toRad(b.lat),dLng=toRad(b.lng-a.lng);
  const y=Math.sin(dLng)*Math.cos(lat2);const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
  return (toDeg(Math.atan2(y,x))+360)%360;
}

function angularDifference(a:number,b:number){const delta=Math.abs(((a-b+540)%360)-180);return Math.min(180,delta);}

function nearestGeometryIndex(point:GeoPoint,geometry:GeoPoint[]){
  let index=0,best=Number.POSITIVE_INFINITY;
  geometry.forEach((candidate,candidateIndex)=>{const distance=distanceMeters(point,candidate);if(distance<best){best=distance;index=candidateIndex;}});
  return{index,distanceM:best};
}

function cumulativeRouteDistances(geometry:GeoPoint[]){
  const distances:number[]=[0];
  for(let index=1;index<geometry.length;index++)distances[index]=(distances[index-1]??0)+distanceMeters(geometry[index-1]!,geometry[index]!);
  return distances;
}

function routeHeadingAt(geometry:GeoPoint[],index:number){
  const from=geometry[Math.max(0,Math.min(index,geometry.length-2))];const to=geometry[Math.max(1,Math.min(index+1,geometry.length-1))];
  return from&&to?bearingDegrees(from,to):null;
}

export interface RouteCameraContext { camera:TrafficCamera; routeDistanceM:number; corridorDistanceM:number; directionRelevant:boolean; }

export function routeAwareCameras(vehicle:VehiclePosition,route:NavigationRoute|null,cameras:TrafficCamera[],corridorM=85){
  if(!route||route.geometry.length<2)return[] as RouteCameraContext[];
  const geometry=route.geometry;const cumulative=cumulativeRouteDistances(geometry);const vehicleMatch=nearestGeometryIndex(vehicle,geometry);const vehicleProgress=cumulative[vehicleMatch.index]??0;
  return cameras.map((camera)=>{const match=nearestGeometryIndex(camera.position,geometry);const routeHeading=routeHeadingAt(geometry,match.index);const directionRelevant=camera.directionDeg===null||routeHeading===null||angularDifference(camera.directionDeg,routeHeading)<=85;return{camera,routeDistanceM:(cumulative[match.index]??0)-vehicleProgress,corridorDistanceM:match.distanceM,directionRelevant};})
    .filter((item)=>item.routeDistanceM>=-15&&item.routeDistanceM<=5_000&&item.corridorDistanceM<=corridorM&&item.directionRelevant)
    .sort((a,b)=>a.routeDistanceM-b.routeDistanceM);
}

export interface ActiveManeuver { step:NavigationStep; distanceM:number; }

export function activeManeuver(vehicle:VehiclePosition,route:NavigationRoute|null):ActiveManeuver|null {
  if(!route||route.geometry.length<2||route.steps.length===0)return null;
  const cumulative=cumulativeRouteDistances(route.geometry);const vehicleMatch=nearestGeometryIndex(vehicle,route.geometry);const vehicleProgress=cumulative[vehicleMatch.index]??0;
  const candidates=route.steps.map((step)=>{const match=nearestGeometryIndex(step.location,route.geometry);return{step,distanceM:(cumulative[match.index]??0)-vehicleProgress};}).filter((item)=>item.distanceM>=-20).sort((a,b)=>a.distanceM-b.distanceM);
  return candidates[0]??null;
}

export interface RouteProgress { progress:number; traveledM:number; remainingM:number; offRouteM:number; etaS:number; }
export function routeProgress(vehicle:VehiclePosition,route:NavigationRoute|null):RouteProgress|null {
  if(!route||route.geometry.length<2)return null;
  const cumulative=cumulativeRouteDistances(route.geometry);const total=cumulative[cumulative.length-1]??route.distanceM;const match=nearestGeometryIndex(vehicle,route.geometry);const traveled=Math.max(0,cumulative[match.index]??0);const remaining=Math.max(0,total-traveled);const progress=total>0?Math.min(1,traveled/total):0;const etaS=route.distanceM>0?Math.max(0,route.durationS*(remaining/route.distanceM)):0;
  return{progress,traveledM:traveled,remainingM:remaining,offRouteM:match.distanceM,etaS};
}

export function routeRemaining(vehicle:VehiclePosition,route:NavigationRoute|null){return routeProgress(vehicle,route)?.remainingM??null;}

export type DistanceBand='1km'|'500m'|'300m'|'immediate'|null;
export function distanceBand(distanceM:number|null):DistanceBand {
  if(distanceM===null||distanceM<0||distanceM>1_050)return null;
  if(distanceM<=120)return'immediate';
  if(distanceM<=320)return'300m';
  if(distanceM<=520)return'500m';
  return'1km';
}

export function maneuverUrgency(distanceM:number|null){
  if(distanceM===null)return'idle' as const;
  if(distanceM<=80)return'now' as const;
  if(distanceM<=220)return'prepare' as const;
  if(distanceM<=520)return'near' as const;
  return'far' as const;
}

export function laneHint(step:NavigationStep|null){
  if(!step)return'Stay in lane';
  const value=step.instruction.toLowerCase();
  if(value.includes('roundabout'))return'Follow the indicated exit';
  if(value.includes('merge'))return'Prepare to merge';
  if(value.includes('u-turn')||value.includes('uturn'))return'Prepare for U-turn';
  if(value.includes('left'))return'Keep left';
  if(value.includes('right'))return'Keep right';
  return'Stay in lane';
}

export function driverSeverity(base:Severity,context:RoadContext|null):Severity {
  if(base==='critical')return 'critical';
  if(context?.compliance==='over-limit')return 'caution';
  return base;
}

export function speedLimitLabel(context:RoadContext|null){
  const limit=context?.speedLimit.currentKmh??null;
  return{limit,over:context?.compliance==='over-limit',near:context?.compliance==='near-limit',roadName:context?.speedLimit.roadName??null,source:context?.speedLimit.source??'unknown',confidence:context?.speedLimit.confidence??0};
}

export function cameraLabel(camera:TrafficCamera){
  if(camera.kind==='speed-enforcement')return'Speed camera';
  if(camera.kind==='red-light')return'Red-light camera';
  if(camera.kind==='average-speed')return'Average-speed zone';
  if(camera.kind==='traffic-monitoring')return'Traffic camera';
  return'Road camera';
}

export function cameraIsDriverRelevant(camera:TrafficCamera){return camera.kind!=='traffic-monitoring'||camera.speedLimitKmh!==null;}

export function formatDriverDistance(distanceM:number){
  if(distanceM<1_000)return`${Math.max(0,Math.round(distanceM/10)*10)} m`;
  return`${(distanceM/1_000).toFixed(distanceM<10_000?1:0)} km`;
}
