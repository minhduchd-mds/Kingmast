'use client';

import { AlertTriangle,CloudOff,RefreshCw,Route,ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { RoadContextController } from '../lib/road-context';
import { useI18n } from '../lib/i18n';
import styles from './RouteRecoveryPanel.module.css';

export default function RouteRecoveryPanel({road,online}:{road:RoadContextController;online:boolean}){
  const[retrying,setRetrying]=useState(false);const{isVietnamese}=useI18n();const tx=(en:string,vi:string)=>isVietnamese?vi:en;
  const showOffline=!online;
  const showCached=road.routeFromCache;
  const showDegraded=Boolean(road.route&&road.error);
  if(!showOffline&&!showCached&&!showDegraded)return null;

  const title=showOffline?(road.route?tx('Offline guidance','Dẫn đường ngoại tuyến'):tx('Offline navigation','Điều hướng ngoại tuyến')):showCached?tx('Cached route active','Đang dùng tuyến đã lưu'):tx('Road data degraded','Dữ liệu đường bị suy giảm');
  const message=showOffline
    ? road.route?tx('Current guidance remains visible, but destination search, rerouting and live road context pause until connectivity returns.','Hướng dẫn hiện tại vẫn hiển thị, nhưng tìm điểm đến, tính lại tuyến và ngữ cảnh đường trực tiếp sẽ tạm dừng cho tới khi có mạng trở lại.'):tx('Destination search and online routing are unavailable. Primary on-vehicle warnings remain active.','Tìm điểm đến và định tuyến trực tuyến không khả dụng. Các cảnh báo chính trên xe vẫn hoạt động.')
    : showCached?tx('This route was restored from local cache after the live routing service was unavailable. Verify signs and road closures before continuing.','Tuyến này được khôi phục từ bộ nhớ đệm sau khi dịch vụ định tuyến trực tiếp không khả dụng. Hãy kiểm tra biển báo và đường đóng trước khi tiếp tục.')
    :tx('Live road context is temporarily unavailable. Navigation can continue, but mapped limits and route intelligence may be stale.','Ngữ cảnh đường trực tiếp tạm thời không khả dụng. Dẫn đường vẫn có thể tiếp tục nhưng giới hạn trên bản đồ và thông tin tuyến có thể đã cũ.');

  async function retry(){
    if(!online||!road.destination||retrying)return;
    setRetrying(true);
    try{await road.reroute();}finally{setRetrying(false);}
  }

  return <section className={`${styles.panel} ${showOffline?styles.offline:showCached?styles.cached:styles.degraded}`} role="status" data-testid="route-recovery">
    <span className={styles.icon}>{showOffline?<CloudOff/>:showCached?<Route/>:<AlertTriangle/>}</span>
    <span className={styles.copy}><strong>{title}</strong><small>{message}</small>{road.routeFromCache?<em><ShieldCheck/> {tx('Cached guidance is advisory and may not include current closures.','Hướng dẫn đã lưu chỉ mang tính hỗ trợ và có thể chưa phản ánh các đoạn đường đang đóng.')}</em>:null}</span>
    <div className={styles.actions}>{online&&road.destination?<button type="button" disabled={retrying||road.routeLoading} onClick={()=>void retry()}><RefreshCw className={retrying||road.routeLoading?styles.spinning:''}/>{retrying||road.routeLoading?tx('Retrying…','Đang thử lại…'):tx('Retry route','Thử lại tuyến')}</button>:null}</div>
  </section>;
}
