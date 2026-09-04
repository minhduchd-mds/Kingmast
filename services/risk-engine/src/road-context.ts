import type {
  GeoPoint,
  RoadContext,
  SpeedCompliance,
  SpeedSignObservation,
  TrafficCamera,
  TrafficCameraKind,
  TrafficCameraSource,
} from '@kingmast/contracts';
import { distanceMeters } from './geo.js';

const OVERPASS_URL=process.env.OVERPASS_URL??'https://overpass-api.de/api/interpreter';
const PROVIDER_TIMEOUT_MS=3_500;
const SIGN_MAX_AGE_MS=6_000;
const runtimeProviders=new Map<string,TrafficCamera[]>();
let latestSpeedSign:SpeedSignObservation|null=null;

interface OsmElement { type:string; id:number; lat?:number; lon?:number; center?:{lat:number;lon?:number;lng?:number}; tags?:Record<string,string>; }
interface OsmResponse { elements?:OsmElement[]; }

export function parseMaxspeed(value:string|undefined):number|null {
  if(!value)return null;
  const normalized=value.trim().toLowerCase().split(';')[0]?.trim()??'';
  const match=normalized.match(/^(\d{1,3})(?:\s*(km\/h|kph|mph))?$/);
  if(!match)return null;
  const amount=Number(match[1]);
  if(!Number.isFinite(amount)||amount<=0||amount>250)return null;
  return match[2]==='mph'?Math.round(amount*1.609344):amount;
}

export function classifySpeedCompliance(limitKmh:number|null,speedKmh:number):SpeedCompliance {
  if(limitKmh===null)return 'unknown';
  const delta=speedKmh-limitKmh;
  if(delta>3)return 'over-limit';
  if(delta>=-3)return 'near-limit';
  return 'within-limit';
}

export function setLatestSpeedSign(observation:SpeedSignObservation){latestSpeedSign=observation;}
export function replaceRuntimeCameraProvider(providerId:string,cameras:TrafficCamera[]){runtimeProviders.set(providerId,cameras.map((camera)=>({...camera,source:'runtime-provider' as const,distanceM:0})));}
export function configuredCameraProviderCount(){return providerUrls().length+runtimeProviders.size+1;}

function elementPoint(element:OsmElement):GeoPoint|null {
  if(typeof element.lat==='number'&&typeof element.lon==='number')return{lat:element.lat,lng:element.lon};
  if(element.center&&typeof element.center.lat==='number'){
    const lng=typeof element.center.lng==='number'?element.center.lng:element.center.lon;
    if(typeof lng==='number')return{lat:element.center.lat,lng};
  }
  return null;
}

function providerUrls(){return(process.env.KINGMAST_CAMERA_PROVIDER_URLS??'').split(',').map((value)=>value.trim()).filter(Boolean);}
function providerUrlAllowed(value:string){try{const url=new URL(value);return url.protocol==='https:'||(url.protocol==='http:'&&(url.hostname==='localhost'||url.hostname==='127.0.0.1'));}catch{return false;}}
function numberOrNull(value:unknown){return typeof value==='number'&&Number.isFinite(value)?value:null;}
function stringOrNull(value:unknown){return typeof value==='string'&&value.trim()?value.trim():null;}
function parseDirection(value:string|undefined){if(!value)return null;const parsed=Number(value);return Number.isFinite(parsed)?((parsed%360)+360)%360:null;}

function cameraKind(tags:Record<string,string>):TrafficCameraKind {
  if(tags.highway==='speed_camera')return 'speed-enforcement';
  if(tags.enforcement==='traffic_signals'||tags['camera:type']==='red_light')return 'red-light';
  if(tags.enforcement==='average_speed')return 'average-speed';
  if(tags['surveillance:zone']==='traffic'||tags.surveillance==='traffic'||tags['surveillance:type']==='ALPR')return 'traffic-monitoring';
  return 'unknown';
}

function osmCamera(element:OsmElement,position:GeoPoint):TrafficCamera|null {
  const point=elementPoint(element);if(!point)return null;
  const tags=element.tags??{};
  return{id:`osm-${element.type}-${element.id}`,position:point,kind:cameraKind(tags),operator:tags.operator??null,ref:tags.ref??null,directionDeg:parseDirection(tags.direction),speedLimitKmh:parseMaxspeed(tags.maxspeed),viewerUrl:null,source:'osm',publicData:true,distanceM:distanceMeters(position,point)};
}

