import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync,FastifyReply,FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { EvProfile,NavigationRoute,SpeedSignObservation,TrafficCamera } from '@kingmast/contracts';
import { calculateNavigationAlternatives,calculateNavigationRoute,searchNavigationPlaces } from './navigation.js';
import { configuredCameraProviderCount,getRoadContext,replaceRuntimeCameraProvider,setLatestSpeedSign } from './road-context.js';
import { getRouteIntelligence } from './route-intelligence.js';

const GeoPoint=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
const RoadQuery=z.object({lat:z.coerce.number().min(-90).max(90),lng:z.coerce.number().min(-180).max(180),speedKmh:z.coerce.number().min(0).max(350).default(0),radiusM:z.coerce.number().int().min(100).max(5000).default(1500)});
const RouteBody=z.object({origin:GeoPoint,destination:GeoPoint});
const SearchQuery=z.object({q:z.string().trim().min(2).max(120),lat:z.coerce.number().min(-90).max(90).optional(),lng:z.coerce.number().min(-180).max(180).optional()});
const EvProfileSchema=z.object({batteryPct:z.number().min(0).max(100),usableBatteryKwh:z.number().min(5).max(250),rangeKm:z.number().min(0).max(1500),consumptionWhPerKm:z.number().min(50).max(600),reservePct:z.number().min(0).max(60)});
const AlternativesBody=RouteBody.extend({evProfile:EvProfileSchema.optional()});
const NavigationStep=z.object({instruction:z.string(),distanceM:z.number(),durationS:z.number(),location:GeoPoint,roadName:z.string().nullable()});
const NavigationRouteSchema=z.object({provider:z.literal('osrm'),origin:GeoPoint,destination:GeoPoint,distanceM:z.number().nonnegative(),durationS:z.number().nonnegative(),geometry:z.array(GeoPoint).min(2).max(1800),steps:z.array(NavigationStep).max(120),fetchedAtMs:z.number().int().positive()});
const IntelligenceBody=z.object({route:NavigationRouteSchema,position:GeoPoint});
const SpeedSignBody=z.object({cameraId:z.string().min(1).max(96),speedLimitKmh:z.number().int().min(5).max(180),confidence:z.number().min(0).max(1),bearingDeg:z.number().min(-180).max(180),timestampMs:z.number().int().positive()});
const CameraKind=z.enum(['traffic-monitoring','speed-enforcement','red-light','average-speed','unknown']);
const RuntimeCamera=z.object({id:z.string().min(1).max(160),position:GeoPoint,kind:CameraKind,operator:z.string().max(160).nullable().optional(),ref:z.string().max(160).nullable().optional(),directionDeg:z.number().min(0).max(360).nullable().optional(),speedLimitKmh:z.number().min(1).max(250).nullable().optional(),viewerUrl:z.string().url().nullable().optional(),publicData:z.boolean().default(false)});
const RuntimeCameraBody=z.object({providerId:z.string().min(2).max(96),cameras:z.array(RuntimeCamera).max(5000)});
const EDGE_TOKEN=(process.env.KINGMAST_EDGE_TOKEN??'').trim();
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
function authorized(request:FastifyRequest){if(!EDGE_TOKEN)return true;const candidate=request.headers['x-kingmast-edge-token'];return typeof candidate==='string'&&equal(candidate,EDGE_TOKEN);}
function requireAuth(request:FastifyRequest,reply:FastifyReply){if(authorized(request))return true;reply.code(401).send({error:'edge-auth-required'});return false;}

export const roadContextRoutes:FastifyPluginAsync=async(app)=>{
  app.get('/v4/road-context',async(request,reply)=>{const parsed=RoadQuery.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-road-context-query'});return getRoadContext({position:{lat:parsed.data.lat,lng:parsed.data.lng},speedKmh:parsed.data.speedKmh,radiusM:parsed.data.radiusM});});
  app.get('/v4/navigation/search',async(request,reply)=>{const parsed=SearchQuery.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-navigation-search'});try{const near=parsed.data.lat!==undefined&&parsed.data.lng!==undefined?{lat:parsed.data.lat,lng:parsed.data.lng}:undefined;return{places:await searchNavigationPlaces(parsed.data.q,near)};}catch(error){request.log.warn({error},'geocoding provider unavailable');return reply.code(503).send({error:'geocoding-provider-unavailable'});}});
  app.post('/v4/navigation/route',async(request,reply)=>{const parsed=RouteBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-route-request'});try{return await calculateNavigationRoute(parsed.data.origin,parsed.data.destination);}catch(error){request.log.warn({error},'navigation provider unavailable');return reply.code(503).send({error:'navigation-provider-unavailable'});}});
  app.post('/v5/navigation/alternatives',async(request,reply)=>{const parsed=AlternativesBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-alternatives-request'});try{return{routes:await calculateNavigationAlternatives(parsed.data.origin,parsed.data.destination,parsed.data.evProfile as EvProfile|undefined)};}catch(error){request.log.warn({error},'navigation alternatives unavailable');return reply.code(503).send({error:'navigation-alternatives-unavailable'});}});
  app.post('/v5/navigation/intelligence',async(request,reply)=>{const parsed=IntelligenceBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-route-intelligence-request'});return getRouteIntelligence(parsed.data.route as NavigationRoute,parsed.data.position);});
  app.get('/v5/navigation/capabilities',async()=>({routeAlternatives:true,evEnergyEstimate:true,routeSpeedZones:true,intersectionPreview:true,chargingAlongRoute:true,blindSpotUi:true,rearCrossTrafficUi:true,vehicleControl:false,policy:'Advisory only. Public map metadata may be incomplete; posted signs and driver observation remain authoritative.'}));
  app.post('/v4/perception/speed-sign',async(request,reply)=>{if(!requireAuth(request,reply))return;const parsed=SpeedSignBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-speed-sign-observation'});setLatestSpeedSign(parsed.data as SpeedSignObservation);return{accepted:true};});
  app.post('/v4/road-context/cameras',async(request,reply)=>{if(!requireAuth(request,reply))return;const parsed=RuntimeCameraBody.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-camera-provider-payload',details:parsed.error.flatten()});const cameras:TrafficCamera[]=parsed.data.cameras.map((camera)=>({id:camera.id,position:camera.position,kind:camera.kind,operator:camera.operator??null,ref:camera.ref??null,directionDeg:camera.directionDeg??null,speedLimitKmh:camera.speedLimitKmh??null,viewerUrl:camera.viewerUrl??null,source:'runtime-provider',publicData:camera.publicData,distanceM:0}));replaceRuntimeCameraProvider(parsed.data.providerId,cameras);return{providerId:parsed.data.providerId,updated:cameras.length};});
  app.get('/v4/road-context/providers',async()=>({cameraProviders:configuredCameraProviderCount(),routingProvider:'osrm',geocodingProvider:'configured-nominatim-compatible',publicMapProvider:'openstreetmap-overpass',policy:'Only public or explicitly authorized traffic-camera metadata/feed endpoints may be configured. KINGMAST does not bypass camera authentication.'}));
};
