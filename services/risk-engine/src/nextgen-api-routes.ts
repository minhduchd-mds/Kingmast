import type { FastifyPluginAsync,FastifyReply,FastifyRequest } from 'fastify';
import type { NavigationRoute,VehiclePosition } from '@kingmast/contracts';
import type { CameraCalibrationProfile,DriverProfile,ProfileMemoryEntry,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { NextgenRuntime } from './nextgen-runtime.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';
import { AccessDecisionSchema,AuditQuerySchema,CameraCalibrationProfileSchema,DriverIdentitySignalSchema,DriverProfileSchema,MemoryDeleteSchema,MemoryQuerySchema,NavigationHorizonRefreshSchema,ProfileMemoryEntrySchema,VehicleAccessGrantSchema,VehicleQuerySchema } from './nextgen-api-contract.js';
import {refreshNextgenNavigation} from './nextgen-navigation-service.js';
import {createVisionIngressAuthorizer} from './nextgen-vision-ingress-auth.js';
import {nextgenVisionIngressRoutes} from './nextgen-vision-ingress-routes.js';
import {validateGrantIssuance} from './vehicle-grant-policy.js';
import {validateGrantRevocation} from './vehicle-grant-revocation.js';
import {createNextgenAccessActorAuthorizer} from './nextgen-access-actor-auth.js';
import {activeVehiclePermissions} from './vehicle-access.js';

export interface NextgenApiRouteOptions {
  runtime:NextgenRuntime;
  profiles:DriverProfileRepository;
  accessRepository:VehicleAccessRepository;
  memoryRepository:ProfileMemoryRepository;
  requireViewer:(request:FastifyRequest,reply:FastifyReply)=>boolean;
  requireWrite:(request:FastifyRequest,reply:FastifyReply,payload:unknown)=>boolean;
  accessActorAuthorizer?:ReturnType<typeof createNextgenAccessActorAuthorizer>;
}

function accessAuthError(reply:FastifyReply,result:Exclude<ReturnType<ReturnType<typeof createNextgenAccessActorAuthorizer>>,{ok:true}>){
  const status=result.reason==='operator-auth-failed'?401:403;
  return reply.code(status).send({error:'access-actor-auth-required',reason:result.reason,detail:result.detail});
}

export const nextgenApiRoutes:FastifyPluginAsync<NextgenApiRouteOptions>=async(app,options)=>{
  const memory=options.memoryRepository;
  const authorizeAccessActor=options.accessActorAuthorizer??createNextgenAccessActorAuthorizer();
  await app.register(nextgenVisionIngressRoutes,{runtime:options.runtime,requireDevice:createVisionIngressAuthorizer()});

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
    if(!saved.privacy.personalization)await memory.clearProfile(saved.id);else if(!saved.privacy.locationHistory)await memory.clearLocationMemory(saved.id);
    return{profile:{id:saved.id,displayName:saved.displayName,role:saved.role,ui:saved.ui,privacy:saved.privacy,home:saved.home,work:saved.work,updatedAtMs:saved.updatedAtMs}};
  });

  app.get('/v3/nextgen/memory',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=MemoryQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-memory-query'});
    const profile=await options.profiles.get(parsed.data.profileId);if(!profile)return reply.code(404).send({error:'profile-not-found'});
    return{entries:await memory.list(profile),privacy:{personalization:profile.privacy.personalization,locationHistory:profile.privacy.locationHistory},controlAuthority:'none'};
  });

  app.post('/v3/nextgen/memory',{config:{rateLimit:{max:60,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const parsed=ProfileMemoryEntrySchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-profile-memory',details:parsed.error.flatten()});
    const profile=await options.profiles.get(parsed.data.profileId);if(!profile)return reply.code(404).send({error:'profile-not-found'});
    const saved=await memory.save(profile,parsed.data as ProfileMemoryEntry);if(!saved)return reply.code(409).send({error:'memory-not-permitted-by-profile-privacy'});
    return{entry:saved,controlAuthority:'none'};
  });

  app.post('/v3/nextgen/memory/delete',{config:{rateLimit:{max:60,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.body))return;
    const parsed=MemoryDeleteSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-memory-delete'});
    await memory.remove(parsed.data.profileId,parsed.data.id);return{deleted:true,controlAuthority:'none'};
  });

  app.get('/v3/nextgen/access/self',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=VehicleQuerySchema.safeParse(request.query);if(!parsed.success||!parsed.data.vehicleId)return reply.code(400).send({error:'invalid-vehicle-query'});
    const profileId=options.runtime.snapshot().activeProfileId;
    if(!profileId)return{profileId:null,grant:null,permissions:[],controlAuthority:'none'};
    const nowMs=Date.now();
    const grant=(await options.accessRepository.listGrants(parsed.data.vehicleId)).filter((item)=>item.profileId===profileId&&item.validFromMs<=nowMs&&(item.validUntilMs===null||item.validUntilMs>=nowMs)&&(item.revokedAtMs===null||item.revokedAtMs>nowMs)).sort((a,b)=>b.validFromMs-a.validFromMs)[0]??null;
    return{profileId,grant,permissions:activeVehiclePermissions(grant,parsed.data.vehicleId,profileId,nowMs),controlAuthority:'none'};
  });

  app.post('/v3/nextgen/access/grants',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{
    const actorAuth=authorizeAccessActor(request,request.body);if(!actorAuth.ok)return accessAuthError(reply,actorAuth);
    const parsed=VehicleAccessGrantSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid-access-grant',details:parsed.error.flatten()});
    const proposed=parsed.data as VehicleAccessGrant;
    if(proposed.issuedByProfileId!==actorAuth.actor.profileId)return reply.code(403).send({error:'access-actor-profile-mismatch'});
    const existing=await options.accessRepository.listGrants(proposed.vehicleId);
    const issuance=validateGrantIssuance(proposed,existing,Date.now());
    if(!issuance.allowed)return reply.code(409).send({error:'access-grant-rejected',reason:issuance.reason,allowedPermissions:issuance.normalizedPermissions});
    const grant=await options.accessRepository.saveGrant({...proposed,permissions:issuance.normalizedPermissions});
    options.runtime.access.upsert(grant);
    return{grant,actorProfileId:actorAuth.actor.profileId,controlAuthority:'none'};
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
    const actorAuth=authorizeAccessActor(request,request.body);if(!actorAuth.ok)return accessAuthError(reply,actorAuth);
    const body=request.body as {grantId?:unknown};
    if(typeof body?.grantId!=='string'||body.grantId.trim().length<1||body.grantId.length>128)return reply.code(400).send({error:'invalid-grant-id'});
    const target=await options.accessRepository.getGrant(body.grantId.trim());if(!target)return reply.code(404).send({error:'grant-not-found'});
    const grants=await options.accessRepository.listGrants(target.vehicleId);
    const decision=validateGrantRevocation({grantId:target.grantId,actorProfileId:actorAuth.actor.profileId,grants});
    if(!decision.allowed)return reply.code(409).send({error:'access-revoke-rejected',reason:decision.reason});
    const grant=await options.accessRepository.revoke(target.grantId);if(!grant)return reply.code(404).send({error:'grant-not-found'});
    options.runtime.access.upsert(grant);
    return{grant,actorProfileId:actorAuth.actor.profileId,controlAuthority:'none'};
  });

  app.get('/v3/nextgen/access/grants',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.query))return;
    const parsed=VehicleQuerySchema.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:'invalid-vehicle-query'});
    return{grants:await options.accessRepository.listGrants(parsed.data.vehicleId),controlAuthority:'none'};
  });

  app.get('/v3/nextgen/access/audit',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireWrite(request,reply,request.query))return;
    const parsed=AuditQuerySchema.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:'invalid-audit-query'});
    return{events:await options.accessRepository.audit(parsed.data.limit),controlAuthority:'none'};
  });
};
