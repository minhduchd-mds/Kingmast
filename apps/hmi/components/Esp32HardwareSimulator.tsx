'use client';

import {useEffect,useMemo,useState} from 'react';
import {
  AlertTriangle,Camera,CircuitBoard,Cpu,HardDrive,MapPin,Pause,Play,Power,
  Radar,RefreshCcw,Rotate3D,Server,ShieldCheck,WifiOff,ZoomIn,ZoomOut,
} from 'lucide-react';
import styles from './Esp32HardwareSimulator.module.css';

type Fault='none'|'wifi'|'sd'|'pi-os'|'pi-hardware'|'esp-reset'|'radar-wire';
type PiState='healthy'|'rollback'|'hardware-offline'|'standby-active';
type TerminalId='E1'|'E2'|'E3'|'E4'|'GND';

type Terminal={id:TerminalId;label:string;bus:string;voltage:string;detail:string};
const terminals:Terminal[]=[
  {id:'E1',label:'GPS RX/TX',bus:'UART',voltage:'3.3 V',detail:'Định vị, thời gian và tốc độ.'},
  {id:'E2',label:'Radar data',bus:'I²C / GPIO',voltage:'3.3 V',detail:'Khoảng cách và phát hiện vật cản.'},
  {id:'E3',label:'SD SPI',bus:'SPI',voltage:'3.3 V',detail:'MOSI / MISO / SCK / CS cho spool cục bộ.'},
  {id:'E4',label:'Buzzer',bus:'GPIO',voltage:'3.3 V',detail:'Cảnh báo cục bộ mức đơn giản.'},
  {id:'GND',label:'Ground',bus:'GND',voltage:'0 V',detail:'Mass chung cho module điện áp thấp.'},
];

const faults:{id:Fault;label:string;description:string}[]=[
  {id:'none',label:'Bình thường',description:'Khôi phục toàn bộ đường dữ liệu.'},
  {id:'wifi',label:'Mất Wi‑Fi',description:'ESP32 chuyển sang microSD spool.'},
  {id:'sd',label:'SD lỗi',description:'Realtime vẫn chạy nếu Pi còn online.'},
  {id:'pi-os',label:'Pi OS crash',description:'Watchdog + A/B rollback về known-good.'},
  {id:'pi-hardware',label:'Pi chết phần cứng',description:'ESP32 độc lập; standby cần witness.'},
  {id:'esp-reset',label:'ESP32 reset',description:'Pi/camera còn sống, ESP32 khởi động lại.'},
  {id:'radar-wire',label:'Rút dây radar',description:'Mô phỏng đứt đầu cực E2.'},
];

function statusClass(ok:boolean,warn=false){return ok?styles.ok:warn?styles.warn:styles.bad;}

