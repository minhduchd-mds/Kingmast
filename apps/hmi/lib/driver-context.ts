import type { GeoPoint,NavigationRoute,NavigationStep,RoadContext,Severity,TrafficCamera,VehiclePosition } from '@kingmast/contracts';

const EARTH_RADIUS_M=6_371_000;
const toRad=(value:number)=>value*Math.PI/180;

export function distanceMeters(a:GeoPoint,b:GeoPoint){
  const dLat=toRad(b.lat-a.lat);const dLng=toRad(b.lng-a.lng);const lat1=toRad(a.lat),lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS_M*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

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

export interface RouteCameraContext { camera:TrafficCamera; routeDistanceM:number; corridorDistanceM:number; }

export function routeAwareCameras(vehicle:VehiclePosition,route:NavigationRoute|null,cameras:TrafficCamera[],corridorM=90){
  if(!route||route.geometry.length<2)return[] as RouteCameraContext[];
  const geometry=route.geometry;const cumulative=cumulativeRouteDistances(geometry);const vehicleMatch=nearestGeometryIndex(vehicle,geometry);const vehicleProgress=cumulative[vehicleMatch.index]??0;
  return cameras.map((camera)=>{const match=nearestGeometryIndex(camera.position,geometry);return{camera,routeDistanceM:(cumulative[match.index]??0)-vehicleProgress,corridorDistanceM:match.distanceM};})
    .filter((item)=>item.routeDistanceM>=-15&&item.routeDistanceM<=5_000&&item.corridorDistanceM<=corridorM)
    .sort((a,b)=>a.routeDistanceM-b.routeDistanceM);
}

export interface ActiveManeuver { step:NavigationStep; distanceM:number; }

export function activeManeuver(vehicle:VehiclePosition,route:NavigationRoute|null):ActiveManeuver|null {
  if(!route||route.geometry.length<2||route.steps.length===0)return null;
  const cumulative=cumulativeRouteDistances(route.geometry);const vehicleMatch=nearestGeometryIndex(vehicle,route.geometry);const vehicleProgress=cumulative[vehicleMatch.index]??0;
  const candidates=route.steps.map((step)=>{const match=nearestGeometryIndex(step.location,route.geometry);return{step,distanceM:(cumulative[match.index]??0)-vehicleProgress};}).filter((item)=>item.distanceM>=-20).sort((a,b)=>a.distanceM-b.distanceM);
  return candidates[0]??null;
}

export function routeRemaining(vehicle:VehiclePosition,route:NavigationRoute|null){
  if(!route||route.geometry.length<2)return null;
  const cumulative=cumulativeRouteDistances(route.geometry);const total=cumulative[cumulative.length-1]??route.distanceM;const vehicleMatch=nearestGeometryIndex(vehicle,route.geometry);return Math.max(0,total-(cumulative[vehicleMatch.index]??0));
}

export function driverSeverity(base:Severity,context:RoadContext|null):Severity {
  if(base==='critical')return 'critical';
  if(context?.compliance==='over-limit')return 'caution';
  return base;
}

export function speedLimitLabel(context:RoadContext|null){
  const limit=context?.speedLimit.currentKmh??null;
  return{limit,over:context?.compliance==='over-limit',near:context?.compliance==='near-limit',roadName:context?.speedLimit.roadName??null,source:context?.speedLimit.source??'unknown'};
}

export function cameraLabel(camera:TrafficCamera){
  if(camera.kind==='speed-enforcement')return'Speed camera';
  if(camera.kind==='red-light')return'Red-light camera';
  if(camera.kind==='average-speed')return'Average-speed zone';
  if(camera.kind==='traffic-monitoring')return'Traffic camera';
  return'Road camera';
}

export function formatDriverDistance(distanceM:number){
  if(distanceM<1_000)return`${Math.max(0,Math.round(distanceM/10)*10)} m`;
  return`${(distanceM/1_000).toFixed(distanceM<10_000?1:0)} km`;
}
