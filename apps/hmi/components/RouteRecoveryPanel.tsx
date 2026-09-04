'use client';

import { AlertTriangle,CloudOff,RefreshCw,Route,ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { RoadContextController } from '../lib/road-context';
import styles from './RouteRecoveryPanel.module.css';

export default function RouteRecoveryPanel({road,online}:{road:RoadContextController;online:boolean}){
  const[retrying,setRetrying]=useState(false);
  const showOffline=!online;
  const showCached=road.routeFromCache;
  const showDegraded=Boolean(road.route&&road.error);
  if(!showOffline&&!showCached&&!showDegraded)return null;

  const title=showOffline?(road.route?'Offline guidance':'Offline navigation'):showCached?'Cached route active':'Road data degraded';
  const message=showOffline
    ? road.route?'Current guidance remains visible, but destination search, rerouting and live road context pause until connectivity returns.':'Destination search and online routing are unavailable. Primary on-vehicle warnings remain active.'
    : showCached?'This route was restored from local cache after the live routing service was unavailable. Verify signs and road closures before continuing.'
    :'Live road context is temporarily unavailable. Navigation can continue, but mapped limits and route intelligence may be stale.';

  async function retry(){
    if(!online||!road.destination||retrying)return;
    setRetrying(true);
    try{await road.reroute();}finally{setRetrying(false);}
  }

  return <section className={`${styles.panel} ${showOffline?styles.offline:showCached?styles.cached:styles.degraded}`} role="status" data-testid="route-recovery">
    <span className={styles.icon}>{showOffline?<CloudOff/>:showCached?<Route/>:<AlertTriangle/>}</span>
    <span className={styles.copy}><strong>{title}</strong><small>{message}</small>{road.routeFromCache?<em><ShieldCheck/> Cached guidance is advisory and may not include current closures.</em>:null}</span>
    <div className={styles.actions}>{online&&road.destination?<button type="button" disabled={retrying||road.routeLoading} onClick={()=>void retry()}><RefreshCw className={retrying||road.routeLoading?styles.spinning:''}/>{retrying||road.routeLoading?'Retrying…':'Retry route'}</button>:null}</div>
  </section>;
}
