import { expect,test } from '@playwright/test';
import type { NextgenRuntimeClientSnapshot } from '../lib/nextgen-client';
import { buildNextgenStatusCards } from '../lib/nextgen-view-model';

function snapshot():NextgenRuntimeClientSnapshot{return{perception:null,perceptionTrust:null,surround:null,navigationHorizon:null,driver:{state:'driver-unavailable',confidence:0,observedAtMs:null,ageMs:null,reason:'stale-driver-observation',advisoryOnly:true},activeProfileId:null,advisories:[],cameraPerformance:[],controlAuthority:'none'};}

test('nextgen view fails closed when runtime is unavailable',()=>{
  const cards=buildNextgenStatusCards(null,true);
  expect(cards[0]?.tone).toBe('unavailable');
  expect(cards[0]?.detail).toContain('không suy luận');
});

test('critical predictive advisory outranks informational runtime cards',()=>{
  const value=snapshot();
  value.advisories=[{id:'curve-1',kind:'curvature',severity:'critical',title:'Cua gấp phía trước',message:'Đoạn cua phía trước sau 180 m.',distanceM:180,confidence:.95,generatedAtMs:1_800_000_000_000,advisoryOnly:true}];
  const cards=buildNextgenStatusCards(value,true);
  expect(cards[0]?.id).toBe('advisory-curve-1');
  expect(cards[0]?.tone).toBe('critical');
  expect(value.controlAuthority).toBe('none');
});

test('unknown driver and perception state never render as safe',()=>{
  const cards=buildNextgenStatusCards(snapshot(),false);
  const driver=cards.find((card)=>card.id==='driver');
  const perception=cards.find((card)=>card.id==='perception');
  expect(driver?.tone).toBe('unavailable');
  expect(perception?.tone).toBe('unavailable');
});
