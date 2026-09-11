import type { ConnectedRoadContext,NavigationRoute,RouteIntelligence,VehiclePosition } from '@kingmast/contracts';
import {getConnectedRoadContext} from './connected-road.js';
import {buildNavigationHorizonFromRoad} from './navigation-horizon-adapter.js';
import {NextgenRuntime} from './nextgen-runtime.js';
import {getRouteIntelligence} from './route-intelligence.js';

export interface NextgenNavigationRefreshInput {
  vehicleId:string;
  vehicle:VehiclePosition;
  route:NavigationRoute|null;
  collisionCritical:boolean;
  lookaheadM?:number;
}

export interface NextgenNavigationSources {
  routeIntelligence:(route:NavigationRoute,position:VehiclePosition)=>Promise<RouteIntelligence>;
  connectedRoad:(input:{vehicle:VehiclePosition;route:NavigationRoute|null;collisionCritical:boolean})=>Promise<ConnectedRoadContext>;
}

const defaultSources:NextgenNavigationSources={
  routeIntelligence:(route,position)=>getRouteIntelligence(route,position),
  connectedRoad:(input)=>getConnectedRoadContext(input),
};

export async function refreshNextgenNavigation(runtime:NextgenRuntime,input:NextgenNavigationRefreshInput,sources:NextgenNavigationSources=defaultSources,nowMs=Date.now()){
  const routeTask=input.route?sources.routeIntelligence(input.route,input.vehicle):Promise.resolve<RouteIntelligence|null>(null);
  const [intelligenceResult,connectedResult]=await Promise.allSettled([routeTask,sources.connectedRoad({vehicle:input.vehicle,route:input.route,collisionCritical:input.collisionCritical})]);
  const intelligence=intelligenceResult.status==='fulfilled'?intelligenceResult.value:null;
  const connected=connectedResult.status==='fulfilled'?connectedResult.value:null;
  const horizon=buildNavigationHorizonFromRoad({vehicleId:input.vehicleId,vehicle:input.vehicle,intelligence,connected,lookaheadM:input.lookaheadM,nowMs});
  const advisories=runtime.updateNavigationHorizon(horizon,input.vehicle.speedKmh,nowMs);
  return{
    horizon,
    advisories,
    sources:{routeIntelligence:intelligence===null?'unavailable':'available',connectedRoad:connected===null?'unavailable':'available'},
    controlAuthority:'none' as const,
  };
}
