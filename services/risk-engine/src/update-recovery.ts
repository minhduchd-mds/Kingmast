export type RecoverySlot='A'|'B';
export type RecoveryPhase='idle'|'candidate-written'|'booting-candidate'|'accepted'|'rollback-required';

export interface RecoverySnapshot {
  phase:RecoveryPhase;
  activeSlot:RecoverySlot;
  knownGoodSlot:RecoverySlot;
  bootTarget:RecoverySlot;
  candidateSlot:RecoverySlot|null;
  candidateVersion:string|null;
  candidateRollbackIndex:number|null;
  lastReason:string|null;
}

export class ABRecoveryModel {
  #snapshot:RecoverySnapshot;

  constructor(initialKnownGood:RecoverySlot='A'){
    this.#snapshot={phase:'idle',activeSlot:initialKnownGood,knownGoodSlot:initialKnownGood,bootTarget:initialKnownGood,candidateSlot:null,candidateVersion:null,candidateRollbackIndex:null,lastReason:null};
  }

  snapshot(){return{...this.#snapshot};}

  stageCandidate(input:{slot:RecoverySlot;softwareVersion:string;rollbackIndex:number}){
    if(!['idle','accepted','rollback-required'].includes(this.#snapshot.phase))throw new Error(`recovery transition ${this.#snapshot.phase}->candidate-written not allowed`);
    if(input.slot===this.#snapshot.knownGoodSlot)throw new Error('candidate must be written to the inactive slot');
    if(!input.softwareVersion.trim())throw new Error('candidate softwareVersion is required');
    if(!Number.isSafeInteger(input.rollbackIndex)||input.rollbackIndex<0)throw new Error('candidate rollbackIndex must be a nonnegative integer');
    this.#snapshot={...this.#snapshot,phase:'candidate-written',activeSlot:this.#snapshot.knownGoodSlot,bootTarget:this.#snapshot.knownGoodSlot,candidateSlot:input.slot,candidateVersion:input.softwareVersion,candidateRollbackIndex:input.rollbackIndex,lastReason:null};
    return this.snapshot();
  }

  beginCandidateBoot(){
    this.#require('candidate-written');
    if(!this.#snapshot.candidateSlot)throw new Error('candidate slot missing');
    this.#snapshot={...this.#snapshot,phase:'booting-candidate',bootTarget:this.#snapshot.candidateSlot,lastReason:null};
    return this.snapshot();
  }

  reportBootHealthy(){
    this.#require('booting-candidate');
    const candidate=this.#snapshot.candidateSlot;
    if(!candidate)throw new Error('candidate slot missing');
    this.#snapshot={...this.#snapshot,phase:'accepted',activeSlot:candidate,knownGoodSlot:candidate,bootTarget:candidate,candidateSlot:null,candidateVersion:null,candidateRollbackIndex:null,lastReason:null};
    return this.snapshot();
  }

  reportBootFailure(reason='candidate-boot-health-failed'){
    this.#require('booting-candidate');
    this.#rollback(reason);
    return this.snapshot();
  }

  recoverAfterPowerLoss(reason='power-loss-before-acceptance'){
    if(this.#snapshot.phase==='candidate-written'||this.#snapshot.phase==='booting-candidate')this.#rollback(reason);
    return this.snapshot();
  }

  resetAfterRollback(){
    this.#require('rollback-required');
    this.#snapshot={...this.#snapshot,phase:'idle',activeSlot:this.#snapshot.knownGoodSlot,bootTarget:this.#snapshot.knownGoodSlot,candidateSlot:null,candidateVersion:null,candidateRollbackIndex:null,lastReason:null};
    return this.snapshot();
  }

  #rollback(reason:string){
    this.#snapshot={...this.#snapshot,phase:'rollback-required',activeSlot:this.#snapshot.knownGoodSlot,bootTarget:this.#snapshot.knownGoodSlot,candidateSlot:null,candidateVersion:null,candidateRollbackIndex:null,lastReason:reason};
  }

  #require(expected:RecoveryPhase){if(this.#snapshot.phase!==expected)throw new Error(`recovery transition requires ${expected}, got ${this.#snapshot.phase}`);}
}
