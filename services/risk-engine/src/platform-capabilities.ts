export type NativeCapabilityKey='surround-camera'|'climate'|'media'|'phone'|'emergency';
export type NativeCapabilityState='unavailable'|'requires-integration'|'ready'|'degraded';
export interface NativeCapability<TState=Record<string,unknown>>{
  key:NativeCapabilityKey;
  state:NativeCapabilityState;
  observedAtMs:number;
  data:TState|null;
  nativeConfirmed:boolean;
}

export interface SurroundCalibration{
  cameraId:string;
  width:number;
  height:number;
  homography:number[];
  reprojectionErrorPx:number;
}
export interface SurroundViewAssessment{
  state:'requires-calibration'|'ready'|'degraded';
  calibratedCameras:number;
  maximumReprojectionErrorPx:number|null;
  lowSpeedOnly:true;
}
export function assessSurroundCalibration(calibrations:SurroundCalibration[]):SurroundViewAssessment{
  const valid=calibrations.filter((item)=>item.width>0&&item.height>0&&item.homography.length===9&&item.homography.every(Number.isFinite)&&Number.isFinite(item.reprojectionErrorPx)&&item.reprojectionErrorPx>=0);
  if(valid.length<4)return{state:'requires-calibration',calibratedCameras:valid.length,maximumReprojectionErrorPx:valid.length?Math.max(...valid.map((item)=>item.reprojectionErrorPx)):null,lowSpeedOnly:true};
  const maximum=Math.max(...valid.map((item)=>item.reprojectionErrorPx));
  return{state:maximum<=3?'ready':'degraded',calibratedCameras:valid.length,maximumReprojectionErrorPx:Number(maximum.toFixed(2)),lowSpeedOnly:true};
}

export interface ClimateState{temperatureC:number|null;fanLevel:number|null;mode:string|null;}
export interface MediaState{title:string|null;artist:string|null;playing:boolean;source:string|null;}
export interface PhoneState{status:'unavailable'|'scanning'|'pairing'|'connected'|'disconnected'|'permission-required';deviceName:string|null;}

export interface NativeVehicleHostSnapshot{
  surround:NativeCapability<SurroundViewAssessment>;
  climate:NativeCapability<ClimateState>;
  media:NativeCapability<MediaState>;
  phone:NativeCapability<PhoneState>;
}

export function unavailableNativeHost(nowMs=Date.now()):NativeVehicleHostSnapshot{return{
  surround:{key:'surround-camera',state:'requires-integration',observedAtMs:nowMs,data:null,nativeConfirmed:false},
  climate:{key:'climate',state:'requires-integration',observedAtMs:nowMs,data:null,nativeConfirmed:false},
  media:{key:'media',state:'requires-integration',observedAtMs:nowMs,data:null,nativeConfirmed:false},
  phone:{key:'phone',state:'requires-integration',observedAtMs:nowMs,data:null,nativeConfirmed:false},
};}
