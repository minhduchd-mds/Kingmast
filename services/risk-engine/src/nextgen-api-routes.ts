import type { FastifyPluginAsync,FastifyReply,FastifyRequest } from 'fastify';
import type { NavigationRoute,VehiclePosition } from '@kingmast/contracts';
import type { CameraCalibrationProfile,DriverProfile,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { NextgenRuntime } from './nextgen-runtime.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';
import { AccessDecisionSchema,AuditQuerySchema,CameraCalibrationProfileSchema,DriverIdentitySignalSchema,DriverProfileSchema,NavigationHorizonRefreshSchema,VehicleAccessGrantSchema,VehicleQuerySchema } from './nextgen-api-contract.js';
import {refreshNextgenNavigation} from './nextgen-navigation-service.js';

export interface NextgenApiRouteOptions {
  runtime:NextgenRuntime;
  profiles:DriverProfileRepository;
  accessRepository:VehicleAccessRepository;
  requireViewer:(request:FastifyRequest,reply:FastifyReply)=>boolean;
  requireWrite:(request:FastifyRequest,reply:FastifyReply,payload:unknown)=>boolean;
}

export const nextgenApiRoutes:FastifyPluginAsync<NextgenApiRouteOptions>=async(app,options)=>{
  app.get('/v3/nextgen/runtime',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    return options.runtime.snapshot();
  });

  app.get('/v3/nextgen/cameras/calibration',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    return{calibrations:options.runtime.multiCamera.calibrations.list(),controlAuthority:'none'};
  });

  app.post('/v3/nextgen/cameras/calibration',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const parsed=CameraCalibrationProfileSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-camera-calibration',details:parsed.error.flatten()});
    const decision=options.runtime.configureCamera(parsed.data as CameraCalibrationProfile);
    if(!decision.accepted)return reply.code(409).send({error:'camera-calibration-rejected',reason:decision.reason});
    return{accepted:true,calibration:options.runtime.multiCamera.calibrations.get(parsed.data.cameraId),controlAuthority:'none'};
  });

  app.post('/v3/nextgen/navigation/horizon/refresh',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=NavigationHorizonRefreshSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-navigation-horizon-request',details:parsed.error.flatten()});
    return refreshNextgenNavigation(options.runtime,{vehicleId:parsed.data.vehicleId,vehicle:parsed.data.vehicle as VehiclePosition,route:(parsed.data.route??null) as NavigationRoute|null,collisionCritical:parsed.data.collisionCritical,lookaheadM:parsed.data.lookaheadM});
  });

  app.post('/v3/nextgen/identity/resolve',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=DriverIdentitySignalSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-driver-identity-signal'});
    const profiles=await options.profiles.list();
    const resolution=options.runtime.resolveDriver(profiles,parsed.data);
    return{profile:resolution.profile?{id:resolution.profile.id,displayName:resolution.profile.displayName,role:resolution.profile.role,ui:resolution.profile.ui,privacy:resolution.profile.privacy}:null,confidence:resolution.confidence,reason:resolution.reason};
  });

  app.post('/v3/nextgen/profiles',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const parsed=DriverProfileSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-driver-profile',details:parsed.error.flatten()});
    const saved=await options.profiles.save(parsed.data as DriverProfile);
    return{profile:{id:saved.id,displayName:saved.displayName,role:saved.role,ui:saved.ui,privacy:saved.privacy,home:saved.home,work:saved.work,updatedAtMs:saved.updatedAtMs}};
  });

  app.post('/v3/nextgen/access/grants',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const parsed=VehicleAccessGrantSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-access-grant',details:parsed.error.flatten()});
    const grant=await options.accessRepository.saveGrant(parsed.data as VehicleAccessGrant);
    options.runtime.access.upsert(grant);
    return{grant};
  });

  app.post('/v3/nextgen/access/decision',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=AccessDecisionSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-access-decision-request'});
    const grant=(await options.accessRepository.listGrants(parsed.data.vehicleId)).find((item)=>item.profileId===parsed.data.profileId)??null;
    if(grant)options.runtime.access.upsert(grant);
    const decision=options.runtime.access.decide(parsed.data.vehicleId,parsed.data.profileId,parsed.data.permission,parsed.data.nowMs??Date.now());
    const audit=options.runtime.access.auditLog(1)[0];if(audit)await options.accessRepository.appendAudit(audit);
    return decision;
  });

  app.post('/v3/nextgen/access/revoke',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const body=request.body as {grantId?:unknown};
    if(typeof body?.grantId!=='string'||body.grantId.trim().length<1||body.grantId.length>128)return reply.code(400).send({error:'invalid-grant-id'});
    const grant=await options.accessRepository.revoke(body.grantId.trim());
    if(!grant)return reply.code(404).send({error:'grant-not-found'});
    options.runtime.access.upsert(grant);
    return{grant};
  });

  app.get('/v3/nextgen/access/grants',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.query))return;
    const parsed=VehicleQuerySchema.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:'invalid-vehicle-query'});
    return{grants:await options.accessRepository.listGrants(parsed.data.vehicleId)};
  });

  app.get('/v3/nextgen/access/audit',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.query))return;
    const parsed=AuditQuerySchema.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:'invalid-audit-query'});
    return{events:await options.accessRepository.audit(parsed.data.limit)};
  });
};
