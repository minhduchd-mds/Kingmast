'use client';

import { useEffect,useRef,useState } from 'react';
import maplibregl,{ type GeoJSONSource,type Map as MapLibreMap,type Marker,type StyleSpecification } from 'maplibre-gl';
import type { DetectedObject,NavigationRoute,TrafficCamera,VehiclePosition } from '@kingmast/contracts';

interface Props{vehicle:VehiclePosition;objects:DetectedObject[];cameras:TrafficCamera[];route:NavigationRoute|null;headingUp:boolean;compact:boolean;}

function fallbackStyle():StyleSpecification{
  const tile=process.env.NEXT_PUBLIC_MAP_RASTER_TILE_URL?.trim()||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return{version:8,sources:{osm:{type:'raster',tiles:[tile],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm',minzoom:0,maxzoom:20}]};
}
function mapStyle():string|StyleSpecification{return process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim()||fallbackStyle();}
function svg(kind:string){
  if(kind==='camera')return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';
  if(kind==='destination')return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>';
  if(kind==='person')return'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.8v6m-4 7 4-7 4 7M8.7 11h6.6"/></svg>';
  if(kind==='bicycle'||kind==='motorcycle')return'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="m6 17 4-7h4l4 7m-8-7 5 7M9 7h3"/></svg>';
  if(kind==='obstacle'||kind==='unknown')return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2z"/><path d="M12 9v5m0 3h.01"/></svg>';
  return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10.5 7.2 6h9.6l2.2 4.5 1.5 1.5v5.5h-2.2v-2H5.7v2H3.5V12z"/><circle cx="7" cy="14" r="1.5"/><circle cx="17" cy="14" r="1.5"/></svg>';
}
function markerElement(kind:string,tone='neutral',label?:string){const element=document.createElement('div');element.className=`kingmastMapMarker marker-${kind} tone-${tone}`;element.innerHTML=svg(kind);if(label)element.setAttribute('aria-label',label);return element;}
function objectTone(object:DetectedObject){return object.severity==='critical'?'critical':object.severity==='caution'?'caution':'safe';}
function webGlAvailable(){
  try{const canvas=document.createElement('canvas');return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'));}catch{return false;}
}

export default function NativeNavigationMap({vehicle,objects,cameras,route,headingUp,compact}:Props){
  const containerRef=useRef<HTMLDivElement|null>(null);const mapRef=useRef<MapLibreMap|null>(null);const vehicleMarker=useRef<Marker|null>(null);const dynamicMarkers=useRef<Marker[]>([]);const[rendererFailure,setRendererFailure]=useState<string|null>(null);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current||rendererFailure)return;
    if(!webGlAvailable()){setRendererFailure('webgl-unavailable');return;}
    let disposed=false;let map:MapLibreMap;
    const fail=(reason:string)=>{if(disposed)return;setRendererFailure(reason);dynamicMarkers.current.forEach((marker)=>{try{marker.remove();}catch{}});dynamicMarkers.current=[];try{vehicleMarker.current?.remove();}catch{}vehicleMarker.current=null;try{mapRef.current?.remove();}catch{}mapRef.current=null;};
    try{
      map=new maplibregl.Map({container:containerRef.current,style:mapStyle(),center:[vehicle.lng,vehicle.lat],zoom:compact?15:16,bearing:headingUp?vehicle.headingDeg:0,pitch:compact?0:22,attributionControl:{compact:true},interactive:!compact});
    }catch{setRendererFailure('map-initialization-failed');return;}
    mapRef.current=map;
    const onLoad=()=>{try{if(!map.getSource('kingmast-route'))map.addSource('kingmast-route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]},properties:{}}});if(!map.getLayer('kingmast-route-shadow'))map.addLayer({id:'kingmast-route-shadow',type:'line',source:'kingmast-route',paint:{'line-color':'rgba(0,0,0,.38)','line-width':9,'line-blur':2}});if(!map.getLayer('kingmast-route-line'))map.addLayer({id:'kingmast-route-line',type:'line',source:'kingmast-route',paint:{'line-color':'#0a84ff','line-width':6,'line-opacity':.95}});}catch{fail('map-style-setup-failed');}};
    map.on('load',onLoad);
    const canvas=map.getCanvas();
    const onContextLost=(event:Event)=>{event.preventDefault();fail('webgl-context-lost');};
    canvas.addEventListener('webglcontextlost',onContextLost,false);
    return()=>{disposed=true;canvas.removeEventListener('webglcontextlost',onContextLost,false);dynamicMarkers.current.forEach((marker)=>{try{marker.remove();}catch{}});dynamicMarkers.current=[];try{vehicleMarker.current?.remove();}catch{}vehicleMarker.current=null;try{map.remove();}catch{}mapRef.current=null;};
  },[rendererFailure]);

  useEffect(()=>{const map=mapRef.current;if(!map||rendererFailure)return;try{map.easeTo({center:[vehicle.lng,vehicle.lat],bearing:headingUp?vehicle.headingDeg:0,duration:280,essential:true});if(!vehicleMarker.current){vehicleMarker.current=new maplibregl.Marker({element:markerElement('vehicle','primary','Vehicle position'),anchor:'center'}).setLngLat([vehicle.lng,vehicle.lat]).addTo(map);}else vehicleMarker.current.setLngLat([vehicle.lng,vehicle.lat]);}catch{setRendererFailure('map-vehicle-update-failed');}},[headingUp,rendererFailure,vehicle.headingDeg,vehicle.lat,vehicle.lng]);

  useEffect(()=>{const map=mapRef.current;if(!map||rendererFailure)return;const sync=()=>{try{const source=map.getSource('kingmast-route') as GeoJSONSource|undefined;if(!source)return;source.setData({type:'Feature',geometry:{type:'LineString',coordinates:(route?.geometry??[]).map((point)=>[point.lng,point.lat])},properties:{}});}catch{setRendererFailure('map-route-update-failed');}};try{if(map.isStyleLoaded())sync();else map.once('load',sync);}catch{setRendererFailure('map-route-update-failed');}},[rendererFailure,route]);

  useEffect(()=>{const map=mapRef.current;if(!map||rendererFailure)return;try{dynamicMarkers.current.forEach((marker)=>marker.remove());const next:Marker[]=[];for(const object of objects.slice(0,24)){const marker=new maplibregl.Marker({element:markerElement(object.kind,objectTone(object),`${object.kind}, ${Math.round(object.distanceM)} meters`),anchor:'center'}).setLngLat([object.position.lng,object.position.lat]).addTo(map);next.push(marker);}for(const camera of cameras.slice(0,40)){const marker=new maplibregl.Marker({element:markerElement('camera',camera.kind==='speed-enforcement'||camera.kind==='average-speed'?'caution':'neutral',camera.kind),anchor:'center'}).setLngLat([camera.position.lng,camera.position.lat]).addTo(map);next.push(marker);}if(route){const point=route.destination;next.push(new maplibregl.Marker({element:markerElement('destination','primary','Destination'),anchor:'bottom'}).setLngLat([point.lng,point.lat]).addTo(map));}dynamicMarkers.current=next;}catch{setRendererFailure('map-marker-update-failed');}},[cameras,objects,rendererFailure,route]);

  if(rendererFailure)return <div className={`kingmastNativeMap ${compact?'compact':''}`} data-testid="map-renderer-fallback" data-map-failure={rendererFailure} aria-label="Navigation map unavailable" style={{display:'grid',placeItems:'center',padding:20,textAlign:'center'}}><span><strong style={{display:'block',fontSize:14}}>Map renderer unavailable</strong><small style={{display:'block',marginTop:4,opacity:.72}}>Navigation guidance and warning-only safety functions continue without the WebGL map surface.</small></span></div>;
  return <div ref={containerRef} className={`kingmastNativeMap ${compact?'compact':''}`} aria-label="KINGMAST navigation map"/>;
}
