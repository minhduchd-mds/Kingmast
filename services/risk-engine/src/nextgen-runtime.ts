import type { CalibratedCameraObservation,CameraCalibrationProfile,NavigationHorizon,PerceptionFrame,PredictiveAdvisory,DriverIdentitySignal,DriverProfile,DriverStateAssessment,DriverStateObservation,SurroundFusionSnapshot,TrafficControlObservation,VehiclePermission } from '@kingmast/contracts/nextgen';
import type { VisionSceneSnapshot } from '@kingmast/contracts/vision-nextgen';
import { buildPerceptionFrame,type RawPerceptionInput } from './perception-pipeline.js';
import { assessPerceptionTrust,type PerceptionTrustResult } from './perception-trust.js';
import { DriverStateEstimator } from './driver-state-estimator.js';
import { resolveDriverProfile,type DriverResolution } from './driver-profile.js';
import { ProfileMemoryStore } from './profile-memory.js';
import { VehicleAccessRegistry } from './vehicle-access-registry.js';
import { CameraPerformanceTracker } from './camera-performance.js';
import { buildPredictiveAdvisories } from './navigation-predictor.js';
import {MultiCameraRuntime} from './multicamera-runtime.js';
import {NavigationHorizonStore} from './navigation-horizon-store.js';
import {VisionSceneRuntime} from './vision-scene-runtime.js';

export interface NextgenRuntimeSnapshot {
  perception:PerceptionFrame|null;
  perceptionTrust:PerceptionTrustResult|null;
  surround:SurroundFusionSnapshot|null;
  visionScene:VisionSceneSnapshot;
  navigationHorizon:NavigationHorizon|null;
  driver:DriverStateAssessment;
  activeProfileId:string|null;
  advisories:PredictiveAdvisory[];
  cameraPerformance:ReturnType<CameraPerformanceTracker['all']>;
  cameraRuntimeHealth:ReturnType<CameraPerformanceTracker['healthAll']>;
  controlAuthority:'none';
}

export class NextgenRuntime{
  readonly memory=new ProfileMemoryStore();
  readonly access=new VehicleAccessRegistry();
  readonly cameraPerformance=new CameraPerformanceTracker();
  readonly multiCamera=new MultiCameraRuntime();
  readonly horizons=new NavigationHorizonStore();
  readonly vision=new VisionSceneRuntime();
  private readonly driverEstimator=new DriverStateEstimator();
  private perception:PerceptionFrame|null=null;
  private perceptionTrust:PerceptionTrustResult|null=null;
  private surround:SurroundFusionSnapshot|null=null;
  private driver:DriverStateAssessment={state:'driver-unavailable',confidence:0,observedAtMs:null,ageMs:null,reason:'no-driver-observation',advisoryOnly:true};
  private activeProfile:DriverProfile|null=null;
  private activeVehicleId:string|null=null;
  private advisories:PredictiveAdvisory[]=[];

  ingestPerception(input:RawPerceptionInput,nowMs=Date.now()){
    const frame=buildPerceptionFrame(input);
    for(const camera of frame.cameras){this.cameraPerformance.captured(camera.cameraId);this.cameraPerformance.processed(camera.cameraId,frame.capturedAtMs,nowMs);}
    this.perception=frame;
    this.activeVehicleId=frame.vehicleId;
    this.perceptionTrust=assessPerceptionTrust(frame,nowMs);
    return{frame,trust:this.perceptionTrust};
  }

  configureCamera(profile:CameraCalibrationProfile){return this.multiCamera.configure(profile);}

  ingestCalibratedCamera(vehicleId:string,observation:CalibratedCameraObservation,nowMs=Date.now()){
    this.cameraPerformance.captured(observation.cameraId);
    const accepted=this.multiCamera.ingest(observation,nowMs);
    if(!accepted.accepted){
      this.cameraPerformance.dropped(observation.cameraId);
      return{...accepted,surround:this.surround,visionScene:this.vision.snapshot(this.multiCamera.calibrations,nowMs)};
    }
    this.vision.ingestCamera(observation);
    this.activeVehicleId=vehicleId;
    this.cameraPerformance.processed(observation.cameraId,observation.capturedAtMs,nowMs);
    this.surround=this.multiCamera.surround(vehicleId,nowMs);
    return{...accepted,surround:this.surround,visionScene:this.vision.snapshot(this.multiCamera.calibrations,nowMs)};
  }

  ingestTrafficControl(observation:TrafficControlObservation,nowMs=Date.now()){
    return this.vision.ingestTrafficControl(observation,nowMs);
  }

  ingestDriverObservation(observation:DriverStateObservation,nowMs=Date.now()){
    this.driver=this.driverEstimator.ingest(observation,nowMs);
    return this.driver;
  }

  resolveDriver(profiles:DriverProfile[],signal:DriverIdentitySignal):DriverResolution{
    const resolution=resolveDriverProfile(profiles,signal);
    this.activeProfile=resolution.profile;
    if(this.activeProfile&&!this.activeProfile.privacy.locationHistory)this.memory.clearLocationMemory(this.activeProfile.id);
    return resolution;
  }

  updateNavigationHorizon(horizon:NavigationHorizon,speedKmh:number|null,nowMs=Date.now()){
    this.activeVehicleId=horizon.vehicleId;
    this.horizons.upsert(horizon);
    this.advisories=buildPredictiveAdvisories(horizon,{speedKmh,nowMs});
    return this.advisories.map((item)=>({...item}));
  }

  authorize(vehicleId:string,permission:VehiclePermission,nowMs=Date.now()){
    if(!this.activeProfile)return{allowed:false,permission,reason:'grant-not-active' as const};
    return this.access.decide(vehicleId,this.activeProfile.id,permission,nowMs);
  }

  snapshot(nowMs=Date.now()):NextgenRuntimeSnapshot{
    const horizon=this.activeVehicleId?this.horizons.snapshot(this.activeVehicleId,nowMs).horizon:null;
    const surround=this.surround&&nowMs-this.surround.generatedAtMs<=1_000?this.surround:null;
    return{
      perception:this.perception?{...this.perception,cameras:this.perception.cameras.map((item)=>({...item})),objects:this.perception.objects.map((item)=>({...item,sources:[...item.sources]})),lanes:this.perception.lanes.map((item)=>({...item})),freeSpace:this.perception.freeSpace.map((item)=>({...item})),degradedReasons:[...this.perception.degradedReasons]}:null,
      perceptionTrust:this.perceptionTrust?{...this.perceptionTrust,reasons:[...this.perceptionTrust.reasons],objects:this.perceptionTrust.objects.map((item)=>({...item,sources:[...item.sources]}))}:null,
      surround:surround?structuredClone(surround):null,
      visionScene:this.vision.snapshot(this.multiCamera.calibrations,nowMs),
      navigationHorizon:horizon,
      driver:{...this.driver},
      activeProfileId:this.activeProfile?.id??null,
      advisories:this.advisories.map((item)=>({...item})),
      cameraPerformance:this.cameraPerformance.all(),
      cameraRuntimeHealth:this.cameraPerformance.healthAll(),
      controlAuthority:'none',
    };
  }
}
