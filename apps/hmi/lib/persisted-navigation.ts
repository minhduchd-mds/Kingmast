import type { EvProfile,GeoPoint,NavigationPlace,NavigationRoute,NavigationStep } from '@kingmast/contracts';

type UnknownRecord=Record<string,unknown>;

function isRecord(value:unknown):value is UnknownRecord{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function isFiniteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}

export function isGeoPoint(value:unknown):value is GeoPoint{
  if(!isRecord(value)||!isFiniteNumber(value.lat)||!isFiniteNumber(value.lng))return false;
  return value.lat>=-90&&value.lat<=90&&value.lng>=-180&&value.lng<=180;
}

function isNavigationStep(value:unknown):value is NavigationStep{
  if(!isRecord(value))return false;
  return typeof value.instruction==='string'&&value.instruction.length<=500&&
    isFiniteNumber(value.distanceM)&&value.distanceM>=0&&
    isFiniteNumber(value.durationS)&&value.durationS>=0&&
    isGeoPoint(value.location)&&(value.roadName===null||typeof value.roadName==='string');
}

export function isNavigationRoute(value:unknown):value is NavigationRoute{
  if(!isRecord(value)||value.provider!=='osrm'||!isGeoPoint(value.origin)||!isGeoPoint(value.destination))return false;
  if(!isFiniteNumber(value.distanceM)||value.distanceM<0||!isFiniteNumber(value.durationS)||value.durationS<0||!isFiniteNumber(value.fetchedAtMs))return false;
  if(!Array.isArray(value.geometry)||value.geometry.length<2||value.geometry.length>50_000||!value.geometry.every(isGeoPoint))return false;
  if(!Array.isArray(value.steps)||value.steps.length>5_000||!value.steps.every(isNavigationStep))return false;
  return true;
}

export interface StoredNavigationRoute{route:NavigationRoute;destination:GeoPoint;savedAtMs:number;}

export function parseStoredNavigationRoute(raw:string,maxAgeMs=Number.POSITIVE_INFINITY,nowMs=Date.now()):StoredNavigationRoute|null{
  try{
    const value=JSON.parse(raw) as unknown;
    if(!isRecord(value)||!isNavigationRoute(value.route)||!isGeoPoint(value.destination)||!isFiniteNumber(value.savedAtMs))return null;
    if(value.savedAtMs>nowMs+5*60_000)return null;
    if(Number.isFinite(maxAgeMs)&&nowMs-value.savedAtMs>maxAgeMs)return null;
    return{route:value.route,destination:value.destination,savedAtMs:value.savedAtMs};
  }catch{return null;}
}

function isNavigationPlace(value:unknown):value is NavigationPlace{
  if(!isRecord(value))return false;
  return typeof value.id==='string'&&value.id.length>0&&value.id.length<=240&&
    typeof value.name==='string'&&value.name.length>0&&value.name.length<=240&&
    (value.subtitle===null||typeof value.subtitle==='string')&&isGeoPoint(value.position)&&value.source==='geocoder';
}

export function parseRecentPlaces(raw:string):NavigationPlace[]{
  try{const value=JSON.parse(raw) as unknown;return Array.isArray(value)?value.filter(isNavigationPlace).slice(0,5):[];}catch{return[];}
}

function boundedNumber(value:unknown,fallback:number,min:number,max:number){return isFiniteNumber(value)?Math.max(min,Math.min(max,value)):fallback;}
export function sanitizeEvProfile(value:unknown,fallback:EvProfile):EvProfile{
  if(!isRecord(value))return fallback;
  return{
    batteryPct:boundedNumber(value.batteryPct,fallback.batteryPct,0,100),
    usableBatteryKwh:boundedNumber(value.usableBatteryKwh,fallback.usableBatteryKwh,5,250),
    rangeKm:boundedNumber(value.rangeKm,fallback.rangeKm,0,1500),
    consumptionWhPerKm:boundedNumber(value.consumptionWhPerKm,fallback.consumptionWhPerKm,50,600),
    reservePct:boundedNumber(value.reservePct,fallback.reservePct,0,60),
  };
}
