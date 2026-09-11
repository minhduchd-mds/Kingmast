import type { CalibratedCameraObservation,CameraCalibrationProfile } from '@kingmast/contracts/nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';
import {buildSurroundFusion} from './surround-fusion.js';

const MAX_CAMERAS=8;

export class MultiCameraRuntime{
  readonly calibrations=new CameraCalibrationRegistry();
  private readonly observations=new Map<string,CalibratedCameraObservation>();
  private readonly lastSequence=new Map<string,number>();

  configure(profile:CameraCalibrationProfile){return this.calibrations.upsert(profile);}

  ingest(observation:CalibratedCameraObservation){
    if(!this.calibrations.get(observation.cameraId))return{accepted:false as const,reason:'calibration-missing' as const};
    const previous=this.lastSequence.get(observation.cameraId);
    if(previous!==undefined&&observation.sequence<=previous)return{accepted:false as const,reason:'sequence-replay' as const};
    if(observation.receivedAtMs<observation.capturedAtMs)return{accepted:false as const,reason:'invalid-clock' as const};
    if(!this.observations.has(observation.cameraId)&&this.observations.size>=MAX_CAMERAS)return{accepted:false as const,reason:'capacity' as const};
    const bounded:CalibratedCameraObservation={...structuredClone(observation),detections:observation.detections.slice(0,256),lanes:observation.lanes.slice(0,16),freeSpace:observation.freeSpace.slice(0,72)};
    this.observations.set(observation.cameraId,bounded);
    this.lastSequence.set(observation.cameraId,observation.sequence);
    return{accepted:true as const,reason:'accepted' as const};
  }

  surround(vehicleId:string,nowMs=Date.now()){return buildSurroundFusion({vehicleId,observations:[...this.observations.values()],calibrations:this.calibrations,nowMs});}
  remove(cameraId:string){this.observations.delete(cameraId);this.lastSequence.delete(cameraId);this.calibrations.remove(cameraId);}
  clear(){this.observations.clear();this.lastSequence.clear();this.calibrations.clear();}
  get cameraCount(){return this.observations.size;}
}
