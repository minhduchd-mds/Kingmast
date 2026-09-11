export interface RealtimeLatencyBuckets {
  le20:number;
  le50:number;
  le100:number;
  le250:number;
  le500:number;
  gt500:number;
}

export interface RealtimeLatencySnapshot {
  lastMs:number|null;
  maxMs:number;
  samples:number;
  buckets:RealtimeLatencyBuckets;
}

export interface RealtimeLinkSnapshot {
  messages:number;
  connectAttempts:number;
  successfulConnections:number;
  reconnects:number;
  disconnects:number;
  sessionChanges:number;
  sequenceRegressions:number;
  malformedMessages:number;
  clockAnomalies:number;
  lastSequence:number;
  lastSession:string|null;
  serverToClient:RealtimeLatencySnapshot;
  ingressToClient:RealtimeLatencySnapshot;
}

export interface RealtimeTelemetryObservation {
  serverEnvelopeAtMs:number;
  ingressAtMs:number|null;
  clientAtMs:number;
  session:string;
  sequence:number;
}

export interface RealtimeTelemetryDecision {
  accepted:boolean;
  sessionChanged:boolean;
  serverToClientMs:number|null;
  ingressToClientMs:number|null;
}

function emptyBuckets():RealtimeLatencyBuckets{return{le20:0,le50:0,le100:0,le250:0,le500:0,gt500:0};}
function emptyLatency():RealtimeLatencySnapshot{return{lastMs:null,maxMs:0,samples:0,buckets:emptyBuckets()};}
function finiteTimestamp(value:number){return Number.isFinite(value)&&value>=0;}
function copyLatency(value:RealtimeLatencySnapshot):RealtimeLatencySnapshot{return{lastMs:value.lastMs,maxMs:value.maxMs,samples:value.samples,buckets:{...value.buckets}};}
function addLatency(target:RealtimeLatencySnapshot,value:number){
  const bounded=Math.min(60_000,Math.max(0,value));
  target.lastMs=Number(bounded.toFixed(3));
  target.maxMs=Math.max(target.maxMs,target.lastMs);
  target.samples+=1;
  if(bounded<=20)target.buckets.le20+=1;
  else if(bounded<=50)target.buckets.le50+=1;
  else if(bounded<=100)target.buckets.le100+=1;
  else if(bounded<=250)target.buckets.le250+=1;
  else if(bounded<=500)target.buckets.le500+=1;
  else target.buckets.gt500+=1;
}

export class RealtimeLinkAccumulator {
  private messages=0;
  private connectAttempts=0;
  private successfulConnections=0;
  private reconnects=0;
  private disconnects=0;
  private sessionChanges=0;
  private sequenceRegressions=0;
  private malformedMessages=0;
  private clockAnomalies=0;
  private lastSequence=-1;
  private lastSession='';
  private readonly serverToClient=emptyLatency();
  private readonly ingressToClient=emptyLatency();

  recordConnectAttempt(){this.connectAttempts+=1;}
  recordConnected(){this.successfulConnections+=1;if(this.successfulConnections>1)this.reconnects+=1;}
  recordDisconnect(){this.disconnects+=1;}
  recordMalformed(){this.malformedMessages+=1;}

  observeTelemetry(input:RealtimeTelemetryObservation):RealtimeTelemetryDecision{
    const ingressValid=input.ingressAtMs===null||finiteTimestamp(input.ingressAtMs);
    if(!Number.isInteger(input.sequence)||input.sequence<0||!input.session||!finiteTimestamp(input.serverEnvelopeAtMs)||!finiteTimestamp(input.clientAtMs)||!ingressValid){
      this.recordMalformed();
      return{accepted:false,sessionChanged:false,serverToClientMs:null,ingressToClientMs:null};
    }
    const sessionChanged=this.lastSession!==''&&this.lastSession!==input.session;
    if(this.lastSession!==input.session){if(sessionChanged)this.sessionChanges+=1;this.lastSession=input.session;this.lastSequence=-1;}
    if(input.sequence<=this.lastSequence){
      this.sequenceRegressions+=1;
      return{accepted:false,sessionChanged,serverToClientMs:null,ingressToClientMs:null};
    }
    this.lastSequence=input.sequence;
    this.messages+=1;

    let serverToClientMs:number|null=null;
    let ingressToClientMs:number|null=null;
    if(input.clientAtMs<input.serverEnvelopeAtMs)this.clockAnomalies+=1;
    else{serverToClientMs=input.clientAtMs-input.serverEnvelopeAtMs;addLatency(this.serverToClient,serverToClientMs);}
    if(input.ingressAtMs!==null){
      if(input.clientAtMs<input.ingressAtMs)this.clockAnomalies+=1;
      else{ingressToClientMs=input.clientAtMs-input.ingressAtMs;addLatency(this.ingressToClient,ingressToClientMs);}
    }
    return{accepted:true,sessionChanged,serverToClientMs,ingressToClientMs};
  }

  snapshot():RealtimeLinkSnapshot{
    return{
      messages:this.messages,
      connectAttempts:this.connectAttempts,
      successfulConnections:this.successfulConnections,
      reconnects:this.reconnects,
      disconnects:this.disconnects,
      sessionChanges:this.sessionChanges,
      sequenceRegressions:this.sequenceRegressions,
      malformedMessages:this.malformedMessages,
      clockAnomalies:this.clockAnomalies,
      lastSequence:this.lastSequence,
      lastSession:this.lastSession||null,
      serverToClient:copyLatency(this.serverToClient),
      ingressToClient:copyLatency(this.ingressToClient),
    };
  }
}
