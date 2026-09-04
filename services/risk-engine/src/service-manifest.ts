export type ServicePermission='road-context.read'|'navigation.read'|'vehicle-health.read'|'notifications.publish'|'network';
export interface ServiceManifest{schemaVersion:1;id:string;name:string;version:string;permissions:ServicePermission[];entrypoint:string;signature:string;}
const ALLOWED=new Set<ServicePermission>(['road-context.read','navigation.read','vehicle-health.read','notifications.publish','network']);
const FORBIDDEN_PATTERN=/(brake|steer|steering|throttle|gear|torque|can[.-]?write|drivetrain)/i;

export function validateServiceManifest(input:ServiceManifest){
  const errors:string[]=[];
  if(input.schemaVersion!==1)errors.push('unsupported-schema');
  if(!/^[a-z0-9][a-z0-9.-]{2,63}$/.test(input.id))errors.push('invalid-id');
  if(!/^\d+\.\d+\.\d+$/.test(input.version))errors.push('invalid-version');
  if(!input.entrypoint.startsWith('https://'))errors.push('https-entrypoint-required');
  if(!/^[A-Za-z0-9+/=_-]{32,}$/.test(input.signature))errors.push('signature-required');
  for(const permission of input.permissions){if(FORBIDDEN_PATTERN.test(permission)||!ALLOWED.has(permission))errors.push(`permission-not-allowed:${permission}`);}
  return{valid:errors.length===0,errors,permissions:[...new Set(input.permissions)]};
}
