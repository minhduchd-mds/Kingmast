import type {FastifyPluginAsync,FastifyReply,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {NextgenRuntime} from './nextgen-runtime.js';
import {VehicleAccessRepository} from './vehicle-access-repository.js';
import {activeVehiclePermissions} from './vehicle-access.js';

const SelfAccessQuery=z.object({vehicleId:z.string().trim().min(1).max(96)});

export interface NextgenSelfAccessRouteOptions{
  runtime:NextgenRuntime;
  accessRepository:VehicleAccessRepository;
  requireViewer:(request:FastifyRequest,reply:FastifyReply)=>boolean;
}

export const nextgenSelfAccessRoutes:FastifyPluginAsync<NextgenSelfAccessRouteOptions>=async(app,options)=>{
  app.get('/v3/nextgen/access/self',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{
    if(!options.requireViewer(request,reply))return;
    const parsed=SelfAccessQuery.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:'invalid-vehicle-query'});
    const profileId=options.runtime.snapshot().activeProfileId;
    if(!profileId)return{profileId:null,grant:null,permissions:[],controlAuthority:'none'};
    const nowMs=Date.now();
    const grant=(await options.accessRepository.listGrants(parsed.data.vehicleId))
      .filter((item)=>item.profileId===profileId&&item.validFromMs<=nowMs&&(item.validUntilMs===null||item.validUntilMs>=nowMs)&&(item.revokedAtMs===null||item.revokedAtMs>nowMs))
      .sort((a,b)=>b.validFromMs-a.validFromMs)[0]??null;
    return{profileId,grant,permissions:activeVehiclePermissions(grant,parsed.data.vehicleId,profileId,nowMs),controlAuthority:'none'};
  });
};
