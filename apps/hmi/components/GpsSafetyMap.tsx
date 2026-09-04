'use client';

import { useEffect,useMemo,useState,type FormEvent } from 'react';
import { Bike,BusFront,Camera,CarFront,CircleDotDashed,Gauge,LocateFixed,MapPin,Navigation,Route,Search,TriangleAlert,Truck,UserRound,X } from 'lucide-react';
import type { DetectedObject,ObjectKind,VehiclePosition } from '@kingmast/contracts';
import type { RoadContextController } from '../lib/road-context';
import { cameraIsDriverRelevant,cameraLabel,routeAwareCameras,routeProgress } from '../lib/driver-context';
import { useDriverProfile } from '../lib/use-driver-profile';
import { formatDistance,speedAriaLabel,speedUnit,speedValue } from '../lib/units';
import NativeNavigationMap from './NativeNavigationMap';
import RouteRecoveryPanel from './RouteRecoveryPanel';
import styles from './GpsSafetyMap.module.css';

const ICONS={person:UserRound,car:CarFront,motorcycle:Bike,bicycle:Bike,truck:Truck,bus:BusFront,obstacle:TriangleAlert,unknown:CircleDotDashed} satisfies Record<ObjectKind,typeof CarFront>;
export function ObjectGlyph({kind}:{kind:ObjectKind}){const Icon=ICONS[kind];return <Icon aria-hidden="true" strokeWidth={1.8}/>;}

