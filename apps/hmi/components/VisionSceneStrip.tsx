'use client';

import {Eye,MoveHorizontal,Route,ScanLine} from 'lucide-react';
import type {VisionSceneSnapshot} from '@kingmast/contracts/vision-nextgen';
import {useI18n} from '../lib/i18n';

export default function VisionSceneStrip({scene}:{scene:VisionSceneSnapshot|null|undefined}){
  const{isVietnamese}=useI18n();
  if(!scene||scene.freshnessMs===null||scene.freshnessMs>1_200)return null;
  const lane=scene.lane.available&&scene.lane.laneWidthM!==null?scene.lane:null;
  const free=scene.freeSpace.available&&scene.freeSpace.forwardClearanceM!==null?scene.freeSpace:null;
  const speed=scene.trafficControls.speedLimitKmh;
  const signal=scene.trafficControls.signalState;
  if(!lane&&!free&&speed===null&&signal===null)return null;
  return <aside className="visionSceneStrip" role="status" aria-label={isVietnamese?'Nhận thức camera hiện tại':'Current camera perception'} data-testid="vision-scene-strip" data-control-authority="none">
    <span className="visionSceneLead"><Eye strokeWidth={1.8}/><small>{isVietnamese?'Camera đã hiệu chuẩn':'Calibrated vision'}</small></span>
    {lane?<span className="visionSceneMetric"><MoveHorizontal strokeWidth={1.8}/><b>{lane.laneWidthM.toFixed(1)} m</b><small>{isVietnamese?'bề rộng làn':'lane width'}</small></span>:null}
    {free?<span className="visionSceneMetric"><ScanLine strokeWidth={1.8}/><b>{Math.round(free.forwardClearanceM!)} m</b><small>{isVietnamese?'khoảng trống trước':'forward clearance'}</small></span>:null}
    {speed!==null?<span className="visionSceneMetric"><Route strokeWidth={1.8}/><b>{speed}</b><small>km/h · {isVietnamese?'biển quan sát':'observed sign'}</small></span>:null}
    {signal!==null?<span className="visionSceneMetric"><span className="visionSignalDot" aria-hidden="true"/><b>{signal}</b><small>{isVietnamese?'tín hiệu quan sát':'observed signal'}</small></span>:null}
  </aside>;
}
