import type { GeoPoint, NavigationRoute, NavigationStep } from '@kingmast/contracts';

const ROUTING_BASE_URL=(process.env.ROUTING_BASE_URL??'https://router.project-osrm.org').replace(/\/$/,'');

interface OsrmStep { distance?:number; duration?:number; name?:string; maneuver?:{type?:string;modifier?:string;location?:[number,number]}; }
interface OsrmRoute { distance?:number; duration?:number; geometry?:{coordinates?:Array<[number,number]>}; legs?:Array<{steps?:OsrmStep[]}>; }
interface OsrmResponse { code?:string; routes?:OsrmRoute[]; }

function instruction(step:OsrmStep){const type=(step.maneuver?.type??'continue').replace(/_/g,' ');const modifier=step.maneuver?.modifier?.replace(/_/g,' ');const road=step.name?.trim();return`${type}${modifier?` ${modifier}`:''}${road?` onto ${road}`:''}`.replace(/^./,(letter)=>letter.toUpperCase());}

export async function calculateNavigationRoute(origin:GeoPoint,destination:GeoPoint):Promise<NavigationRoute>{
  const url=`${ROUTING_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5_000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'KINGMAST-navigation-research/2.2'}});
    if(!response.ok)throw new Error(`routing-http-${response.status}`);
    const raw=await response.json() as OsrmResponse;const route=raw.routes?.[0];if(raw.code!=='Ok'||!route)throw new Error('route-unavailable');
    const geometry=(route.geometry?.coordinates??[]).slice(0,1200).map(([lng,lat])=>({lat,lng}));
    const steps:NavigationStep[]=(route.legs??[]).flatMap((leg)=>leg.steps??[]).slice(0,80).map((step)=>{const location=step.maneuver?.location??[origin.lng,origin.lat];return{instruction:instruction(step),distanceM:step.distance??0,durationS:step.duration??0,location:{lng:location[0],lat:location[1]},roadName:step.name?.trim()||null};});
    return{provider:'osrm',origin,destination,distanceM:route.distance??0,durationS:route.duration??0,geometry,steps,fetchedAtMs:Date.now()};
  }finally{clearTimeout(timer);}
}
