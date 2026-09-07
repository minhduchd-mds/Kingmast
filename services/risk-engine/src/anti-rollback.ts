import type { UpdateLifecycleSnapshot } from './update-state.js';

export interface RollbackIndexStore {
  read():Promise<number>;
  commit(next:number):Promise<void>;
  protection:'memory-test-only'|'hardware-protected';
}

function validIndex(value:number){return Number.isInteger(value)&&value>=0&&value<=2_147_483_647;}

export class MemoryRollbackIndexStore implements RollbackIndexStore {
  protection='memory-test-only' as const;
  #value:number;
  constructor(initial=0){if(!validIndex(initial))throw new Error('invalid initial rollback index');this.#value=initial;}
  async read(){return this.#value;}
  async commit(next:number){
    if(!validIndex(next))throw new Error('invalid rollback index');
    if(next<this.#value)throw new Error('rollback index cannot decrease');
    this.#value=next;
  }
}

export type RollbackDecision=
  | {allowed:true;minimumRollbackIndex:number;candidateRollbackIndex:number}
  | {allowed:false;minimumRollbackIndex:number;candidateRollbackIndex:number;reason:'rollback-index-invalid'|'rollback-index-below-floor'};

export class AntiRollbackGuard {
  constructor(private readonly store:RollbackIndexStore){}

  async evaluateCandidate(candidateRollbackIndex:number):Promise<RollbackDecision>{
    const minimumRollbackIndex=await this.store.read();
    if(!validIndex(candidateRollbackIndex))return{allowed:false,minimumRollbackIndex,candidateRollbackIndex,reason:'rollback-index-invalid'};
    if(candidateRollbackIndex<minimumRollbackIndex)return{allowed:false,minimumRollbackIndex,candidateRollbackIndex,reason:'rollback-index-below-floor'};
    return{allowed:true,minimumRollbackIndex,candidateRollbackIndex};
  }

  async commitAcceptedUpdate(snapshot:UpdateLifecycleSnapshot){
    if(snapshot.state!=='accepted')return{committed:false,reason:'update-not-boot-accepted' as const,minimumRollbackIndex:await this.store.read()};
    if(snapshot.rollbackIndex===null||!validIndex(snapshot.rollbackIndex))return{committed:false,reason:'rollback-index-invalid' as const,minimumRollbackIndex:await this.store.read()};
    const current=await this.store.read();
    if(snapshot.rollbackIndex<current)return{committed:false,reason:'rollback-index-below-floor' as const,minimumRollbackIndex:current};
    await this.store.commit(snapshot.rollbackIndex);
    return{committed:true,rollbackIndex:snapshot.rollbackIndex,protection:this.store.protection};
  }
}
