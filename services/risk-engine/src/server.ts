import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { assessRisk } from './risk.js';

const app=Fastify({logger:true,bodyLimit:32_768});
await app.register(helmet);
await app.register(cors,{origin:process.env.HMI_ORIGIN??'http://localhost:3000',methods:['GET','POST']});
const Sample=z.object({timestampMs:z.number().int(),egoSpeedMps:z.number().min(0).max(100),targetSpeedMps:z.number().min(-50).max(100),rangeM:z.number().min(0).max(500),confidence:z.number().min(0).max(1),canHealthy:z.boolean(),radarHealthy:z.boolean(),cameraHealthy:z.boolean()});
app.get('/health',async()=>({status:'ok',mode:'warning-only'}));
app.post('/v1/risk',async(req,reply)=>{const parsed=Sample.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'invalid-sample'});return assessRisk(parsed.data);});
app.get('/v1/capabilities',async()=>({vehicleControl:false,canWrite:false,brake:false,steer:false,throttle:false}));
await app.listen({port:Number(process.env.PORT??4000),host:'0.0.0.0'});
