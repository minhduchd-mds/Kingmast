import type { InstallEligibilityResult,UpdateManifest } from './update-verifier.js';

export type UpdateLifecycleState=
  | 'idle'
  | 'staged'
  | 'verified'
  | 'ready'
  | 'installing'
  | 'pending-boot'
  | 'accepted'
  | 'rollback-required'
  | 'failed';

export interface UpdateLifecycleSnapshot {
  state:UpdateLifecycleState;
  updateId:string|null;
  softwareVersion:string|null;
  rollbackIndex:number|null;
  lastReason:string|null;
  changedAtMs:number;
}

export class UpdateLifecycle {
  #snapshot:UpdateLifecycleSnapshot={state:'idle',updateId:null,softwareVersion:null,rollbackIndex:null,lastReason:null,changedAtMs:0};

  snapshot(){return{...this.#snapshot};}

  stage(manifest:Pick<UpdateManifest,'updateId'|'softwareVersion'|'rollbackIndex'>,nowMs=Date.now()){
    if(!['idle','accepted','failed','rollback-required'].includes(this.#snapshot.state))throw new Error(`update transition ${this.#snapshot.state}->staged not allowed`);
    this.#snapshot={state:'staged',updateId:manifest.updateId,softwareVersion:manifest.softwareVersion,rollbackIndex:manifest.rollbackIndex,lastReason:null,changedAtMs:nowMs};
    return this.snapshot();
  }

  markVerified(nowMs=Date.now()){
    this.#require('staged');
    this.#set('verified',null,nowMs);
    return this.snapshot();
  }

  markReady(eligibility:InstallEligibilityResult,nowMs=Date.now()){
    this.#require('verified');
    if(!eligibility.eligible){this.#set('failed',eligibility.reasons.join(','),nowMs);return this.snapshot();}
    this.#set('ready',null,nowMs);
    return this.snapshot();
  }

  beginInstall(nowMs=Date.now()){
    this.#require('ready');
    this.#set('installing',null,nowMs);
    return this.snapshot();
  }

  markInstalled(nowMs=Date.now()){
    this.#require('installing');
    this.#set('pending-boot',null,nowMs);
    return this.snapshot();
  }

  reportBootHealthy(nowMs=Date.now()){
    this.#require('pending-boot');
    this.#set('accepted',null,nowMs);
    return this.snapshot();
  }

  reportBootFailure(reason='boot-health-failed',nowMs=Date.now()){
    this.#require('pending-boot');
    this.#set('rollback-required',reason,nowMs);
    return this.snapshot();
  }

  fail(reason:string,nowMs=Date.now()){
    if(this.#snapshot.state==='installing'||this.#snapshot.state==='pending-boot')this.#set('rollback-required',reason,nowMs);
    else this.#set('failed',reason,nowMs);
    return this.snapshot();
  }

  #require(expected:UpdateLifecycleState){if(this.#snapshot.state!==expected)throw new Error(`update transition requires ${expected}, got ${this.#snapshot.state}`);}
  #set(state:UpdateLifecycleState,lastReason:string|null,changedAtMs:number){this.#snapshot={...this.#snapshot,state,lastReason,changedAtMs};}
}
