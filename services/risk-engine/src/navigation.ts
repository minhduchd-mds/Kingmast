import type { GeoPoint,NavigationPlace,NavigationRoute,NavigationStep } from '@kingmast/contracts';

const ROUTING_BASE_URL=(process.env.ROUTING_BASE_URL??'https://router.project-osrm.org').replace(/\/$/,'');
const GEOCODING_BASE_URL=(process.env.GEOCODING_BASE_URL??'https://nominatim.openstreetmap.org').replace(/\/$/,'');

interface OsrmStep { distance?:number; duration?:number; name?:string; maneuver?:{type?:string;modifier?:string;location?:[number,number]}; }
interface OsrmRoute { distance?:number; duration?:number; geometry?:{coordinates?:Array<[number,number]>}; legs?:Array<{steps?:OsrmStep[]}>; }
interface OsrmResponse { code?:string; routes?:OsrmRoute[]; }
interface GeocoderItem { place_id?:number|string; lat?:string; lon?:string; display_name?:string; name?:string; type?:string; }

function instruction(step:OsrmStep){const type=(step.maneuver?.type??'continue').replace(/_/g,' ');const modifier=step.maneuver?.modifier?.replace(/_/g,' ');const road=step.name?.trim();return`${type}${modifier?` ${modifier}`:''}${road?` onto ${road}`:''}`.replace(/^./,(letter)=>letter.toUpperCase());}

export function parseNavigationPlaces(raw:unknown):NavigationPlace[]{
  if(!Array.isArray(raw))return[];
  return raw.slice(0,6).map((value,index)=>{if(!value||typeof value!=='object')return null;const item=value as GeocoderItem;const lat=Number(item.lat),lng=Number(item.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return null;const display=(item.display_name??'').trim();const name=(item.name??display.split(',')[0]??'Destination').trim()||'Destination';const subtitle=display&&display!==name?display:null;return{id:String(item.place_id??`${lat}:${lng}:${index}`),name,subtitle,position:{lat,lng},source:'geocoder' as const};}).filter((value):value is NavigationPlace=>value!==null);
}

export async function searchNavigationPlaces(query:string,near?:GeoPoint):Promise<NavigationPlace[]>{
  const trimmed=query.trim();if(trimmed.length<2)return[];
  const url=new URL(`${GEOCODING_BASE_URL}/search`);url.searchParams.set('format','jsonv2');url.searchParams.set('q',trimmed);url.searchParams.set('limit','6');url.searchParams.set('addressdetails','0');
  if(near){const d=.28;url.searchParams.set('viewbox',`${near.lng-d},${near.lat+d},${near.lng+d},${near.lat-d}`);url.searchParams.set('bounded','0');}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4_500);
  try{const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'KINGMAST-navigation-research/2.3'}});if(!response.ok)throw new Error(`geocoding-http-${response.status}`);return parseNavigationPlaces(await response.json());}finally{clearTimeout(timer);}
}

export async function calculateNavigationRoute(origin:GeoPoint,destination:GeoPoint):Promise<NavigationRoute>{
  const url=`${ROUTING_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5_000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'KINGMAST-navigation-research/2.3'}});
    if(!response.ok)throw new Error(`routing-http-${response.status}`);
    const raw=await response.json() as OsrmResponse;const route=raw.routes?.[0];if(raw.code!=='Ok'||!route)throw new Error('route-unavailable');
    const geometry=(route.geometry?.coordinates??[]).slice(0,1600).map(([lng,lat])=>({lat,lng}));
    const steps:NavigationStep[]=(route.legs??[]).flatMap((leg)=>leg.steps??[]).slice(0,100).map((step)=>{const location=step.maneuver?.location??[origin.lng,origin.lat];return{instruction:instruction(step),distanceM:step.distance??0,durationS:step.duration??0,location:{lng:location[0],lat:location[1]},roadName:step.name?.trim()||null};});
    return{provider:'osrm',origin,destination,distanceM:route.distance??0,durationS:route.duration??0,geometry,steps,fetchedAtMs:Date.now()};
  }finally{clearTimeout(timer);}
}
