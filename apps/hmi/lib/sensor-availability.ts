import type { SensorHealth,SensorState,Severity } from '@kingmast/contracts';

export interface SensorAvailability {
  severity:Severity;
  title:string;
  message:string;
  affected:string[];
  healthy:boolean;
}

function isUnavailable(state:SensorState){return state==='unavailable';}
function isLimited(state:SensorState){return state!=='ok';}

export function sensorAvailability(sensors:SensorHealth,moving:boolean,simulator=false):SensorAvailability{
  if(simulator)return{severity:'safe',title:'Demo sensors',message:'Simulator sensing is active.',affected:[],healthy:true};
  const affected:string[]=[];
  if(isLimited(sensors.radarFront))affected.push('front radar');
  if(isLimited(sensors.radarRear))affected.push('rear radar');
  if(isLimited(sensors.camera))affected.push('forward camera');
  if(isLimited(sensors.can))affected.push('vehicle CAN');
  if(isLimited(sensors.gnssImu))affected.push('GNSS / IMU');
  if(isLimited(sensors.ecu))affected.push('safety ECU');
  if(!affected.length)return{severity:'safe',title:'Sensors ready',message:'Primary sensing inputs report available.',affected,healthy:true};

  const coreUnavailable=isUnavailable(sensors.ecu)||isUnavailable(sensors.can);
  if(coreUnavailable)return{severity:moving?'critical':'caution',title:'Vehicle telemetry limited',message:'Safety ECU or vehicle CAN is unavailable. Some on-vehicle warnings may be unavailable; driver observation remains primary.',affected,healthy:false};

  const forwardUnavailable=isUnavailable(sensors.radarFront)&&isUnavailable(sensors.camera);
  if(forwardUnavailable)return{severity:moving?'critical':'caution',title:'Forward sensing unavailable',message:'Front radar and forward camera are unavailable. Forward object warnings may be unavailable until sensing recovers.',affected,healthy:false};

  const forwardLimited=isLimited(sensors.radarFront)||isLimited(sensors.camera);
  if(forwardLimited)return{severity:'caution',title:'Forward sensing degraded',message:'Forward sensing redundancy is reduced. Keep extra distance and rely on direct road observation.',affected,healthy:false};

  if(isUnavailable(sensors.radarRear))return{severity:'caution',title:'Rear awareness limited',message:'Rear radar is unavailable. Blind-spot and rear cross-traffic coverage may be reduced.',affected,healthy:false};
  if(isUnavailable(sensors.gnssImu))return{severity:'caution',title:'Positioning unavailable',message:'GNSS / IMU is unavailable. Route positioning and connected-road relevance may be degraded.',affected,healthy:false};

  return{severity:'caution',title:'Sensor capability reduced',message:`Limited input: ${affected.join(', ')}. Primary collision warnings remain active only where required sensor inputs are available.`,affected,healthy:false};
}
