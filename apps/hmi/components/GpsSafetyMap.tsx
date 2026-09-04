'use client';

import { useState, type FormEvent } from 'react';
import { Bike,BusFront,Camera,CarFront,CircleDotDashed,Gauge,LocateFixed,Navigation,Route,TriangleAlert,Truck,UserRound } from 'lucide-react';
import type { DetectedObject,ObjectKind,TrafficCamera,VehiclePosition } from '@kingmast/contracts';
import { useRoadContext } from '../lib/road-context';
import styles from './GpsSafetyMap.module.css';

const ICONS={person:UserRound,car:CarFront,motorcycle:Bike,bicycle:Bike,truck:Truck,bus:BusFront,obstacle:TriangleAlert,unknown:CircleDotDashed} satisfies Record<ObjectKind,typeof CarFront>;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function markerPosition(object:DetectedObject,vehicle:VehiclePosition){const relative=((object.bearingDeg-vehicle.headingDeg+540)%360)-180;const angle=relative*Math.PI/180;const radius=clamp(object.distanceM/62,.13,.42);return{left:`${50+Math.sin(angle)*radius*100}%`,top:`${50-Math.cos(angle)*radius*100}%`};}
function cameraPosition(camera:TrafficCamera,vehicle:VehiclePosition){const latM=(camera.position.lat-vehicle.lat)*110_540;const lngM=(camera.position.lng-vehicle.lng)*111_320*Math.cos(vehicle.lat*Math.PI/180);const scale=1/1800;return{left:`${50+clamp(lngM*scale*45,-44,44)}%`,top:`${50-clamp(latM*scale*45,-44,44)}%`};}
export function ObjectGlyph({kind}:{kind:ObjectKind}){const Icon=ICONS[kind];return <Icon aria-hidden="true" strokeWidth={1.8}/>;}

export default function GpsSafetyMap({vehicle,objects,compact=false}:{vehicle:VehiclePosition;objects:DetectedObject[];compact?:boolean}){
  const mapLat=Number(vehicle.lat.toFixed(3)),mapLng=Number(vehicle.lng.toFixed(3));
  const span=compact?0.0045:0.0065;
  const bbox=`${mapLng-span},${mapLat-span},${mapLng+span},${mapLat+span}`;
  const mapSrc=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${mapLat},${mapLng}`)}`;
  const road=useRoadContext(vehicle,compact?900:1800);
  const [destLat,setDestLat]=useState('');
  const [destLng,setDestLng]=useState('');
  const limit=road.context?.speedLimit.currentKmh??null;
  const over=road.context?.compliance==='over-limit';
  const submit=async(event:FormEvent)=>{event.preventDefault();const lat=Number(destLat),lng=Number(destLng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return;await road.navigate({lat,lng});};

  return <div className={styles.wrapper}>
    <div className={`gpsMap ${compact?'gpsMapCompact':''}`}>
      <iframe className="osmMap" src={mapSrc} title="OpenStreetMap live vehicle position" loading="lazy" referrerPolicy="no-referrer"/>
      <div className="mapShade" aria-hidden="true"/><div className="mapHeadingLine" style={{transform:`translate(-50%, -100%) rotate(${vehicle.headingDeg}deg)`}}/>
      <div className="egoMapMarker" aria-label="Vehicle position"><CarFront strokeWidth={1.8}/><i className="headingArrow" style={{transform:`translateX(-50%) rotate(${vehicle.headingDeg}deg)`}}><Navigation strokeWidth={2}/></i></div>
      {objects.map((object)=><div key={object.id} className={`objectMapMarker severity-${object.severity}`} style={markerPosition(object,vehicle)} title={`${object.kind}, ${object.distanceM.toFixed(1)} m, ${Math.round(object.confidence*100)}%`}><ObjectGlyph kind={object.kind}/><span>{Math.round(object.distanceM)} m</span></div>)}
      {(road.context?.cameras??[]).slice(0,compact?8:32).map((camera)=><div key={camera.id} className={styles.cameraMarker} style={cameraPosition(camera,vehicle)} title={`${camera.kind} · ${Math.round(camera.distanceM)} m · ${camera.source}`}><Camera strokeWidth={1.8}/></div>)}
      <div className="gpsBadge"><LocateFixed strokeWidth={1.8}/><span><strong>{vehicle.source==='device-gps'?'DEVICE GPS':vehicle.source==='gnss'?'EDGE GNSS':'GNSS SIM'}</strong>{vehicle.accuracyM.toFixed(1)} m accuracy</span></div>
      <div className={`${styles.speedLimit} ${over?styles.overLimit:''}`} title={road.context?.speedLimit.source??'unknown'}><Gauge strokeWidth={1.8}/><span><strong>{limit??'—'}</strong><small>km/h limit</small></span></div>
      {!compact?<div className={styles.cameraCount}><Camera strokeWidth={1.7}/>{road.context?.cameras.length??0} mapped cameras nearby</div>:null}
    </div>
    {!compact?<section className={styles.navigationPanel} aria-label="Navigation and road speed context">
      <div className={styles.contextRow}><div><span>Road speed</span><strong className={over?styles.warningText:''}>{limit===null?'Not verified':`${limit} km/h`}</strong><small>{road.context?.speedLimit.roadName??road.context?.speedLimit.source??'Road context unavailable'}</small></div><div><span>Vehicle speed</span><strong>{Math.round(vehicle.speedKmh)} km/h</strong><small>{over?'Reduce speed to the posted limit':road.context?.compliance==='near-limit'?'Near the posted limit':'Within current context'}</small></div><div><span>Camera coverage</span><strong>{road.context?.cameras.length??0} nearby</strong><small>{road.context?.coverage??'unavailable'} · public/authorized only</small></div></div>
      <form className={styles.routeForm} onSubmit={submit}><Route strokeWidth={1.8}/><input inputMode="decimal" value={destLat} onChange={(event)=>setDestLat(event.target.value)} placeholder="Destination latitude" aria-label="Destination latitude"/><input inputMode="decimal" value={destLng} onChange={(event)=>setDestLng(event.target.value)} placeholder="Destination longitude" aria-label="Destination longitude"/><button type="submit" disabled={road.routeLoading}>{road.routeLoading?'Routing…':'Start route'}</button></form>
      {road.route?<div className={styles.routeSummary}><div><Navigation strokeWidth={1.8}/><strong>{(road.route.distanceM/1000).toFixed(1)} km</strong><span>{Math.round(road.route.durationS/60)} min</span></div>{road.route.steps.slice(0,3).map((step,index)=><p key={`${step.instruction}-${index}`}><b>{index+1}</b><span>{step.instruction}</span><small>{Math.round(step.distanceM)} m</small></p>)}</div>:null}
      {road.error?<p className={styles.sourceNote}>Road context degraded: {road.error}. Speed-limit and camera data may be incomplete.</p>:<p className={styles.sourceNote}>Speed limits fuse map metadata with high-confidence local sign recognition. Traffic-camera coverage cannot be guaranteed complete.</p>}
    </section>:null}
  </div>;
}
