import { expect,test } from '@playwright/test';
import type { NextgenRuntimeClientSnapshot } from '../lib/nextgen-client';
import { buildNextgenStatusCards } from '../lib/nextgen-view-model';

function snapshot():NextgenRuntimeClientSnapshot{return{perception:null,perceptionTrust:null,surround:null,visionScene:{generatedAtMs:1_800_000_000_000,lane:{available:false,confidence:0,leftBoundaryM:null,rightBoundaryM:null,laneWidthM:null,curvature1pm:null,observedAtMs:null,sourceCameraIds:[],reason:'camera-unavailable',advisoryOnly:true},freeSpace:{available:false,confidence:0,forwardClearanceM:null,minimumClearanceM:null,sectorCount:0,observedAtMs:null,sourceCameraIds:[],reason:'camera-unavailable',visualizationOnly:true},trafficControls:{speedLimitKmh:null,speedLimitConfidence:0,signalState:null,signalConfidence:0,stopSignDistanceM:null,yieldSignDistanceM:null,observedAtMs:null,sourceCameraIds:[],degradedReasons:[],advisoryOnly:true},freshnessMs:null,advisoryOnly:true,controlAuthority:'none'},navigationHorizon:null,driver:{state:'driver-unavailable',confidence:0,observedAtMs:null,ageMs:null,reason:'stale-driver-observation',advisoryOnly:true},activeProfileId:null,advisories:[],cameraPerformance:[],controlAuthority:'none'};}

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

test('server-classified camera overload renders as caution',()=>{
  const value=snapshot();
  value.cameraRuntimeHealth=[{cameraId:'front-1',status:'overloaded',dropRate:.54,p50LatencyMs:420,p95LatencyMs:810}];
  const camera=buildNextgenStatusCards(value,false).find((card)=>card.id==='camera');
  expect(camera?.tone).toBe('caution');
  expect(camera?.title).toContain('overloaded');
  expect(camera?.detail).toContain('54%');
});

test('healthy camera runtime stays informational and never claims vehicle control',()=>{
  const value=snapshot();
  value.cameraRuntimeHealth=[{cameraId:'front-1',status:'ok',dropRate:.02,p50LatencyMs:42,p95LatencyMs:78}];
  const camera=buildNextgenStatusCards(value,false).find((card)=>card.id==='camera');
  expect(camera?.tone).toBe('good');
  expect(value.controlAuthority).toBe('none');
});
