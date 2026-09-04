import type { ConnectedRoadContext, NavigationRoute, VehiclePosition } from '@kingmast/contracts';

export type RoadEventKind='emergency'|'roadwork'|'spat'|'arrival';
export type RoadEventTone='neutral'|'positive'|'caution'|'critical';

export interface RoadEventPresentation{
  kind:RoadEventKind;
  tone:RoadEventTone;
  title:string;
  message:string;
  distanceM:number|null;
  meta:string|null;
  laneCount?:number;
  currentLaneIndex?:number|null;
  preferredLaneIndexes?:number[];
}

const EARTH_RADIUS_M=6_371_000;
function toRad(value:number){return value*Math.PI/180;}
export function distanceMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}){
  const dLat=toRad(b.lat-a.lat);const dLng=toRad(b.lng-a.lng);const lat1=toRad(a.lat);const lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS_M*Math.asin(Math.min(1,Math.sqrt(h)));
}

export function arrivalPresentation(vehicle:VehiclePosition,route:NavigationRoute|null):RoadEventPresentation|null{
  if(!route)return null;
  const distanceM=distanceMeters(vehicle,route.destination);
  if(distanceM<=25)return{kind:'arrival',tone:'positive',title:'Destination reached',message:'Route guidance complete. Park safely before changing trip settings.',distanceM,meta:'Arrival'};
  if(distanceM<=120)return{kind:'arrival',tone:'neutral',title:'Arriving',message:`Destination is ${Math.max(1,Math.round(distanceM))} m ahead.`,distanceM,meta:'Final approach'};
  return null;
}

export function emergencyPresentation(context:ConnectedRoadContext):RoadEventPresentation|null{
  const advisory=context.advisories.find((item)=>item.category==='emergency-vehicle');
  if(!advisory)return null;
  const vehicle=context.emergencyVehicles.filter((item)=>item.approach==='approaching'&&item.confidence>=.65).sort((a,b)=>(a.distanceM??Infinity)-(b.distanceM??Infinity))[0];
  return{kind:'emergency',tone:advisory.severity==='critical'?'critical':'caution',title:advisory.title,message:advisory.message,distanceM:advisory.distanceM,meta:vehicle?`${vehicle.kind==='unknown'?'Emergency':vehicle.kind} · verify mirrors`:'Verify mirrors and yield safely'};
}

export function roadworkPresentation(context:ConnectedRoadContext):RoadEventPresentation|null{
  const advisory=context.advisories.find((item)=>item.category==='construction-zone');
  if(!advisory)return null;
  const topology=context.laneTopology;
  const preferred=topology?.lanes.filter((lane)=>lane.preferred).map((lane)=>lane.index)??[];
  const current=topology?.currentLaneIndex??null;
  let guidance='Follow signed lane guidance';
  if(current!==null&&preferred.length){
    const target=preferred.sort((a,b)=>Math.abs(a-current)-Math.abs(b-current))[0]!;
    guidance=target<current?'Prepare to merge left':target>current?'Prepare to merge right':'Stay in the preferred lane';
  }
  return{kind:'roadwork',tone:advisory.severity==='critical'?'critical':'caution',title:advisory.title,message:advisory.message,distanceM:advisory.distanceM,meta:guidance,laneCount:topology?.laneCount,currentLaneIndex:current,preferredLaneIndexes:preferred};
}

export function spatPresentation(context:ConnectedRoadContext,nowMs:number):RoadEventPresentation|null{
  const advisory=context.advisories.find((item)=>item.category==='spat');if(!advisory)return null;
  const intersection=context.spat.find((item)=>advisory.id===`spat-${item.intersectionId}`);const movement=intersection?.movements[0];
  if(!movement)return{kind:'spat',tone:'caution',title:advisory.title,message:advisory.message,distanceM:advisory.distanceM,meta:'Live signal context'};
  const state=movement.state;
  const tone:RoadEventTone=state==='protected-movement-allowed'||state==='permissive-movement-allowed'?'positive':state==='dark'||state==='unknown'?'neutral':'caution';
  const phaseLabel=state==='stop-and-remain'?'Red signal':state.includes('movement-allowed')?'Proceed signal':state.includes('clearance')?'Signal changing':state==='dark'?'Signal unavailable':'Signal state unknown';
  const remaining=movement.minEndTimeMs!==null&&movement.minEndTimeMs>nowMs&&movement.minEndTimeMs-nowMs<120_000?Math.ceil((movement.minEndTimeMs-nowMs)/1000):null;
  return{kind:'spat',tone,title:advisory.title,message:advisory.message,distanceM:advisory.distanceM,meta:remaining!==null?`${phaseLabel} · ~${remaining}s minimum`:`${phaseLabel} · verify physical signal`};
}

export function primaryRoadEvent(context:ConnectedRoadContext,vehicle:VehiclePosition,route:NavigationRoute|null,nowMs:number):RoadEventPresentation|null{
  return emergencyPresentation(context)??roadworkPresentation(context)??spatPresentation(context,nowMs)??arrivalPresentation(vehicle,route);
}
