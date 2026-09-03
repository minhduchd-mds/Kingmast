'use client';
import {AlertTriangle,BatteryMedium,Camera,CarFront,Gauge,Map,Radio,ShieldCheck,Volume2} from 'lucide-react';
import {useEffect,useState} from 'react';

type Severity='safe'|'caution'|'critical';
const sensors=[['Front radar',Radio,'OK'],['Rear radar',Radio,'OK'],['Camera',Camera,'CHECK'],['CAN',Gauge,'OK'],['GNSS / IMU',Map,'OK'],['ECU',ShieldCheck,'OK']] as const;
export default function Page(){
 const [speed,setSpeed]=useState(68); const [distance,setDistance]=useState(42); const [severity,setSeverity]=useState<Severity>('safe');
 useEffect(()=>{const id=setInterval(()=>{setSpeed(v=>Math.max(0,Math.min(88,v+(Math.random()-.5)*2)));setDistance(v=>Math.max(8,Math.min(55,v+(Math.random()-.58)*4)));},1400);return()=>clearInterval(id)},[]);
 useEffect(()=>setSeverity(distance<15?'critical':distance<30?'caution':'safe'),[distance]);
 const ttc=Math.max(.1,distance/Math.max(1,speed/3.6-8));
 return <main className={`shell severity-${severity}`}>
  <header><div className="brand"><span className="mark">K</span><strong>KINGMAST</strong></div><div className="legend"><span className="safe">● SAFE</span><span className="caution">● CAUTION</span><span className="critical">● CRITICAL</span></div></header>
  <section className="grid">
   <article className="panel drive"><h2><b>1</b> DRIVE</h2><div className="driveRow"><div><div className="speed">{Math.round(speed)}</div><div>km/h</div><div className="limit">80</div><small>SPEED LIMIT</small></div><div className="road"><div className="laneGlow"/><CarFront className="lead"/><CarFront className="ego"/><div className="status"><ShieldCheck/> {severity==='safe'?'SAFE':severity==='caution'?'CAUTION':'SLOW DOWN'}</div></div><div className="metrics"><span><BatteryMedium/> 76%</span><span>FRONT GAP <strong>{Math.round(distance)} m</strong></span><span>HEADWAY <strong>{(distance/Math.max(1,speed/3.6)).toFixed(1)} s</strong></span><span>REAR GAP <strong>18 m</strong></span></div></div></article>
   <article className="panel warning"><h2><b>2</b> WARNING</h2><div className="warningTitle"><AlertTriangle/><strong>{severity==='critical'?'SLOW DOWN':severity==='caution'?'INCREASE GAP':'MONITORING'}</strong><AlertTriangle/></div><div className="warningBody"><div><small>DISTANCE</small><strong>{Math.round(distance)} m</strong></div><CarFront className="dangerCar"/><div><small>TTC</small><strong>{ttc.toFixed(1)} s</strong></div></div><div className="chevrons">⌃⌃⌃</div></article>
   <article className="panel surround"><h2><b>3</b> SURROUND</h2><div className="radar"><div className="ring r1"/><div className="ring r2"/><div className="ring r3"/><CarFront className="centerCar"/><span className="target frontT">12 m</span><span className="target leftT">2.6 m</span><span className="target rightT">3.2 m</span><span className="target rearT">18 m</span></div></article>
   <article className="panel"><h2><b>4</b> SENSORS</h2><div className="sensorGrid">{sensors.map(([name,Icon,state])=><div className={`sensor ${state==='CHECK'?'check':''}`} key={name}><Icon/><span>{name}</span><strong>{state}</strong></div>)}</div></article>
   <article className="panel"><h2><b>5</b> TRIP REPORT</h2><div className="stats"><span>SAFETY SCORE<strong>92<small>/100</small></strong></span><span>DISTANCE<strong>36.4<small> km</small></strong></span><span>ALERTS<strong>3</strong></span><span>FOLLOW TIME<strong>48<small> s</small></strong></span></div><div className="timeline"><i/><i/><i className="danger"/><i className="warn"/><i className="warn"/></div><div className="bars">{[68,79,74,81,72].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></article>
   <article className="panel settings"><h2><b>6</b> PARKED SETTINGS <em>Ⓟ VEHICLE PARKED</em></h2><p className="notice">ⓘ Changes are available only while the vehicle is parked.</p><label>Alert sensitivity <span>Low <strong>Medium</strong> High</span></label><label><Volume2/> Alert sound <span>Off Low <strong>Medium</strong> High</span></label><label>Privacy <span><strong>On</strong></span></label><label>Data retention <span>7 days <strong>30 days</strong> 90 days</span></label></article>
  </section>
 </main>
}
