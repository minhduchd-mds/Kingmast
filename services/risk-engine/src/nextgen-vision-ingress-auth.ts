import {timingSafeEqual} from 'node:crypto';
import type {FastifyReply,FastifyRequest} from 'fastify';
import {parseDeviceKeyRegistry,verifyDeviceIngressAuth,type DeviceIngressScope,type DeviceKeyRegistry} from './device-auth.js';
import type {VisionIngressIdentity} from './nextgen-vision-ingress-routes.js';

export interface VisionIngressAuthConfig {
  registry:DeviceKeyRegistry;
  requireDeviceAuth:boolean;
  edgeToken:string;
  allowInsecureLocalDev:boolean;
}

function constantTimeEqual(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
function header(request:FastifyRequest,name:string){const value=request.headers[name];return typeof value==='string'?value.trim():'';}
function localDev(request:FastifyRequest,enabled:boolean){return enabled&&(request.ip==='127.0.0.1'||request.ip==='::1'||request.ip==='localhost');}

export function visionIngressAuthConfigFromEnv():VisionIngressAuthConfig{return{
  registry:parseDeviceKeyRegistry(process.env.KINGMAST_DEVICE_KEYS_JSON??'{}'),
  requireDeviceAuth:process.env.KINGMAST_REQUIRE_DEVICE_AUTH==='1',
  edgeToken:(process.env.KINGMAST_EDGE_TOKEN??'').trim(),
  allowInsecureLocalDev:process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1',
};}

export function createVisionIngressAuthorizer(config:VisionIngressAuthConfig=visionIngressAuthConfigFromEnv()){
  return(request:FastifyRequest,reply:FastifyReply,scope:DeviceIngressScope,timestampMs:number,payload:unknown):VisionIngressIdentity|null=>{
    if(localDev(request,config.allowInsecureLocalDev))return{deviceId:null};
    const result=verifyDeviceIngressAuth({scope,deviceId:header(request,'x-kingmast-device-id'),keyId:header(request,'x-kingmast-device-key-id'),signature:header(request,'x-kingmast-device-signature'),timestampMs,payload,registry:config.registry});
    if(result.ok)return{deviceId:result.deviceId};
    const edgeCandidate=header(request,'x-kingmast-edge-token');
    if(!config.requireDeviceAuth&&config.edgeToken.length>=16&&edgeCandidate&&constantTimeEqual(edgeCandidate,config.edgeToken))return{deviceId:null};
    reply.code(401).send({error:'device-auth-required',reason:result.reason});
    return null;
  };
}
