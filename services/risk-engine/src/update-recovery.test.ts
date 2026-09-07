import {describe,expect,it} from 'vitest';
import {ABRecoveryModel} from './update-recovery.js';

describe('ABRecoveryModel',()=>{
  it('keeps the known-good slot authoritative until candidate boot is accepted',()=>{
    const recovery=new ABRecoveryModel('A');
    expect(recovery.stageCandidate({slot:'B',softwareVersion:'0.0.7',rollbackIndex:7})).toMatchObject({phase:'candidate-written',activeSlot:'A',knownGoodSlot:'A',bootTarget:'A',candidateSlot:'B'});
    expect(recovery.beginCandidateBoot()).toMatchObject({phase:'booting-candidate',activeSlot:'A',knownGoodSlot:'A',bootTarget:'B',candidateSlot:'B'});
    expect(recovery.reportBootHealthy()).toMatchObject({phase:'accepted',activeSlot:'B',knownGoodSlot:'B',bootTarget:'B',candidateSlot:null});
  });

  it('rolls boot target back to known-good after candidate boot failure',()=>{
    const recovery=new ABRecoveryModel('A');
    recovery.stageCandidate({slot:'B',softwareVersion:'0.0.7',rollbackIndex:7});
    recovery.beginCandidateBoot();
    expect(recovery.reportBootFailure('watchdog-reset')).toMatchObject({phase:'rollback-required',activeSlot:'A',knownGoodSlot:'A',bootTarget:'A',candidateSlot:null,lastReason:'watchdog-reset'});
  });

  it('recovers to known-good if power is lost before candidate acceptance',()=>{
    const beforeBoot=new ABRecoveryModel('A');
    beforeBoot.stageCandidate({slot:'B',softwareVersion:'0.0.7',rollbackIndex:7});
    expect(beforeBoot.recoverAfterPowerLoss()).toMatchObject({phase:'rollback-required',activeSlot:'A',knownGoodSlot:'A',bootTarget:'A',candidateSlot:null});

    const duringBoot=new ABRecoveryModel('A');
    duringBoot.stageCandidate({slot:'B',softwareVersion:'0.0.7',rollbackIndex:7});
    duringBoot.beginCandidateBoot();
    expect(duringBoot.recoverAfterPowerLoss()).toMatchObject({phase:'rollback-required',activeSlot:'A',knownGoodSlot:'A',bootTarget:'A',candidateSlot:null});
  });

  it('rejects writing a candidate over the current known-good slot',()=>{
    const recovery=new ABRecoveryModel('A');
    expect(()=>recovery.stageCandidate({slot:'A',softwareVersion:'0.0.7',rollbackIndex:7})).toThrow(/inactive slot/);
  });

  it('does not permit candidate acceptance before a candidate boot',()=>{
    const recovery=new ABRecoveryModel('A');
    recovery.stageCandidate({slot:'B',softwareVersion:'0.0.7',rollbackIndex:7});
    expect(()=>recovery.reportBootHealthy()).toThrow(/requires booting-candidate/);
  });

  it('can reset to idle only after rollback has selected the known-good slot',()=>{
    const recovery=new ABRecoveryModel('B');
    recovery.stageCandidate({slot:'A',softwareVersion:'0.0.8',rollbackIndex:8});
    recovery.beginCandidateBoot();
    recovery.reportBootFailure();
    expect(recovery.resetAfterRollback()).toMatchObject({phase:'idle',activeSlot:'B',knownGoodSlot:'B',bootTarget:'B',candidateSlot:null,lastReason:null});
  });
});
