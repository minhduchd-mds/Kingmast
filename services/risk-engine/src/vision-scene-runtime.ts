import type { CalibratedCameraObservation,TrafficControlObservation } from '@kingmast/contracts/nextgen';
import type { VisionSceneSnapshot } from '@kingmast/contracts/vision-nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';
import {estimateVisionFreeSpace} from './vision-free-space.js';
import {estimateVisionLane} from './vision-lane-estimator.js';
import {VisionTrafficControlTracker} from './vision-traffic-control-tracker.js';

const MAX_CAMERAS=8;

export class VisionSceneRuntime{
  readonly trafficControls=new VisionTrafficControlTracker();
  private readonly observations=new Map<string,CalibratedCameraObservation>();

  ingestCamera(observation:CalibratedCameraObservation){
    if(!this.observations.has(observation.cameraId)&&this.observations.size>=MAX_CAMERAS)return{accepted:false as const,reason:'capacity' as const};
    const bounded:CalibratedCameraObservation={...structuredClone(observation),detections:observation.detections.slice(0,256),lanes:observation.lanes.slice(0,16),freeSpace:observation.freeSpace.slice(0,72)};
    this.observations.set(observation.cameraId,bounded);
    return{accepted:true as const,reason:'accepted' as const};
  }

  ingestTrafficControl(observation:TrafficControlObservation,nowMs=Date.now()){return this.trafficControls.ingest(observation,nowMs);}

  snapshot(calibrations:CameraCalibrationRegistry,nowMs=Date.now()):VisionSceneSnapshot{
    const observations=[...this.observations.values()];
    const lane=estimateVisionLane(observations,calibrations,nowMs);
    const freeSpace=estimateVisionFreeSpace(observations,calibrations,nowMs);
    const trafficControls=this.trafficControls.snapshot(nowMs);
    const observed=[lane.observedAtMs,freeSpace.observedAtMs,trafficControls.observedAtMs].filter((value):value is number=>value!==null);
    const freshnessMs=observed.length?Math.max(0,nowMs-Math.max(...observed)):null;
    return{generatedAtMs:nowMs,lane,freeSpace,trafficControls,freshnessMs,advisoryOnly:true,controlAuthority:'none'};
  }

  removeCamera(cameraId:string){return this.observations.delete(cameraId);}
  clear(){this.observations.clear();this.trafficControls.clear();}
  get cameraCount(){return this.observations.size;}
}
