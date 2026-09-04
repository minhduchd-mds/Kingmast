'use client';

import { useMemo,useState,type FormEvent } from 'react';
import { Bike,BusFront,Camera,CarFront,CircleDotDashed,Gauge,LocateFixed,MapPin,Navigation,Route,Search,TriangleAlert,Truck,UserRound,X } from 'lucide-react';
import type { DetectedObject,ObjectKind,TrafficCamera,VehiclePosition } from '@kingmast/contracts';
import type { RoadContextController } from '../lib/road-context';
import { cameraLabel,formatDriverDistance,routeAwareCameras } from '../lib/driver-context';
import styles from './GpsSafetyMap.module.css';

const ICONS={person:UserRound,car:CarFront,motorcycle:Bike,bicycle:Bike,truck:Truck,bus:BusFront,obstacle:TriangleAlert,unknown:CircleDotDashed} satisfies Record<ObjectKind,typeof CarFront>;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function markerPosition(object:DetectedObject,vehicle:VehiclePosition){const relative=((object.bearingDeg-vehicle.headingDeg+540)%360)-180;const angle=relative*Math.PI/180;const radius=clamp(object.distanceM/62,.13,.42);return{left:`${50+Math.sin(angle)*radius*100}%`,top:`${50-Math.cos(angle)*radius*100}%`};}
function cameraPosition(camera:TrafficCamera,vehicle:VehiclePosition){const latM=(camera.position.lat-vehicle.lat)*110_540;const lngM=(camera.position.lng-vehicle.lng)*111_320*Math.cos(vehicle.lat*Math.PI/180);const scale=1/1800;return{left:`${50+clamp(lngM*scale*45,-44,44)}%`,top:`${50-clamp(latM*scale*45,-44,44)}%`};}
export function ObjectGlyph({kind}:{kind:ObjectKind}){const Icon=ICONS[kind];return <Icon aria-hidden="true" strokeWidth={1.8}/>;}