export function Esp32HardwareSimulator(){
  const [fault,setFault]=useState<Fault>('none');
  const [running,setRunning]=useState(true);
  const [rotation,setRotation]=useState(-18);
  const [tilt,setTilt]=useState(54);
  const [zoom,setZoom]=useState(0.92);
  const [selectedTerminal,setSelectedTerminal]=useState<TerminalId>('E2');
  const [tick,setTick]=useState(0);
  const [witness,setWitness]=useState(true);
  const [piState,setPiState]=useState<PiState>('healthy');

  useEffect(()=>{
    if(!running)return;
    const id=window.setInterval(()=>setTick((value)=>value+1),700);
    return()=>window.clearInterval(id);
  },[running]);

  useEffect(()=>{
    let timer:number|undefined;
    if(fault==='pi-os'){
      setPiState('rollback');
      timer=window.setTimeout(()=>setPiState('healthy'),2600);
    }else if(fault==='pi-hardware'){
      setPiState('hardware-offline');
      if(witness)timer=window.setTimeout(()=>setPiState('standby-active'),1600);
    }else{
      setPiState('healthy');
    }
    return()=>{if(timer)window.clearTimeout(timer);};
  },[fault,witness]);

  const system=useMemo(()=>{
    const esp32Online=fault!=='esp-reset'||tick%4>0;
    const wifiOnline=fault!=='wifi'&&piState!=='hardware-offline';
    const sdOnline=fault!=='sd';
    const radarOnline=fault!=='radar-wire';
    const piOnline=piState==='healthy'||piState==='standby-active';
    const spool=esp32Online&&sdOnline&&(!wifiOnline||!piOnline);
    const realtime=esp32Online&&wifiOnline&&piOnline;
    return{esp32Online,wifiOnline,sdOnline,radarOnline,piOnline,spool,realtime};
  },[fault,piState,tick]);

  const telemetry=useMemo(()=>({
    speed:Math.round(38+Math.sin(tick/2)*7),
    distance:system.radarOnline?Math.round(24+Math.cos(tick/3)*6):null,
    gps:system.esp32Online?`${21.03+(tick%7)*0.0001}°N`:'—',
    queued:system.spool?16+(tick%20):0,
  }),[tick,system]);

  const terminal=terminals.find((item)=>item.id===selectedTerminal)!;
  const wireState=(key:'power'|'gps'|'radar'|'sd'|'uplink'|'camera'|'standby')=>{
    const map={
      power:true,
      gps:system.esp32Online,
      radar:system.esp32Online&&system.radarOnline,
      sd:system.esp32Online&&system.sdOnline,
      uplink:system.realtime,
      camera:system.piOnline,
      standby:piState==='standby-active',
    };
    return map[key];
  };

  const reset=()=>{
    setFault('none');setPiState('healthy');setRotation(-18);setTilt(54);setZoom(.92);setWitness(true);setSelectedTerminal('E2');
  };

  return <main className={styles.shell} data-testid="esp32-simulator">
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>KINGMAST LAB · DIGITAL TWIN</div>
        <h1>Mô phỏng kết nối ESP32 ↔ Raspberry Pi</h1>
        <p>Quan sát nguồn, đầu cực, bus cảm biến, microSD spool và failover OS theo thời gian thực.</p>
      </div>
      <div className={styles.headerActions}>
        <button onClick={()=>setRunning((value)=>!value)} aria-label={running?'Tạm dừng mô phỏng':'Chạy mô phỏng'}>
          {running?<Pause size={18}/>:<Play size={18}/>} {running?'Tạm dừng':'Chạy'}
        </button>
        <button onClick={reset}><RefreshCcw size={18}/> Reset</button>
      </div>
    </header>

    <section className={styles.summary} aria-label="Trạng thái hệ thống">
      <Status label="ESP32" value={system.esp32Online?'ONLINE':'RESET'} ok={system.esp32Online}/>
      <Status label="Raspberry Pi" value={piState==='rollback'?'A/B ROLLBACK':piState==='hardware-offline'?'OFFLINE':piState==='standby-active'?'STANDBY ACTIVE':'HEALTHY'} ok={system.piOnline} warn={piState==='rollback'}/>
      <Status label="microSD" value={system.sdOnline?(system.spool?'SPOOLING':'READY'):'FAULT'} ok={system.sdOnline} warn={system.spool}/>
      <Status label="Uplink" value={system.realtime?'REALTIME':system.spool?'BUFFERED':'DEGRADED'} ok={system.realtime} warn={system.spool}/>
      <Status label="Authority" value="NONE" ok/>
    </section>

    <div className={styles.mainGrid}>
      <section className={styles.stageCard}>
        <div className={styles.toolbar}>
          <span><Rotate3D size={16}/> Góc nhìn</span>
          <button onClick={()=>setRotation((value)=>value-8)}>↺</button>
          <button onClick={()=>setRotation((value)=>value+8)}>↻</button>
          <button onClick={()=>setTilt((value)=>Math.max(28,value-6))}>Hạ góc</button>
          <button onClick={()=>setTilt((value)=>Math.min(68,value+6))}>Nâng góc</button>
          <button aria-label="Thu nhỏ" onClick={()=>setZoom((value)=>Math.max(.68,value-.08))}><ZoomOut size={16}/></button>
          <button aria-label="Phóng to" onClick={()=>setZoom((value)=>Math.min(1.18,value+.08))}><ZoomIn size={16}/></button>
        </div>

        <div className={styles.viewport}>
          <div className={styles.world} style={{transform:`rotateX(${tilt}deg) rotateZ(${rotation}deg) scale(${zoom})`}}>
            <svg className={styles.wires} viewBox="0 0 1000 620" aria-hidden="true">
              <Wire d="M95 105 C180 105 205 175 290 180" active={wireState('power')} tone="power"/>
              <Wire d="M190 440 C255 430 265 340 360 330" active={wireState('gps')} tone="data"/>
              <Wire d="M190 520 C275 505 285 380 360 370" active={wireState('radar')} tone="sensor"/>
              <Wire d="M455 505 C465 455 445 415 430 395" active={wireState('sd')} tone="storage"/>
              <Wire d="M535 300 C620 285 650 245 735 235" active={wireState('uplink')} tone="uplink" dashed/>
              <Wire d="M855 95 C840 135 820 160 800 195" active={wireState('camera')} tone="camera"/>
              <Wire d="M790 270 C790 360 825 390 845 470" active={wireState('standby')} tone="standby" dashed/>
            </svg>

            <Device className={styles.powerNode} title="12/24V → DC-DC" subtitle="5V / 3.3V" icon={<Power/>} state="Nguồn xe" ok/>
            <Device className={styles.gpsNode} title="GPS" subtitle="UART · E1" icon={<MapPin/>} state={`${telemetry.speed} km/h`} ok={system.esp32Online}/>
            <Device className={styles.radarNode} title="Radar" subtitle="I²C/GPIO · E2" icon={<Radar/>} state={telemetry.distance===null?'DISCONNECTED':`${telemetry.distance} m`} ok={system.radarOnline}/>
            <Device className={styles.sdNode} title="microSD" subtitle="SPI · E3" icon={<HardDrive/>} state={system.spool?`${telemetry.queued} queued`:system.sdOnline?'READY':'FAULT'} ok={system.sdOnline} warn={system.spool}/>
            <Device className={`${styles.espNode} ${styles.hero}`} title="ESP32" subtitle="Safety island" icon={<CircuitBoard/>} state={system.esp32Online?'RUNNING':'RESTART'} ok={system.esp32Online}/>
            <Device className={styles.piNode} title="Raspberry Pi" subtitle="Primary compute" icon={<Cpu/>} state={piState==='rollback'?'ROLLBACK':system.piOnline?'ACTIVE':'OFFLINE'} ok={system.piOnline} warn={piState==='rollback'}/>
            <Device className={styles.cameraNode} title="Camera" subtitle="CSI / USB → Pi" icon={<Camera/>} state={system.piOnline?'STREAM':'NO HOST'} ok={system.piOnline}/>
            <Device className={styles.standbyNode} title="Pi Standby" subtitle="Witness gated" icon={<Server/>} state={piState==='standby-active'?'PROMOTED':'WARM'} ok={piState!=='hardware-offline'||witness} warn={fault==='pi-hardware'&&piState!=='standby-active'}/>

            <div className={styles.terminalBlock} data-testid="terminal-block">
              <div className={styles.blockTitle}>ĐẦU CỰC / TERMINAL</div>
              <div className={styles.terminals}>
                {terminals.map((item)=><button key={item.id} className={selectedTerminal===item.id?styles.terminalSelected:''} onClick={()=>setSelectedTerminal(item.id)}>
                  <span className={styles.screw}/><b>{item.id}</b><small>{item.bus}</small>
                </button>)}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.legend}>
          <span><i className={styles.powerDot}/> nguồn</span><span><i className={styles.dataDot}/> UART/data</span><span><i className={styles.sensorDot}/> cảm biến</span><span><i className={styles.storageDot}/> SD</span><span><i className={styles.uplinkDot}/> Wi‑Fi/HTTPS</span>
        </div>
      </section>

      <aside className={styles.sidePanel}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><AlertTriangle size={18}/> Tiêm lỗi</div>
          <div className={styles.faultGrid}>
            {faults.map((item)=><button key={item.id} onClick={()=>setFault(item.id)} className={fault===item.id?styles.faultActive:''} aria-pressed={fault===item.id}>
              <b>{item.label}</b><span>{item.description}</span>
            </button>)}
          </div>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={witness} onChange={(event)=>setWitness(event.target.checked)}/>
            <span><ShieldCheck size={17}/> Independent witness cho Pi standby</span>
          </label>
        </section>

        <section className={styles.panel} data-testid="terminal-inspector">
          <div className={styles.panelTitle}><CircuitBoard size={18}/> Chi tiết đầu cực</div>
          <div className={styles.terminalHero}><span>{terminal.id}</span><div><b>{terminal.label}</b><small>{terminal.bus} · {terminal.voltage}</small></div></div>
          <p>{terminal.detail}</p>
          <div className={styles.pinRows}>
            <div><span>Điện áp logic</span><b>{terminal.voltage}</b></div>
            <div><span>Bus</span><b>{terminal.bus}</b></div>
            <div><span>Trạng thái</span><b className={terminal.id==='E2'&&!system.radarOnline?styles.bad:styles.ok}>{terminal.id==='E2'&&!system.radarOnline?'OPEN CIRCUIT':'CONNECTED'}</b></div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}><WifiOff size={18}/> Dòng dữ liệu</div>
          <div className={styles.dataRows}>
            <div><span>GPS</span><b>{telemetry.gps}</b></div>
            <div><span>Radar</span><b>{telemetry.distance===null?'—':`${telemetry.distance} m`}</b></div>
            <div><span>SD backlog</span><b>{telemetry.queued} packet</b></div>
            <div><span>Đường chính</span><b>{system.realtime?'ESP32 → Pi':system.spool?'ESP32 → microSD':'Degraded'}</b></div>
            <div><span>Pi boot</span><b>{piState==='rollback'?'Rollback → known-good':piState==='standby-active'?'Standby promoted':piState==='hardware-offline'?'Hardware offline':'Known-good healthy'}</b></div>
          </div>
        </section>
      </aside>
    </div>

    <footer className={styles.footerNote}>Mô phỏng phục vụ nghiên cứu / software-in-the-loop. Không đại diện cho xác nhận điện, EMC, HIL hoặc an toàn phương tiện thực tế. controlAuthority: none.</footer>
  </main>;
}

function Status({label,value,ok,warn=false}:{label:string;value:string;ok:boolean;warn?:boolean}){
  return <div className={styles.status}><span>{label}</span><b className={statusClass(ok,warn)}>{value}</b></div>;
}

function Device({className,title,subtitle,icon,state,ok,warn=false}:{className:string;title:string;subtitle:string;icon:React.ReactNode;state:string;ok:boolean;warn?:boolean}){
  return <div className={`${styles.device} ${className}`}>
    <div className={styles.deviceIcon}>{icon}</div><div className={styles.deviceCopy}><b>{title}</b><span>{subtitle}</span></div><em className={statusClass(ok,warn)}>{state}</em>
  </div>;
}

function Wire({d,active,tone,dashed=false}:{d:string;active:boolean;tone:string;dashed?:boolean}){
  return <>
    <path d={d} className={`${styles.wireBase} ${styles[tone]} ${!active?styles.wireOff:''} ${dashed?styles.dashed:''}`}/>
    {active&&<path d={d} className={`${styles.wirePulse} ${styles[tone]} ${dashed?styles.dashed:''}`}/>} 
  </>;
}
