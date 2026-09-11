import type {FastifyPluginAsync,FastifyReply,FastifyRequest} from 'fastify';
import type {CalibratedCameraObservation,TrafficControlObservation} from '@kingmast/contracts/nextgen';
import type {DeviceIngressScope} from './device-auth.js';
import {NextgenRuntime} from './nextgen-runtime.js';
import {CalibratedCameraIngressSchema,TrafficControlIngressSchema} from './nextgen-vision-ingress-contract.js';

export interface VisionIngressIdentity {deviceId:string|null;}
export interface NextgenVisionIngressOptions {
  runtime:NextgenRuntime;
  requireDevice:(request:FastifyRequest,reply:FastifyReply,scope:DeviceIngressScope,timestampMs:number,payload:unknown)=>VisionIngressIdentity|null;
}

function enforceVehicleBinding(identity:VisionIngressIdentity,vehicleId:string,reply:FastifyReply){
  if(identity.deviceId!==null&&identity.deviceId!==vehicleId){reply.code(403).send({error:'vehicle-device-mismatch'});return false;}
  return true;
}

export const nextgenVisionIngressRoutes:FastifyPluginAsync<NextgenVisionIngressOptions>=async(app,options)=>{
  app.post('/v3/nextgen/perception/camera',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{
    const parsed=CalibratedCameraIngressSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-calibrated-camera-observation',details:parsed.error.flatten()});
    const identity=options.requireDevice(request,reply,'perception:camera',parsed.data.observation.capturedAtMs,parsed.data);
    if(!identity||!enforceVehicleBinding(identity,parsed.data.vehicleId,reply))return;
    if(!options.runtime.multiCamera.calibrations.get(parsed.data.observation.cameraId))return reply.code(409).send({error:'camera-calibration-required'});
    const result=options.runtime.ingestCalibratedCamera(parsed.data.vehicleId,parsed.data.observation as CalibratedCameraObservation,Date.now());
    if(!result.accepted)return reply.code(409).send({error:'calibrated-camera-rejected',reason:result.reason});
    return{accepted:true,surround:result.surround,visionScene:result.visionScene,controlAuthority:'none'};
  });

  app.post('/v3/nextgen/perception/traffic-control',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{
    const parsed=TrafficControlIngressSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-traffic-control-observation',details:parsed.error.flatten()});
    const identity=options.requireDevice(request,reply,'perception:camera',parsed.data.observation.capturedAtMs,parsed.data);
    if(!identity||!enforceVehicleBinding(identity,parsed.data.vehicleId,reply))return;
    if(!options.runtime.multiCamera.calibrations.get(parsed.data.observation.cameraId))return reply.code(409).send({error:'camera-calibration-required'});
    const decision=options.runtime.ingestTrafficControl(parsed.data.observation as TrafficControlObservation,Date.now());
    return{accepted:decision.usable,reason:decision.reason,trafficControls:options.runtime.snapshot().visionScene.trafficControls,controlAuthority:'none'};
  });
};
