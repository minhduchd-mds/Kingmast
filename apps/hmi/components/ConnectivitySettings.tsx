'use client';

import { Check,ExternalLink,Forget,LockKeyhole,RefreshCw,Signal,Wifi,WifiOff,X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type WifiNetwork, useWifiConnectivity } from '../lib/use-wifi-connectivity';

function signalLabel(level:number){return level>=4?'Excellent':level===3?'Good':level===2?'Fair':level===1?'Weak':'Very weak';}

export default function ConnectivitySettings(){
  const wifi=useWifiConnectivity();
  const[selectedSsid,setSelectedSsid]=useState<string|null>(null);
  const[password,setPassword]=useState('');
  const selected=useMemo(()=>wifi.networks.find((item)=>item.ssid===selectedSsid)??null,[selectedSsid,wifi.networks]);

  async function chooseNetwork(network:WifiNetwork){
    if(wifi.connectedSsid===network.ssid)return;
    if(network.saved){
      const connected=await wifi.reconnect(network.ssid);
      if(connected)return;
    }
    if(!network.secure){await wifi.connect(network.ssid);setSelectedSsid(null);setPassword('');return;}
    setSelectedSsid(network.ssid);setPassword('');
  }

  async function connectSelected(){
    if(!selected)return;
    const connected=await wifi.connect(selected.ssid,password || undefined);
    if(!connected)return;
    setPassword('');
    setSelectedSsid(null);
  }

  return <section className="connectivitySettings" aria-labelledby="wifi-settings-title" data-testid="wifi-settings">
    <div className="connectivityHeader"><span><Wifi/><span><strong id="wifi-settings-title">Wi-Fi & connectivity</strong><small>Network setup is available while parked.</small></span></span><b>{wifi.mode==='native'?(wifi.connectedSsid??(wifi.enabled?'Not connected':'Wi-Fi off')):(wifi.online?'Host online':'Host offline')}</b></div>
    {wifi.mode==='host-managed'?<div className="hostManagedWifi"><span className={`wifiStateIcon ${wifi.online?'isOnline':''}`}>{wifi.online?<Wifi/>:<WifiOff/>}</span><span><strong>Managed by host device</strong><small>The web preview cannot switch the Wi-Fi radio, scan SSIDs, or store network credentials. Vehicle hardware should expose the KINGMAST native Wi-Fi bridge for those controls.</small></span><button type="button" onClick={()=>void wifi.refresh()}><RefreshCw/> Refresh</button></div>:<>
      <div className="wifiMasterRow"><span className={`wifiStateIcon ${wifi.enabled?'isOnline':''}`}>{wifi.enabled?<Wifi/>:<WifiOff/>}</span><span><strong>Wi-Fi</strong><small>{wifi.enabled?(wifi.connectedSsid?`Connected to ${wifi.connectedSsid}`:'On · choose a network below'):'Off · online maps and connected-road services will pause'}</small></span><button type="button" role="switch" aria-label="Wi-Fi" aria-checked={Boolean(wifi.enabled)} className={`appleSwitch ${wifi.enabled?'isOn':''}`} disabled={wifi.busy} onClick={()=>void wifi.setEnabled(!wifi.enabled)}><span/></button></div>
      {wifi.captivePortal?<div className="wifiPortalCard" role="status"><ExternalLink/><span><strong>Network sign-in required</strong><small>Wi-Fi is connected, but online services are paused until the host completes network sign-in.</small></span><button type="button" onClick={()=>void wifi.openCaptivePortal()}>Sign in</button></div>:null}
      {wifi.enabled?<div className="wifiNetworks"><div className="wifiNetworksHead"><span><Signal/> Available networks</span><button type="button" disabled={wifi.busy} onClick={()=>void wifi.scan()}><RefreshCw className={wifi.busy?'isSpinning':''}/> {wifi.busy?'Scanning…':'Scan'}</button></div>{wifi.networks.length?wifi.networks.map((network)=>{const connected=wifi.connectedSsid===network.ssid;return <div className={`wifiNetworkRow ${connected?'isConnected':''}`} key={network.ssid}><button type="button" className="wifiNetworkMain" disabled={wifi.busy||connected} onClick={()=>void chooseNetwork(network)}><span>{network.secure?<LockKeyhole/>:<Wifi/>}</span><span><strong>{network.ssid}</strong><small>{signalLabel(network.signal)}{network.saved?' · Known network':''}</small></span><b>{connected?<><Check/> Connected</>:network.saved?'Reconnect':network.secure?'Secure':'Open'}</b></button><div className="wifiNetworkActions">{connected?<button type="button" className="wifiDisconnect" disabled={wifi.busy} onClick={()=>void wifi.disconnect()}><X/> Disconnect</button>:null}{network.saved?<button type="button" className="wifiForget" disabled={wifi.busy} onClick={()=>void wifi.forget(network.ssid)}><Forget/> Forget</button>:null}</div></div>;}):<div className="wifiEmpty">No scanned networks yet. Select Scan while parked.</div>}</div>:null}
      {selected?<div className="wifiCredentialCard" role="group" aria-label={`Connect to ${selected.ssid}`}><span><LockKeyhole/><span><strong>{selected.ssid}</strong><small>{selected.saved?'Saved credentials could not reconnect. Enter the current password to recover this network.':'Password is sent only to the native vehicle network service and is not stored by the web UI.'}</small></span></span><label><span>Network password</span><input autoComplete="off" type="password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="Enter password"/></label><div><button type="button" onClick={()=>{setSelectedSsid(null);setPassword('');}}>Cancel</button><button type="button" className="wifiConnectPrimary" disabled={wifi.busy||password.length===0} onClick={()=>void connectSelected()}>{wifi.busy?'Connecting…':'Connect'}</button></div></div>:null}
    </>}
    {wifi.error?<div className="wifiError" role="status"><WifiOff/><span><strong>Connectivity needs attention</strong><small>{wifi.error}</small></span><button type="button" disabled={wifi.busy} onClick={()=>void wifi.refresh()}><RefreshCw/> Retry</button></div>:null}
  </section>;
}