export default function GpsSafetyMap({vehicle,objects,road,compact=false,allowSearch=true}:{vehicle:VehiclePosition;objects:DetectedObject[];road:RoadContextController;compact?:boolean;allowSearch?:boolean}){
  const[query,setQuery]=useState('');const[headingUp,setHeadingUp]=useState(true);const[online,setOnline]=useState(true);const[endConfirm,setEndConfirm]=useState(false);const{profile}=useDriverProfile();const units=profile.units;const limit=road.context?.speedLimit.currentKmh??null;const over=road.context?.compliance==='over-limit';const routeCameras=useMemo(()=>routeAwareCameras(vehicle,road.route,road.context?.cameras??[]),[vehicle,road.route,road.context?.cameras]);const progress=routeProgress(vehicle,road.route);const searchAllowed=allowSearch&&online;
  useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();window.addEventListener('online',sync);window.addEventListener('offline',sync);return()=>{window.removeEventListener('online',sync);window.removeEventListener('offline',sync);};},[]);
  useEffect(()=>{if(!road.route)setEndConfirm(false);},[road.route]);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(!searchAllowed)return;await road.searchPlaces(query);};
  const choosePlace=async(place:(typeof road.places)[number])=>{if(!searchAllowed)return;setQuery('');await road.navigate(place.position,place);};
  const mapCameras=road.route?routeCameras.map((item)=>item.camera):road.context?.cameras??[];

  return <div className={styles.wrapper}>
    <div className={styles.mapFrame}>
      <NativeNavigationMap vehicle={vehicle} objects={objects} cameras={mapCameras} route={road.route} headingUp={headingUp} compact={compact}/>
      <div className={styles.mapTopLeft}><span><LocateFixed strokeWidth={1.8}/>{vehicle.source==='device-gps'?'GPS':vehicle.source==='gnss'?'GNSS':'DEMO'}</span>{road.routeFromCache?<span>Cached route</span>:null}{!online?<span>Offline</span>:null}</div>
      <button type="button" className={styles.headingButton} onClick={()=>setHeadingUp((value)=>!value)} aria-pressed={headingUp}><Navigation strokeWidth={1.8}/>{headingUp?'Heading up':'North up'}</button>
      <div className={`${styles.speedLimit} ${over?styles.overLimit:''}`} aria-label={speedAriaLabel(limit,units)}><strong>{limit===null?'—':speedValue(limit,units)}</strong><small>{speedUnit(units)}</small></div>
      {!compact?<div className={styles.cameraCount}><Camera strokeWidth={1.7}/>{road.route?`${routeCameras.length} on route`:`${road.context?.cameras.length??0} nearby`}</div>:null}
    </div>

    {!compact?<section className={styles.navigationPanel} aria-label="Navigation">
      <RouteRecoveryPanel road={road} online={online}/>
      <form className={`${styles.searchBar} ${!searchAllowed?styles.searchLocked:''}`} onSubmit={submit}><Search strokeWidth={1.9}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={!online?'Destination search unavailable offline':allowSearch?'Where to?':'Destination changes available while parked'} aria-label="Search destination" autoComplete="off" disabled={!searchAllowed}/><button type="submit" disabled={!searchAllowed||road.searchLoading||query.trim().length<2}>{road.searchLoading?'Searching…':'Search'}</button></form>
      {searchAllowed&&road.places.length>0&&query?<div className={styles.searchResults}>{road.places.map((place)=><button type="button" key={place.id} onClick={()=>void choosePlace(place)}><MapPin strokeWidth={1.8}/><span><strong>{place.name}</strong><small>{place.subtitle??'Destination'}</small></span></button>)}</div>:null}
      {searchAllowed&&query.length===0&&road.recentPlaces.length>0&&!road.route?<div className={styles.recents}><span>Recent</span>{road.recentPlaces.slice(0,3).map((place)=><button type="button" key={place.id} onClick={()=>void choosePlace(place)}><MapPin strokeWidth={1.7}/><strong>{place.name}</strong></button>)}</div>:null}
      <div className={styles.contextRow}><div><span>Speed limit</span><strong className={over?styles.warningText:''}>{limit===null?'—':speedValue(limit,units)}</strong><small>{road.context?.speedLimit.roadName??'Current road'} · {speedUnit(units)}</small></div><div><span>Your speed</span><strong>{speedValue(vehicle.speedKmh,units)}</strong><small>{over?'Reduce speed':road.context?.compliance==='near-limit'?'Near limit':`Within limit · ${speedUnit(units)}`}</small></div><div><span>Route cameras</span><strong>{road.route?routeCameras.filter((item)=>cameraIsDriverRelevant(item.camera)).length:road.context?.cameras.length??0}</strong><small>{road.route?'Matched to route':'Nearby context'}</small></div></div>
      {road.route?<div className={styles.routeSummary}><div className={styles.routeHeadline}><Navigation strokeWidth={1.9}/><span><strong>{progress?formatDistance(progress.remainingM,units):formatDistance(road.route.distanceM,units)}</strong><small>{progress?`${Math.max(1,Math.round(progress.etaS/60))} min remaining`:`${Math.round(road.route.durationS/60)} min`}</small></span><button type="button" onClick={()=>setEndConfirm(true)} aria-label="End route"><X strokeWidth={1.9}/></button></div><div className={styles.progressTrack}><i style={{width:`${Math.round((progress?.progress??0)*100)}%`}}/></div>{endConfirm?<div className={styles.routeEndConfirm} role="group" aria-label="Confirm ending route guidance"><span><strong>End route guidance?</strong><small>Your destination and active guidance will be cleared from this HMI.</small></span><div><button type="button" onClick={()=>setEndConfirm(false)}>Keep guidance</button><button type="button" className={styles.routeEndPrimary} onClick={()=>{road.clearRoute();setEndConfirm(false);}}>End guidance</button></div></div>:null}{road.route.steps.slice(0,3).map((step,index)=><p key={`${step.instruction}-${index}`}><b>{index+1}</b><span>{step.instruction}</span><small>{formatDistance(step.distanceM,units)}</small></p>)}</div>:<div className={styles.emptyRoute}><Route strokeWidth={1.8}/><span><strong>{online?'Ready to navigate':'Offline navigation'}</strong><small>{online?'Set a destination before driving.':'Reconnect to search for a new destination.'}</small></span></div>}
      {routeCameras.find((item)=>cameraIsDriverRelevant(item.camera))?<div className={styles.cameraAhead}><Camera strokeWidth={1.8}/><span><strong>{cameraLabel(routeCameras.find((item)=>cameraIsDriverRelevant(item.camera))!.camera)}</strong><small>{formatDistance(routeCameras.find((item)=>cameraIsDriverRelevant(item.camera))!.routeDistanceM,units)} ahead on route</small></span></div>:null}
      <p className={styles.sourceNote}>{!online?'Offline mode: online search, rerouting and connected-road context are paused. Existing on-vehicle safety warnings remain active.':road.error?'Road information is temporarily degraded. Verify posted signs.':'Speed limits combine mapped road data with high-confidence sign recognition. Camera coverage varies by public or authorized provider.'}</p>
    </section>:null}
  </div>;
}
