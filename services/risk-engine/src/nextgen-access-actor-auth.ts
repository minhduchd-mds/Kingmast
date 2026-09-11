import type {FastifyRequest} from 'fastify';
import {OperatorReplayGuard,parseOperatorKeyRegistry,verifyOperatorRequest} from './operator-auth.js';
import {parseOperatorProfileBindings,resolveAccessActor,type AccessActorAuthority} from './operator-profile-binding.js';

export type AccessActorAuthFailure='missing-actor-binding'|'operator-auth-failed'|'local-dev-binding-missing';
export type AccessActorAuthResult={ok:true;actor:AccessActorAuthority}|{ok:false;reason:AccessActorAuthFailure;detail?:string};

function stringHeader(request:FastifyRequest,name:string){const value=request.headers[name];return typeof value==='string'?value:'';}
function loopback(ip:string){return ip==='127.0.0.1'||ip==='::1'||ip==='localhost';}

export function createNextgenAccessActorAuthorizer(input:{operatorKeysJson?:string;profileBindingsJson?:string;allowInsecureLocalDev?:boolean;replayMaxEntries?:number}={}){
  const operatorKeys=parseOperatorKeyRegistry(input.operatorKeysJson??process.env.KINGMAST_OPERATOR_KEYS_JSON??'{}');
  const bindings=parseOperatorProfileBindings(input.profileBindingsJson??process.env.KINGMAST_OPERATOR_PROFILE_BINDINGS_JSON??'{}');
  const replay=new OperatorReplayGuard(input.replayMaxEntries??2_048);
  const allowLocal=input.allowInsecureLocalDev??process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';

  return(request:FastifyRequest,payload:unknown,nowMs=Date.now()):AccessActorAuthResult=>{
    if(allowLocal&&loopback(request.ip)){
      const actor=resolveAccessActor({actorId:'loopback-dev',authMode:'local-dev'},bindings);
      return actor?{ok:true,actor}:{ok:false,reason:'local-dev-binding-missing'};
    }
    const operatorId=stringHeader(request,'x-kingmast-operator-id');
    const keyId=stringHeader(request,'x-kingmast-operator-key-id');
    const timestampMs=Number(stringHeader(request,'x-kingmast-operator-timestamp-ms'));
    const nonce=stringHeader(request,'x-kingmast-operator-nonce');
    const signature=stringHeader(request,'x-kingmast-operator-signature');
    const verified=verifyOperatorRequest({scope:'configuration:nextgen',operatorId,keyId,timestampMs,nonce,signature,payload,registry:operatorKeys,replayGuard:replay,nowMs});
    if(!verified.ok)return{ok:false,reason:'operator-auth-failed',detail:verified.reason};
    const actor=resolveAccessActor({actorId:verified.operatorId,authMode:'operator-ed25519'},bindings);
    return actor?{ok:true,actor}:{ok:false,reason:'missing-actor-binding'};
  };
}