async function fetchJson(url:string,init?:RequestInit){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);try{const response=await fetch(url,{...init,signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json() as unknown;}finally{clearTimeout(timer);}}

async function queryOsm(position:GeoPoint,radiusM:number){
  const query=`[out:json][timeout:8];(way(around:120,${position.lat},${position.lng})[highway][maxspeed];node(around:${radiusM},${position.lat},${position.lng})[highway=speed_camera];node(around:${radiusM},${position.lat},${position.lng})[man_made=surveillance][surveillance:zone=traffic];node(around:${radiusM},${position.lat},${position.lng})[man_made=surveillance][surveillance=traffic];);out center tags;`;
  const raw=await fetchJson(OVERPASS_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(query)}`}) as OsmResponse;
  const elements=raw.elements??[];
  const roads=elements.filter((item)=>item.type==='way'&&item.tags?.maxspeed).map((item)=>({item,point:elementPoint(item)})).filter((entry):entry is {item:OsmElement;point:GeoPoint}=>entry.point!==null).sort((a,b)=>distanceMeters(position,a.point)-distanceMeters(position,b.point));
  const nearestRoad=roads[0]?.item;
  const cameras=elements.filter((item)=>item.type==='node'&&(item.tags?.highway==='speed_camera'||item.tags?.man_made==='surveillance')).map((item)=>osmCamera(item,position)).filter((item):item is TrafficCamera=>item!==null&&item.distanceM<=radiusM);
  return{speedLimitKmh:parseMaxspeed(nearestRoad?.tags?.maxspeed),roadName:nearestRoad?.tags?.name??null,conditional:nearestRoad?.tags?.['maxspeed:conditional']??null,cameras};
}

function parseProviderCamera(value:unknown,source:TrafficCameraSource,position:GeoPoint):TrafficCamera|null {
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  const rawPosition=item.position as Record<string,unknown>|undefined;
  const lat=numberOrNull(rawPosition?.lat),lng=numberOrNull(rawPosition?.lng);
  if(lat===null||lng===null||lat<-90||lat>90||lng<-180||lng>180)return null;
  const kindValues=new Set(['traffic-monitoring','speed-enforcement','red-light','average-speed','unknown']);
  const rawKind=stringOrNull(item.kind)??'unknown';
  const point={lat,lng};
  return{id:stringOrNull(item.id)??`${source}-${lat}-${lng}`,position:point,kind:(kindValues.has(rawKind)?rawKind:'unknown') as TrafficCameraKind,operator:stringOrNull(item.operator),ref:stringOrNull(item.ref),directionDeg:numberOrNull(item.directionDeg),speedLimitKmh:numberOrNull(item.speedLimitKmh),viewerUrl:stringOrNull(item.viewerUrl),source,publicData:item.publicData!==false,distanceM:distanceMeters(position,point)};
}

async function queryAuthorizedProviders(position:GeoPoint,radiusM:number){
  const token=(process.env.KINGMAST_CAMERA_PROVIDER_TOKEN??'').trim();
  const results:TrafficCamera[]=[];
  await Promise.all(providerUrls().filter(providerUrlAllowed).map(async(url)=>{try{const raw=await fetchJson(url,{headers:token?{authorization:`Bearer ${token}`}:{}});const cameras=(raw&&typeof raw==='object'&&Array.isArray((raw as {cameras?:unknown[]}).cameras))?(raw as {cameras:unknown[]}).cameras:[];for(const camera of cameras){const parsed=parseProviderCamera(camera,'authorized-provider',position);if(parsed&&parsed.distanceM<=radiusM)results.push(parsed);}}catch{/* provider degradation is reported by coverage notes */}}));
  for(const cameras of runtimeProviders.values())for(const camera of cameras){const normalized={...camera,distanceM:distanceMeters(position,camera.position)};if(normalized.distanceM<=radiusM)results.push(normalized);}
  return results;
}

function dedupeCameras(cameras:TrafficCamera[]){const result:TrafficCamera[]=[];for(const camera of cameras.sort((a,b)=>a.distanceM-b.distanceM)){const duplicate=result.some((existing)=>existing.id===camera.id||distanceMeters(existing.position,camera.position)<12);if(!duplicate)result.push(camera);}return result.slice(0,120);}

export async function getRoadContext(input:{position:GeoPoint;speedKmh:number;radiusM:number}):Promise<RoadContext>{
  const nowMs=Date.now();const notes:string[]=[];
  const [osmResult,providerResult]=await Promise.allSettled([queryOsm(input.position,input.radiusM),queryAuthorizedProviders(input.position,input.radiusM)]);
  const osm=osmResult.status==='fulfilled'?osmResult.value:{speedLimitKmh:null,roadName:null,conditional:null,cameras:[] as TrafficCamera[]};
  if(osmResult.status==='rejected')notes.push('Public map road context unavailable.');
  const providerCameras=providerResult.status==='fulfilled'?providerResult.value:[];if(providerResult.status==='rejected')notes.push('One or more authorized camera providers are unavailable.');
  const signFresh=latestSpeedSign!==null&&nowMs-latestSpeedSign.timestampMs<=SIGN_MAX_AGE_MS&&latestSpeedSign.confidence>=0.9;
  const currentKmh=signFresh?latestSpeedSign!.speedLimitKmh:osm.speedLimitKmh;
  const speedLimit={currentKmh,source:signFresh?'sign-vision' as const:currentKmh!==null?'map' as const:'unknown' as const,confidence:signFresh?latestSpeedSign!.confidence:currentKmh!==null?0.72:0,roadName:osm.roadName,conditional:osm.conditional,observedAtMs:signFresh?latestSpeedSign!.timestampMs:nowMs};
  const cameras=dedupeCameras([...osm.cameras,...providerCameras]);
  const hasConfiguredProviders=providerUrls().length>0||runtimeProviders.size>0;
  notes.push('Camera coverage includes only public map data and explicitly authorized providers; completeness is not guaranteed.');
  return{position:input.position,speedLimit,compliance:classifySpeedCompliance(currentKmh,input.speedKmh),cameras,fetchedAtMs:nowMs,coverage:hasConfiguredProviders?'provider-backed':osmResult.status==='fulfilled'?'partial-public-map':'unavailable',notes};
}
