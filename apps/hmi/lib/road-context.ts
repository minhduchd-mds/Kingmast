'use client';

import { useCallback,useEffect,useMemo,useState } from 'react';
import type { GeoPoint,NavigationPlace,NavigationRoute,RoadContext,VehiclePosition } from '@kingmast/contracts';

function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??'http://localhost:4000').replace(/\/$/,'');}
function simulatorFallback(vehicle:VehiclePosition):RoadContext{return{position:{lat:vehicle.lat,lng:vehicle.lng},speedLimit:{currentKmh:50,source:'simulator',confidence:0.35,roadName:'Simulator road',conditional:null,observedAtMs:Date.now()},compliance:vehicle.speedKmh>53?'over-limit':vehicle.speedKmh>=47?'near-limit':'within-limit',cameras:[],fetchedAtMs:Date.now(),coverage:'unavailable',notes:['Simulated speed limit shown because the road-context API is unavailable. No camera locations are simulated.']};}

const ROUTE_CACHE_KEY='kingmast:v24:route';
const RECENTS_KEY='kingmast:v24:recent-places';
const ROUTE_CACHE_MAX_AGE_MS=2*60*60*1000;
interface StoredRoute{route:NavigationRoute;destination:GeoPoint;savedAtMs:number;}
function near(a:GeoPoint,b:GeoPoint){return Math.abs(a.lat-b.lat)<.001&&Math.abs(a.lng-b.lng)<.001;}

export interface RoadContextController {
  context:RoadContext|null;
  loading:boolean;
  error:string|null;
  route:NavigationRoute|null;
  routeLoading:boolean;
  routeFromCache:boolean;
  destination:GeoPoint|null;
  navigate:(destination:GeoPoint,place?:NavigationPlace)=>Promise<NavigationRoute|null>;
  reroute:()=>Promise<NavigationRoute|null>;
  clearRoute:()=>void;
  places:NavigationPlace[];
  recentPlaces:NavigationPlace[];
  searchLoading:boolean;
  searchPlaces:(query:string)=>Promise<NavigationPlace[]>;
}

export function useRoadContext(vehicle:VehiclePosition,radiusM:number):RoadContextController{
  const[context,setContext]=useState<RoadContext|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);const[route,setRoute]=useState<NavigationRoute|null>(null);const[routeLoading,setRouteLoading]=useState(false);const[routeFromCache,setRouteFromCache]=useState(false);const[destination,setDestination]=useState<GeoPoint|null>(null);const[places,setPlaces]=useState<NavigationPlace[]>([]);const[recentPlaces,setRecentPlaces]=useState<NavigationPlace[]>([]);const[searchLoading,setSearchLoading]=useState(false);
  const key=useMemo(()=>`${vehicle.lat.toFixed(4)}:${vehicle.lng.toFixed(4)}:${Math.round(vehicle.speedKmh/5)}`,[vehicle.lat,vehicle.lng,vehicle.speedKmh]);

  useEffect(()=>{try{const raw=window.localStorage.getItem(ROUTE_CACHE_KEY);if(raw){const stored=JSON.parse(raw) as StoredRoute;if(stored?.route&&stored?.destination&&Date.now()-stored.savedAtMs<=ROUTE_CACHE_MAX_AGE_MS){setRoute(stored.route);setDestination(stored.destination);setRouteFromCache(true);}}const recentRaw=window.localStorage.getItem(RECENTS_KEY);if(recentRaw){const parsed=JSON.parse(recentRaw) as NavigationPlace[];if(Array.isArray(parsed))setRecentPlaces(parsed.slice(0,5));}}catch{/* local cache is optional */}},[]);

  useEffect(()=>{let cancelled=false;const load=async()=>{try{setError(null);const url=`${apiBase()}/v4/road-context?lat=${encodeURIComponent(vehicle.lat)}&lng=${encodeURIComponent(vehicle.lng)}&speedKmh=${encodeURIComponent(vehicle.speedKmh)}&radiusM=${radiusM}`;const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`road-context-${response.status}`);const value=await response.json() as RoadContext;if(!cancelled)setContext(value);}catch(errorValue){if(!cancelled){setError(errorValue instanceof Error?errorValue.message:'road-context-unavailable');setContext(vehicle.source==='simulator'?simulatorFallback(vehicle):null);}}finally{if(!cancelled)setLoading(false);}};void load();const timer=window.setInterval(()=>void load(),8_000);return()=>{cancelled=true;window.clearInterval(timer);};},[key,radiusM,vehicle.lat,vehicle.lng,vehicle.source,vehicle.speedKmh]);

  const rememberPlace=useCallback((place:NavigationPlace)=>{setRecentPlaces((current)=>{const next=[place,...current.filter((item)=>item.id!==place.id)].slice(0,5);try{window.localStorage.setItem(RECENTS_KEY,JSON.stringify(next));}catch{}return next;});},[]);

  const requestRoute=useCallback(async(destinationValue:GeoPoint,place?:NavigationPlace)=>{setRouteLoading(true);setError(null);try{const response=await fetch(`${apiBase()}/v4/navigation/route`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:{lat:vehicle.lat,lng:vehicle.lng},destination:destinationValue})});if(!response.ok)throw new Error(`navigation-${response.status}`);const value=await response.json() as NavigationRoute;setRoute(value);setDestination(destinationValue);setRouteFromCache(false);if(place)rememberPlace(place);try{window.localStorage.setItem(ROUTE_CACHE_KEY,JSON.stringify({route:value,destination:destinationValue,savedAtMs:Date.now()} satisfies StoredRoute));}catch{}return value;}catch(errorValue){setError(errorValue instanceof Error?errorValue.message:'navigation-unavailable');try{const raw=window.localStorage.getItem(ROUTE_CACHE_KEY);if(raw){const stored=JSON.parse(raw) as StoredRoute;if(Date.now()-stored.savedAtMs<=ROUTE_CACHE_MAX_AGE_MS&&near(stored.destination,destinationValue)){setRoute(stored.route);setDestination(stored.destination);setRouteFromCache(true);return stored.route;}}}catch{}return null;}finally{setRouteLoading(false);}},[rememberPlace,vehicle.lat,vehicle.lng]);

  const navigate=useCallback((destinationValue:GeoPoint,place?:NavigationPlace)=>requestRoute(destinationValue,place),[requestRoute]);
  const reroute=useCallback(async()=>destination?requestRoute(destination):null,[destination,requestRoute]);
  const clearRoute=useCallback(()=>{setRoute(null);setDestination(null);setRouteFromCache(false);try{window.localStorage.removeItem(ROUTE_CACHE_KEY);}catch{}},[]);
  const searchPlaces=useCallback(async(query:string)=>{const trimmed=query.trim();if(trimmed.length<2){setPlaces([]);return[];}setSearchLoading(true);setError(null);try{const url=`${apiBase()}/v4/navigation/search?q=${encodeURIComponent(trimmed)}&lat=${encodeURIComponent(vehicle.lat)}&lng=${encodeURIComponent(vehicle.lng)}`;const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`geocoding-${response.status}`);const value=await response.json() as {places?:NavigationPlace[]};const results=value.places??[];setPlaces(results);return results;}catch(errorValue){setError(errorValue instanceof Error?errorValue.message:'geocoding-unavailable');setPlaces([]);return[];}finally{setSearchLoading(false);}},[vehicle.lat,vehicle.lng]);
  return{context,loading,error,route,routeLoading,routeFromCache,destination,navigate,reroute,clearRoute,places,recentPlaces,searchLoading,searchPlaces};
}
