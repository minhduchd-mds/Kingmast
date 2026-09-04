export type EmergencyState='idle'|'confirming'|'connecting'|'connected'|'failed'|'cancelled'|'unavailable';
export interface EmergencySession{
  state:EmergencyState;
  startedAtMs:number|null;
  updatedAtMs:number;
  providerId:string|null;
  incidentId:string|null;
  nativeConfirmed:boolean;
  message:string;
}

export function initialEmergencySession(nowMs=Date.now()):EmergencySession{return{state:'idle',startedAtMs:null,updatedAtMs:nowMs,providerId:null,incidentId:null,nativeConfirmed:false,message:'Emergency support ready when a native provider is configured.'};}
export function requestEmergencyConfirmation(session:EmergencySession,nowMs=Date.now()):EmergencySession{return{...session,state:'confirming',startedAtMs:nowMs,updatedAtMs:nowMs,nativeConfirmed:false,message:'Confirm emergency assistance request.'};}
export function beginEmergencyConnection(session:EmergencySession,providerId:string|null,nowMs=Date.now()):EmergencySession{
  if(session.state!=='confirming')throw new Error('emergency-confirmation-required');
  if(!providerId)return{...session,state:'unavailable',updatedAtMs:nowMs,providerId:null,nativeConfirmed:false,message:'Emergency provider integration is unavailable. Use the local emergency number or vehicle SOS system.'};
  return{...session,state:'connecting',updatedAtMs:nowMs,providerId,nativeConfirmed:false,message:'Connecting to the configured emergency provider.'};
}
export function confirmEmergencyConnected(session:EmergencySession,incidentId:string,nowMs=Date.now()):EmergencySession{
  if(session.state!=='connecting'||!session.providerId)throw new Error('emergency-provider-not-connecting');
  if(!incidentId.trim())throw new Error('incident-id-required');
  return{...session,state:'connected',updatedAtMs:nowMs,incidentId:incidentId.trim(),nativeConfirmed:true,message:'Emergency provider confirmed the incident connection.'};
}
export function failEmergencyConnection(session:EmergencySession,nowMs=Date.now()):EmergencySession{return{...session,state:'failed',updatedAtMs:nowMs,nativeConfirmed:false,message:'Emergency provider did not confirm a connection. Use an alternate emergency channel.'};}
export function cancelEmergency(session:EmergencySession,nowMs=Date.now()):EmergencySession{if(session.state==='connected')throw new Error('connected-emergency-cannot-be-silently-cancelled');return{...session,state:'cancelled',updatedAtMs:nowMs,nativeConfirmed:false,message:'Emergency request cancelled before provider confirmation.'};}
