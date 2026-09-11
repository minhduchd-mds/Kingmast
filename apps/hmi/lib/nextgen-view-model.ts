import type { CameraRuntimeHealthView,NextgenRuntimeClientSnapshot } from './nextgen-client';

export type NextgenUiTone='neutral'|'good'|'caution'|'critical'|'unavailable';
export interface NextgenStatusCard {id:string;title:string;detail:string;tone:NextgenUiTone;priority:number;}

function driverCard(snapshot:NextgenRuntimeClientSnapshot,isVietnamese:boolean):NextgenStatusCard{
  const state=snapshot.driver.state;
  if(state==='drowsy')return{id:'driver',title:isVietnamese?'Nguy cơ buồn ngủ':'Drowsiness risk',detail:isVietnamese?'Nên nghỉ khi có thể.':'Take a break when safe.',tone:'critical',priority:100};
  if(state==='distracted')return{id:'driver',title:isVietnamese?'Tập trung lái xe':'Keep attention on road',detail:isVietnamese?'Hệ thống phát hiện mất tập trung.':'Driver attention appears reduced.',tone:'caution',priority:85};
  if(state==='attentive')return{id:'driver',title:isVietnamese?'Người lái sẵn sàng':'Driver attentive',detail:isVietnamese?'Theo dõi người lái đang hoạt động.':'Driver monitoring is active.',tone:'good',priority:25};
  return{id:'driver',title:isVietnamese?'Chưa xác định người lái':'Driver state unavailable',detail:isVietnamese?'Không dùng trạng thái cũ để suy luận.':'Stale driver state is not treated as current.',tone:'unavailable',priority:70};
}

function worstCameraHealth(items:CameraRuntimeHealthView[]){
  const rank:Record<CameraRuntimeHealthView['status'],number>={overloaded:4,degraded:3,unavailable:2,ok:1};
  return [...items].sort((a,b)=>rank[b.status]-rank[a.status]||(b.p95LatencyMs??0)-(a.p95LatencyMs??0))[0]??null;
}

function cameraCard(snapshot:NextgenRuntimeClientSnapshot,isVietnamese:boolean):NextgenStatusCard{
  const health=worstCameraHealth(snapshot.cameraRuntimeHealth??[]);
  if(health){
    const p95=health.p95LatencyMs===null?'—':`${Math.round(health.p95LatencyMs)} ms`;
    const dropped=`${Math.round(health.dropRate*100)}%`;
    if(health.status==='overloaded')return{id:'camera',title:isVietnamese?'Camera đang quá tải':'Vision runtime overloaded',detail:isVietnamese?`${health.cameraId} · P95 ${p95} · bỏ ${dropped}`:`${health.cameraId} · P95 ${p95} · ${dropped} dropped`,tone:'caution',priority:88};
    if(health.status==='degraded')return{id:'camera',title:isVietnamese?'Camera đang suy giảm':'Vision runtime degraded',detail:isVietnamese?`${health.cameraId} · P95 ${p95} · bỏ ${dropped}`:`${health.cameraId} · P95 ${p95} · ${dropped} dropped`,tone:'caution',priority:76};
    if(health.status==='unavailable')return{id:'camera',title:isVietnamese?'Camera chưa sẵn sàng':'Vision runtime unavailable',detail:isVietnamese?`${health.cameraId} chưa có frame xử lý hợp lệ.`:`${health.cameraId} has no valid processed frame.`,tone:'unavailable',priority:68};
    return{id:'camera',title:isVietnamese?'Camera thời gian thực':'Realtime vision',detail:isVietnamese?`${health.cameraId} · P95 ${p95} · bỏ ${dropped}`:`${health.cameraId} · P95 ${p95} · ${dropped} dropped`,tone:'good',priority:20};
  }

  const metrics=snapshot.cameraPerformance;
  if(!metrics.length)return{id:'camera',title:isVietnamese?'Camera chưa có dữ liệu':'Camera data unavailable',detail:isVietnamese?'Chưa có số liệu xử lý ảnh hiện tại.':'No current vision performance evidence.',tone:'unavailable',priority:65};
  const worstP95=Math.max(...metrics.map((item)=>item.p95LatencyMs??0));
  const dropped=metrics.reduce((sum,item)=>sum+item.droppedFrames,0);
  if(worstP95>350)return{id:'camera',title:isVietnamese?'Camera xử lý chậm':'Vision latency high',detail:isVietnamese?`P95 ${Math.round(worstP95)} ms · bỏ ${dropped} frame`:`P95 ${Math.round(worstP95)} ms · ${dropped} dropped frames`,tone:'caution',priority:75};
  return{id:'camera',title:isVietnamese?'Camera thời gian thực':'Realtime vision',detail:isVietnamese?`P95 ${Math.round(worstP95)} ms · bỏ ${dropped} frame`:`P95 ${Math.round(worstP95)} ms · ${dropped} dropped frames`,tone:'good',priority:20};
}

function perceptionCard(snapshot:NextgenRuntimeClientSnapshot,isVietnamese:boolean):NextgenStatusCard{
  const trust=snapshot.perceptionTrust;
  if(!snapshot.perception||!trust)return{id:'perception',title:isVietnamese?'Nhận thức môi trường chưa sẵn sàng':'Perception unavailable',detail:isVietnamese?'Không có frame hiện tại đủ tin cậy.':'No current trusted perception frame.',tone:'unavailable',priority:80};
  if(!trust.eligibleForAlerts)return{id:'perception',title:isVietnamese?'Dữ liệu perception suy giảm':'Perception degraded',detail:trust.reasons.slice(0,2).join(' · ')||'degraded',tone:'caution',priority:78};
  return{id:'perception',title:isVietnamese?'Nhận thức môi trường':'Environment perception',detail:isVietnamese?`${trust.uniqueCameraCount} camera hợp lệ${trust.surroundReady?' · 360 sẵn sàng':''}`:`${trust.uniqueCameraCount} trusted cameras${trust.surroundReady?' · surround ready':''}`,tone:'good',priority:30};
}

function advisoryCards(snapshot:NextgenRuntimeClientSnapshot):NextgenStatusCard[]{return snapshot.advisories.slice(0,3).map((item,index)=>({id:`advisory-${item.id}`,title:item.title,detail:item.message,tone:item.severity==='critical'?'critical':item.severity==='caution'?'caution':'neutral',priority:(item.severity==='critical'?120:item.severity==='caution'?90:40)-index}));}

export function buildNextgenStatusCards(snapshot:NextgenRuntimeClientSnapshot|null,isVietnamese=true):NextgenStatusCard[]{
  if(!snapshot)return[{id:'runtime',title:isVietnamese?'Trí tuệ xe chưa kết nối':'Vehicle intelligence unavailable',detail:isVietnamese?'Hệ thống không suy luận từ dữ liệu cũ.':'The HMI will not infer from stale data.',tone:'unavailable',priority:100}];
  return[...advisoryCards(snapshot),driverCard(snapshot,isVietnamese),perceptionCard(snapshot,isVietnamese),cameraCard(snapshot,isVietnamese)].sort((a,b)=>b.priority-a.priority);
}
