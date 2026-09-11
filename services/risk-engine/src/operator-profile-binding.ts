import type {ConfigurationAuthMode} from './configuration-audit.js';

const ID_RE=/^[A-Za-z0-9._:@-]{1,96}$/;
const MAX_BINDINGS=256;

export type OperatorProfileBindings=ReadonlyMap<string,string>;
export interface AccessActorAuthority{actorId:string;profileId:string;authMode:Extract<ConfigurationAuthMode,'operator-ed25519'|'local-dev'>;}

export function parseOperatorProfileBindings(raw:string):OperatorProfileBindings{
  let parsed:unknown;
  try{parsed=JSON.parse(raw||'{}');}catch{throw new Error('KINGMAST_OPERATOR_PROFILE_BINDINGS_JSON must be valid JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('KINGMAST_OPERATOR_PROFILE_BINDINGS_JSON must be an object');
  const entries=Object.entries(parsed as Record<string,unknown>);
  if(entries.length>MAX_BINDINGS)throw new Error(`operator profile bindings exceed ${MAX_BINDINGS}`);
  const result=new Map<string,string>();
  for(const[actorId,value]of entries){
    if(!ID_RE.test(actorId))throw new Error(`invalid operator profile actor ${actorId}`);
    if(typeof value!=='string'||!ID_RE.test(value))throw new Error(`invalid profile binding for ${actorId}`);
    result.set(actorId,value);
  }
  return result;
}

export function resolveAccessActor(input:{actorId:string;authMode:ConfigurationAuthMode},bindings:OperatorProfileBindings):AccessActorAuthority|null{
  if(input.authMode==='migration-token')return null;
  if(input.authMode!=='operator-ed25519'&&input.authMode!=='local-dev')return null;
  const profileId=bindings.get(input.actorId);
  return profileId?{actorId:input.actorId,profileId,authMode:input.authMode}:null;
}

export function operatorProfileBindingSummary(bindings:OperatorProfileBindings){return{bindings:bindings.size,migrationTokenEligible:false,individualActorRequired:true};}
