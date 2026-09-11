import type { NavigationHorizon,PredictiveAdvisory } from '@kingmast/contracts/nextgen';

export interface PredictiveContext {speedKmh:number|null;nowMs?:number;}

function advisoryMessage(kind:PredictiveAdvisory['kind'],distanceM:number,advisorySpeedKmh:number|null){
  const distance=distanceM<1000?`${Math.round(distanceM)} m`:`${(distanceM/1000).toFixed(1)} km`;
  if(kind==='speed-limit'&&advisorySpeedKmh!==null)return `Giới hạn ${Math.round(advisorySpeedKmh)} km/h sau ${distance}.`;
  if(kind==='curvature')return `Đoạn cua phía trước sau ${distance}.`;
  if(kind==='school-zone')return `Khu vực trường học phía trước sau ${distance}.`;
  if(kind==='construction-zone')return `Khu vực thi công phía trước sau ${distance}.`;
  if(kind==='hazard')return `Nguy cơ trên tuyến phía trước sau ${distance}.`;
  if(kind==='traffic')return `Tình trạng giao thông thay đổi sau ${distance}.`;
  if(kind==='lane-guidance')return `Chuẩn bị đúng làn sau ${distance}.`;
  if(kind==='junction')return `Nút giao phía trước sau ${distance}.`;
  if(kind==='grade')return `Độ dốc tuyến đường thay đổi sau ${distance}.`;
  return `Thông tin tuyến đường phía trước sau ${distance}.`;
}

export function buildPredictiveAdvisories(horizon:NavigationHorizon,context:PredictiveContext):PredictiveAdvisory[]{
  const nowMs=context.nowMs??Date.now();
  if(horizon.coverage==='unavailable')return[];
  const advisories=horizon.events
    .filter((event)=>event.distanceM>=0&&event.distanceM<=horizon.lookaheadM&&event.confidence>=.55&&event.evidence.health!=='unavailable')
    .map((event)=>{
      let severity=event.severity;
      if(event.kind==='speed-limit'&&event.advisorySpeedKmh!==null&&context.speedKmh!==null){
        const excess=context.speedKmh-event.advisorySpeedKmh;
        if(excess>=20)severity='critical';else if(excess>=5&&severity==='safe')severity='caution';
      }
      return{id:`predictive:${event.id}`,kind:event.kind,severity,title:event.title,message:advisoryMessage(event.kind,event.distanceM,event.advisorySpeedKmh),distanceM:event.distanceM,confidence:event.confidence,generatedAtMs:nowMs,advisoryOnly:true as const};
    });
  const rank={critical:0,caution:1,safe:2} as const;
  return advisories.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.distanceM-b.distanceM||b.confidence-a.confidence).slice(0,12);
}