export default function GpsSafetyMap({vehicle,objects,road,compact=false}:{vehicle:VehiclePosition;objects:DetectedObject[];road:RoadContextController;compact?:boolean}){
  const mapLat=Number(vehicle.lat.toFixed(3)),mapLng=Number(vehicle.lng.toFixed(3));const span=compact?0.0045:0.008;const bbox=`${mapLng-span},${mapLat-span},${mapLng+span},${mapLat+span}`;const mapSrc=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${mapLat},${mapLng}`)}`;
  const[query,setQuery]=useState('');const limit=road.context?.speedLimit.currentKmh??null;const over=road.context?.compliance==='over-limit';const routeCameras=useMemo(()=>routeAwareCameras(vehicle,road.route,road.context?.cameras??[]),[vehicle,road.route,road.context?.cameras]);
  const routePoints=useMemo(()=>{if(!road.route)return'';return road.route.geometry.map((point)=>`${50+((point.lng-vehicle.lng)/span)*50},${50-((point.lat-vehicle.lat)/span)*50}`).join(' ');},[road.route,vehicle.lat,vehicle.lng,span]);
  const destination=road.route?.destination??null;const destinationStyle=destination?{left:`${50+((destination.lng-vehicle.lng)/span)*50}%`,top:`${50-((destination.lat-vehicle.lat)/span)*50}%`}:undefined;
  const submit=async(event:FormEvent)=>{event.preventDefault();await road.searchPlaces(query);};
  const choosePlace=async(lat:number,lng:number)=>{setQuery('');await road.navigate({lat,lng});};

  return <div className={styles.wrapper}>
    <div className={`gpsMap ${compact?'gpsMapCompact':''}`}>
      <iframe className="osmMap" src={mapSrc} title="Road map" loading="lazy" referrerPolicy="no-referrer"/><div className="mapShade" aria-hidden="true"/>
      {routePoints?<svg className={styles.routeOverlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={routePoints} fill="none" vectorEffect="non-scaling-stroke"/></svg>:null}
      {destination&&destinationStyle?<div className={styles.destinationMarker} style={destinationStyle}><MapPin strokeWidth={2}/></div>:null}
      <div className="mapHeadingLine" style={{transform:`translate(-50%, -100%) rotate(${vehicle.headingDeg}deg)`}}/>
      <div className="egoMapMarker" aria-label="Vehicle position"><CarFront strokeWidth={1.8}/><i className="headingArrow" style={{transform:`translateX(-50%) rotate(${vehicle.headingDeg}deg)`}}><Navigation strokeWidth={2}/></i></div>
      {objects.map((object)=><div key={object.id} className={`objectMapMarker severity-${object.severity}`} style={markerPosition(object,vehicle)} title={`${object.kind}, ${object.distanceM.toFixed(1)} m`}><ObjectGlyph kind={object.kind}/><span>{Math.round(object.distanceM)} m</span></div>)}
      {(road.context?.cameras??[]).slice(0,compact?8:32).map((camera)=><div key={camera.id} className={styles.cameraMarker} style={cameraPosition(camera,vehicle)} title={`${cameraLabel(camera)} · ${Math.round(camera.distanceM)} m`}><Camera strokeWidth={1.8}/></div>)}
      <div className="gpsBadge"><LocateFixed strokeWidth={1.8}/><span><strong>{vehicle.source==='device-gps'?'GPS':vehicle.source==='gnss'?'GNSS':'DEMO'}</strong>{vehicle.accuracyM.toFixed(0)} m accuracy</span></div>
      <div className={`${styles.speedLimit} ${over?styles.overLimit:''}`} aria-label={limit?`Speed limit ${limit} kilometers per hour`:'Speed limit unavailable'}><span><strong>{limit??'—'}</strong><small>km/h</small></span></div>
      {!compact?<div className={styles.cameraCount}><Camera strokeWidth={1.7}/>{road.route?`${routeCameras.length} on route`:`${road.context?.cameras.length??0} nearby`}</div>:null}
    </div>

    {!compact?<section className={styles.navigationPanel} aria-label="Navigation">
      <form className={styles.searchBar} onSubmit={submit}><Search strokeWidth={1.9}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Where to?" aria-label="Search destination" autoComplete="off"/><button type="submit" disabled={road.searchLoading||query.trim().length<2}>{road.searchLoading?'Searching…':'Search'}</button></form>
      {road.places.length>0&&query?<div className={styles.searchResults}>{road.places.map((place)=><button type="button" key={place.id} onClick={()=>void choosePlace(place.position.lat,place.position.lng)}><MapPin strokeWidth={1.8}/><span><strong>{place.name}</strong><small>{place.subtitle??'Destination'}</small></span></button>)}</div>:null}
      <div className={styles.contextRow}><div><span>Speed limit</span><strong className={over?styles.warningText:''}>{limit===null?'—':`${limit}`}</strong><small>{road.context?.speedLimit.roadName??'Current road'}</small></div><div><span>Your speed</span><strong>{Math.round(vehicle.speedKmh)}</strong><small>{over?'Reduce speed':road.context?.compliance==='near-limit'?'Near limit':'Within limit'}</small></div><div><span>Route cameras</span><strong>{road.route?routeCameras.length:road.context?.cameras.length??0}</strong><small>{road.route?'Relevant to route':'Nearby road context'}</small></div></div>
      {road.route?<div className={styles.routeSummary}><div className={styles.routeHeadline}><Navigation strokeWidth={1.9}/><span><strong>{(road.route.distanceM/1000).toFixed(1)} km</strong><small>{Math.round(road.route.durationS/60)} min</small></span><button type="button" onClick={road.clearRoute} aria-label="End route"><X strokeWidth={1.9}/></button></div>{road.route.steps.slice(0,3).map((step,index)=><p key={`${step.instruction}-${index}`}><b>{index+1}</b><span>{step.instruction}</span><small>{formatDriverDistance(step.distanceM)}</small></p>)}</div>:<div className={styles.emptyRoute}><Route strokeWidth={1.8}/><span><strong>Ready to navigate</strong><small>Search for a destination before driving.</small></span></div>}
      {routeCameras[0]?<div className={styles.cameraAhead}><Camera strokeWidth={1.8}/><span><strong>{cameraLabel(routeCameras[0].camera)}</strong><small>{formatDriverDistance(routeCameras[0].routeDistanceM)} ahead on route</small></span></div>:null}
      {road.error?<p className={styles.sourceNote}>Road information is temporarily degraded. Verify posted signs.</p>:<p className={styles.sourceNote}>Speed limits combine mapped road data with high-confidence sign recognition. Camera coverage varies by public or authorized provider.</p>}
    </section>:null}
  </div>;
}
