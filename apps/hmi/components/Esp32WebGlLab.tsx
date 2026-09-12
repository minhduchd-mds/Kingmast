'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './Esp32WebGlLab.module.css';

type Fault='none'|'wifi'|'sd'|'pi-os'|'pi-hardware'|'esp-reset'|'radar-wire';
type PiState='healthy'|'rollback'|'hardware-offline'|'standby-active';
type TerminalId='E1'|'E2'|'E3'|'E4'|'GND';
type PinId='GPIO16'|'GPIO17'|'GPIO21'|'GPIO22'|'GPIO18'|'GPIO19'|'GPIO23'|'GPIO5'|'GPIO27'|'3V3'|'GND';
type Vec3=[number,number,number];
type Mat4=Float32Array;
type Cable={source:TerminalId;target:PinId};
type Projected={x:number;y:number;visible:boolean};

type Box={center:Vec3;size:Vec3;color:Vec3};

type PinDefinition={id:PinId;label:string;bus:string;world:Vec3};
type TerminalDefinition={id:TerminalId;label:string;bus:string;world:Vec3};

const faults:{id:Fault;label:string;description:string}[]=[
  {id:'none',label:'Bình thường',description:'Khôi phục toàn bộ đường dữ liệu.'},
  {id:'wifi',label:'Mất Wi‑Fi',description:'ESP32 chuyển sang microSD spool.'},
  {id:'sd',label:'SD lỗi',description:'Realtime vẫn chạy nếu Pi còn online.'},
  {id:'pi-os',label:'Pi OS crash',description:'Watchdog + A/B rollback về known-good.'},
  {id:'pi-hardware',label:'Pi chết phần cứng',description:'ESP32 độc lập; standby cần witness.'},
  {id:'esp-reset',label:'ESP32 reset',description:'Pi/camera còn sống, ESP32 khởi động lại.'},
  {id:'radar-wire',label:'Rút dây radar',description:'Mô phỏng đứt đầu cực E2.'},
];

const terminals:TerminalDefinition[]=[
  {id:'E1',label:'GPS UART',bus:'UART',world:[-1.0,0.48,2.25]},
  {id:'E2',label:'Radar',bus:'I²C / GPIO',world:[-.5,0.48,2.25]},
  {id:'E3',label:'microSD',bus:'SPI',world:[0,0.48,2.25]},
  {id:'E4',label:'Buzzer',bus:'GPIO',world:[.5,0.48,2.25]},
  {id:'GND',label:'Ground',bus:'GND',world:[1.0,0.48,2.25]},
];

const pins:PinDefinition[]=[
  {id:'GPIO16',label:'RX2',bus:'UART',world:[-.82,.58,.35]},
  {id:'GPIO17',label:'TX2',bus:'UART',world:[-.82,.58,.10]},
  {id:'GPIO21',label:'SDA',bus:'I²C',world:[-.82,.58,-.15]},
  {id:'GPIO22',label:'SCL',bus:'I²C',world:[-.82,.58,-.40]},
  {id:'GPIO18',label:'SCK',bus:'SPI',world:[.82,.58,.35]},
  {id:'GPIO19',label:'MISO',bus:'SPI',world:[.82,.58,.10]},
  {id:'GPIO23',label:'MOSI',bus:'SPI',world:[.82,.58,-.15]},
  {id:'GPIO5',label:'CS',bus:'SPI',world:[.82,.58,-.40]},
  {id:'GPIO27',label:'BUZZ',bus:'GPIO',world:[.82,.58,-.65]},
  {id:'3V3',label:'3V3',bus:'POWER',world:[-.82,.58,.62]},
  {id:'GND',label:'GND',bus:'GND',world:[.82,.58,.62]},
];

const validTargets:Record<TerminalId,PinId[]>={
  E1:['GPIO16','GPIO17'],
  E2:['GPIO21','GPIO22'],
  E3:['GPIO18','GPIO19','GPIO23','GPIO5'],
  E4:['GPIO27'],
  GND:['GND'],
};

const defaultCables:Cable[]=[
  {source:'E1',target:'GPIO16'},
  {source:'E2',target:'GPIO21'},
  {source:'E3',target:'GPIO18'},
  {source:'E4',target:'GPIO27'},
  {source:'GND',target:'GND'},
];

const colors={
  esp:[.08,.48,.78] as Vec3,
  pi:[.20,.68,.43] as Vec3,
  muted:[.25,.29,.34] as Vec3,
  danger:[.86,.20,.22] as Vec3,
  warn:[.96,.58,.12] as Vec3,
  sensor:[.18,.65,.78] as Vec3,
  storage:[.52,.38,.82] as Vec3,
  power:[.86,.39,.15] as Vec3,
};

function mat4Perspective(fovy:number,aspect:number,near:number,far:number):Mat4{
  const f=1/Math.tan(fovy/2);const out=new Float32Array(16);
  out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=(2*far*near)/(near-far);return out;
}

function normalize(v:Vec3):Vec3{
  const length=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/length,v[1]/length,v[2]/length];
}

function cross(a:Vec3,b:Vec3):Vec3{return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a:Vec3,b:Vec3){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}

function mat4LookAt(eye:Vec3,center:Vec3,up:Vec3):Mat4{
  const z=normalize([eye[0]-center[0],eye[1]-center[1],eye[2]-center[2]]);
  const x=normalize(cross(up,z));const y=cross(z,x);const out=new Float32Array(16);
  out[0]=x[0];out[1]=y[0];out[2]=z[0];out[3]=0;
  out[4]=x[1];out[5]=y[1];out[6]=z[1];out[7]=0;
  out[8]=x[2];out[9]=y[2];out[10]=z[2];out[11]=0;
  out[12]=-dot(x,eye);out[13]=-dot(y,eye);out[14]=-dot(z,eye);out[15]=1;return out;
}

function mat4Multiply(a:Mat4,b:Mat4):Mat4{
  const out=new Float32Array(16);
  for(let column=0;column<4;column++)for(let row=0;row<4;row++){
    out[column*4+row]=a[row]*b[column*4]+a[4+row]*b[column*4+1]+a[8+row]*b[column*4+2]+a[12+row]*b[column*4+3];
  }
  return out;
}

function project(point:Vec3,matrix:Mat4,width:number,height:number):Projected{
  const [x,y,z]=point;
  const cx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
  const cy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
  const cz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
  const cw=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
  if(cw<=0)return{x:0,y:0,visible:false};
  const nx=cx/cw,ny=cy/cw,nz=cz/cw;
  return{x:(nx*.5+.5)*width,y:(1-(ny*.5+.5))*height,visible:nz>=-1&&nz<=1};
}

function pushBox(positions:number[],vertexColors:number[],box:Box){
  const [cx,cy,cz]=box.center,[sx,sy,sz]=box.size;const x=sx/2,y=sy/2,z=sz/2;
  const corners:Vec3[]=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  const faces=[
    [0,1,2,0,2,3,.72],[4,6,5,4,7,6,1],[0,4,5,0,5,1,.82],[3,2,6,3,6,7,.94],[1,5,6,1,6,2,.88],[0,3,7,0,7,4,.78],
  ];
  for(const face of faces){
    const shade=face[6] as number;
    for(let i=0;i<6;i++){
      const p=corners[face[i] as number];positions.push(p[0]+cx,p[1]+cy,p[2]+cz);
      vertexColors.push(box.color[0]*shade,box.color[1]*shade,box.color[2]*shade);
    }
  }
}

function createShader(gl:WebGLRenderingContext,type:number,source:string){
  const shader=gl.createShader(type);if(!shader)return null;gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(shader));gl.deleteShader(shader);return null;}return shader;
}

function WebGlScene({fault,piState,cables,onCableChange,onPinSelect}:{fault:Fault;piState:PiState;cables:Cable[];onCableChange:(next:Cable[],message:string)=>void;onPinSelect:(pin:PinId)=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const hostRef=useRef<HTMLDivElement|null>(null);
  const dragRef=useRef<{x:number;y:number;azimuth:number;elevation:number}|null>(null);
  const [azimuth,setAzimuth]=useState(-.75);
  const [elevation,setElevation]=useState(.72);
  const [distance,setDistance]=useState(10.5);
  const [resizeTick,setResizeTick]=useState(0);
  const [projectedPins,setProjectedPins]=useState<Record<string,Projected>>({});
  const [projectedTerminals,setProjectedTerminals]=useState<Record<string,Projected>>({});
  const [projectedLabels,setProjectedLabels]=useState<Record<string,Projected>>({});

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    const observer=new ResizeObserver(()=>setResizeTick((value)=>value+1));observer.observe(host);return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current,host=hostRef.current;if(!canvas||!host)return;
    const rect=host.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    canvas.style.width=`${rect.width}px`;canvas.style.height=`${rect.height}px`;
    const gl=canvas.getContext('webgl',{antialias:true,alpha:false});if(!gl)return;

    const vertex=createShader(gl,gl.VERTEX_SHADER,'attribute vec3 aPosition;attribute vec3 aColor;uniform mat4 uMvp;varying vec3 vColor;void main(){gl_Position=uMvp*vec4(aPosition,1.0);vColor=aColor;}');
    const fragment=createShader(gl,gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}');
    if(!vertex||!fragment)return;
    const program=gl.createProgram();if(!program)return;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(program));return;}
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);

    const positionBuffer=gl.createBuffer(),colorBuffer=gl.createBuffer();if(!positionBuffer||!colorBuffer)return;
    const positionLocation=gl.getAttribLocation(program,'aPosition'),colorLocation=gl.getAttribLocation(program,'aColor');
    const matrixLocation=gl.getUniformLocation(program,'uMvp');if(!matrixLocation)return;

    const piColor=piState==='rollback'?colors.warn:piState==='hardware-offline'?colors.danger:colors.pi;
    const espColor=fault==='esp-reset'?colors.danger:colors.esp;
    const sdColor=fault==='sd'?colors.danger:(fault==='wifi'||piState==='hardware-offline')?colors.warn:colors.storage;
    const radarColor=fault==='radar-wire'?colors.danger:colors.sensor;
    const boxes:Box[]=[
      {center:[0,.25,0],size:[1.7,.28,2.0],color:espColor},
      {center:[3.2,.28,.35],size:[2.1,.34,1.7],color:piColor},
      {center:[3.6,.24,-1.8],size:[1.8,.30,1.35],color:piState==='standby-active'?colors.pi:colors.muted},
      {center:[-3.2,.24,1.55],size:[1.65,.38,1.05],color:colors.power},
      {center:[-3.15,.22,.05],size:[1.55,.28,1.0],color:colors.sensor},
      {center:[-3.1,.22,-1.45],size:[1.55,.28,1.0],color:radarColor},
      {center:[.15,.20,-2.15],size:[1.45,.24,.95],color:sdColor},
      {center:[4.25,.52,2.0],size:[.9,.75,.8],color:colors.muted},
      {center:[0,.18,2.25],size:[2.7,.25,.75],color:colors.muted},
    ];
    for(let i=-6;i<=6;i++){
      boxes.push({center:[i, -.055,0],size:[.012,.012,7],color:[.12,.16,.20]});
      boxes.push({center:[0,-.055,i*.55],size:[12,.012,.012],color:[.12,.16,.20]});
    }
    for(const pin of pins)boxes.push({center:pin.world,size:[.12,.16,.12],color:[.88,.68,.18]});
    for(const terminal of terminals)boxes.push({center:terminal.world,size:[.24,.22,.24],color:terminal.id==='GND'?[.18,.2,.22]:[.18,.68,.42]});

    const positions:number[]=[],vertexColors:number[]=[];for(const box of boxes)pushBox(positions,vertexColors,box);
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);gl.enableVertexAttribArray(positionLocation);gl.vertexAttribPointer(positionLocation,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertexColors),gl.STATIC_DRAW);gl.enableVertexAttribArray(colorLocation);gl.vertexAttribPointer(colorLocation,3,gl.FLOAT,false,0,0);

    const eye:Vec3=[Math.sin(azimuth)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(azimuth)*Math.cos(elevation)*distance];
    const projection=mat4Perspective(Math.PI/4,rect.width/rect.height,.1,50);const view=mat4LookAt(eye,[0,0,0],[0,1,0]);const vp=mat4Multiply(projection,view);
    gl.uniformMatrix4fv(matrixLocation,false,vp);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.035,.05,.068,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);

    setProjectedPins(Object.fromEntries(pins.map((pin)=>[pin.id,project(pin.world,vp,rect.width,rect.height)])));
    setProjectedTerminals(Object.fromEntries(terminals.map((terminal)=>[terminal.id,project(terminal.world,vp,rect.width,rect.height)])));
    const labels:{id:string;point:Vec3}[]=[
      {id:'esp',point:[0,.8,0]},{id:'pi',point:[3.2,.85,.35]},{id:'standby',point:[3.6,.72,-1.8]},
      {id:'power',point:[-3.2,.78,1.55]},{id:'gps',point:[-3.15,.65,.05]},{id:'radar',point:[-3.1,.65,-1.45]},
      {id:'sd',point:[.15,.62,-2.15]},{id:'camera',point:[4.25,1.18,2.0]},{id:'terminal',point:[0,.72,2.25]},
    ];
    setProjectedLabels(Object.fromEntries(labels.map((label)=>[label.id,project(label.point,vp,rect.width,rect.height)])));
    gl.deleteShader(vertex);gl.deleteShader(fragment);gl.deleteBuffer(positionBuffer);gl.deleteBuffer(colorBuffer);gl.deleteProgram(program);
  },[azimuth,elevation,distance,fault,piState,resizeTick]);

  const startOrbit=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    event.currentTarget.setPointerCapture(event.pointerId);dragRef.current={x:event.clientX,y:event.clientY,azimuth,elevation};
  };
  const moveOrbit=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const drag=dragRef.current;if(!drag)return;setAzimuth(drag.azimuth+(event.clientX-drag.x)*.009);setElevation(Math.min(1.25,Math.max(.22,drag.elevation+(event.clientY-drag.y)*.006)));
  };
  const endOrbit=()=>{dragRef.current=null;};

  const connect=(source:TerminalId,target:PinId)=>{
    if(!validTargets[source].includes(target)){onCableChange(cables,`${source} không tương thích với ${target}`);return;}
    const withoutSource=cables.filter((cable)=>!(cable.source===source&&cable.target===target));
    const exists=withoutSource.length!==cables.length;
    onCableChange(exists?withoutSource:[...cables,{source,target}],exists?`Đã tháo ${source} ↔ ${target}`:`Đã nối ${source} ↔ ${target}`);
  };

  return <div className={styles.scene} ref={hostRef} data-testid="webgl-scene">
    <canvas ref={canvasRef} className={styles.canvas} aria-label="Môi trường WebGL 3D ESP32" onPointerDown={startOrbit} onPointerMove={moveOrbit} onPointerUp={endOrbit} onPointerCancel={endOrbit} onWheel={(event)=>{event.preventDefault();setDistance((value)=>Math.min(16,Math.max(6.5,value+event.deltaY*.01)));}}/>
    <svg className={styles.cables} aria-hidden="true">
      {cables.map((cable)=>{
        const from=projectedTerminals[cable.source],to=projectedPins[cable.target];if(!from?.visible||!to?.visible)return null;
        const broken=fault==='radar-wire'&&cable.source==='E2';const mx=(from.x+to.x)/2;
        return <path key={`${cable.source}-${cable.target}`} d={`M ${from.x} ${from.y} C ${mx} ${from.y-36}, ${mx} ${to.y+36}, ${to.x} ${to.y}`} className={broken?styles.cableBroken:styles.cableLive}/>;
      })}
    </svg>

    {Object.entries(projectedLabels).map(([id,point])=>point.visible?<div key={id} className={styles.objectLabel} style={{left:point.x,top:point.y}}>{({esp:'ESP32',pi:'Raspberry Pi',standby:'Pi Standby',power:'DC-DC 12/24V',gps:'GPS',radar:'Radar',sd:'microSD',camera:'Camera',terminal:'Terminal E1–E4'} as Record<string,string>)[id]}</div>:null)}

    {terminals.map((terminal)=>{
      const point=projectedTerminals[terminal.id];if(!point?.visible)return null;
      return <button key={terminal.id} draggable className={styles.terminalHotspot} style={{left:point.x,top:point.y}} onDragStart={(event)=>event.dataTransfer.setData('text/kingmast-terminal',terminal.id)} title={`Kéo ${terminal.id} sang chân ESP32`} data-testid={`terminal-${terminal.id}`}>{terminal.id}</button>;
    })}
    {pins.map((pin)=>{
      const point=projectedPins[pin.id];if(!point?.visible)return null;
      return <button key={pin.id} className={styles.pinHotspot} style={{left:point.x,top:point.y}} onClick={()=>onPinSelect(pin.id)} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();const source=event.dataTransfer.getData('text/kingmast-terminal') as TerminalId;if(source)connect(source,pin.id);}} data-testid={`pin-${pin.id}`} title={`${pin.id} · ${pin.label} · ${pin.bus}`}>{pin.id}</button>;
    })}

    <div className={styles.sceneHint}>Kéo để xoay 360° · cuộn để zoom · kéo E1–E4/GND vào chân ESP32</div>
    <button className={styles.cameraReset} onClick={()=>{setAzimuth(-.75);setElevation(.72);setDistance(10.5);}}>Reset camera</button>
  </div>;
}

function Status({label,value,tone='ok'}:{label:string;value:string;tone?:'ok'|'warn'|'bad'}){
  return <div className={styles.status}><span>{label}</span><b className={styles[tone]}>{value}</b></div>;
}

export function Esp32WebGlLab(){
  const [fault,setFault]=useState<Fault>('none');
  const [piState,setPiState]=useState<PiState>('healthy');
  const [witness,setWitness]=useState(true);
  const [tick,setTick]=useState(0);
  const [cables,setCables]=useState<Cable[]>(defaultCables);
  const [wireMessage,setWireMessage]=useState('Kéo đầu cực vào chân ESP32 để thử đấu nối.');
  const [selectedPin,setSelectedPin]=useState<PinId>('GPIO21');

  useEffect(()=>{const id=window.setInterval(()=>setTick((value)=>value+1),700);return()=>window.clearInterval(id);},[]);
  useEffect(()=>{
    let timer:number|undefined;
    if(fault==='pi-os'){setPiState('rollback');timer=window.setTimeout(()=>setPiState('healthy'),2600);}
    else if(fault==='pi-hardware'){setPiState('hardware-offline');if(witness)timer=window.setTimeout(()=>setPiState('standby-active'),1600);}
    else setPiState('healthy');
    return()=>{if(timer)window.clearTimeout(timer);};
  },[fault,witness]);

  const system=useMemo(()=>{
    const esp32Online=fault!=='esp-reset'||tick%4>0;
    const wifiOnline=fault!=='wifi'&&piState!=='hardware-offline';
    const sdOnline=fault!=='sd';const radarOnline=fault!=='radar-wire';
    const piOnline=piState==='healthy'||piState==='standby-active';
    const spool=esp32Online&&sdOnline&&(!wifiOnline||!piOnline);const realtime=esp32Online&&wifiOnline&&piOnline;
    return{esp32Online,wifiOnline,sdOnline,radarOnline,piOnline,spool,realtime};
  },[fault,piState,tick]);
  const telemetry=useMemo(()=>({speed:Math.round(38+Math.sin(tick/2)*7),distance:system.radarOnline?Math.round(24+Math.cos(tick/3)*6):null,queued:system.spool?16+(tick%20):0}),[tick,system]);
  const pin=pins.find((item)=>item.id===selectedPin)!;

  const reset=()=>{setFault('none');setPiState('healthy');setWitness(true);setCables(defaultCables);setWireMessage('Đã khôi phục cấu hình dây mặc định.');setSelectedPin('GPIO21');};

  return <main className={styles.shell} data-testid="esp32-simulator">
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>KINGMAST LAB · WEBGL DIGITAL TWIN</div><h1>ESP32 + Raspberry Pi · môi trường 3D tương tác</h1><p>Xoay 360°, kiểm tra chân GPIO, kéo-thả dây và tiêm lỗi để quan sát cơ chế dự phòng.</p></div>
      <button className={styles.resetButton} onClick={reset}>Reset mô phỏng</button>
    </header>

    <section className={styles.summary} aria-label="Trạng thái hệ thống">
      <Status label="ESP32" value={system.esp32Online?'ONLINE':'RESET'} tone={system.esp32Online?'ok':'bad'}/>
      <Status label="Raspberry Pi" value={piState==='rollback'?'A/B ROLLBACK':piState==='hardware-offline'?'OFFLINE':piState==='standby-active'?'STANDBY ACTIVE':'HEALTHY'} tone={system.piOnline?'ok':piState==='rollback'?'warn':'bad'}/>
      <Status label="microSD" value={system.sdOnline?(system.spool?'SPOOLING':'READY'):'FAULT'} tone={!system.sdOnline?'bad':system.spool?'warn':'ok'}/>
      <Status label="Uplink" value={system.realtime?'REALTIME':system.spool?'BUFFERED':'DEGRADED'} tone={system.realtime?'ok':system.spool?'warn':'bad'}/>
      <Status label="Authority" value="NONE"/>
    </section>

    <div className={styles.layout}>
      <section className={styles.stageCard}>
        <WebGlScene fault={fault} piState={piState} cables={cables} onCableChange={(next,message)=>{setCables(next);setWireMessage(message);}} onPinSelect={setSelectedPin}/>
        <div className={styles.wireMessage} data-testid="wire-message">{wireMessage}</div>
      </section>

      <aside className={styles.side}>
        <section className={styles.panel}>
          <h2>Tiêm lỗi</h2>
          <div className={styles.faults}>{faults.map((item)=><button key={item.id} onClick={()=>setFault(item.id)} aria-pressed={fault===item.id} className={fault===item.id?styles.activeFault:''}><b>{item.label}</b><span>{item.description}</span></button>)}</div>
          <label className={styles.witness}><input type="checkbox" checked={witness} onChange={(event)=>setWitness(event.target.checked)}/> Independent witness cho Pi standby</label>
        </section>

        <section className={styles.panel} data-testid="terminal-inspector">
          <h2>Chân ESP32</h2>
          <div className={styles.pinHero}><b>{pin.id}</b><div><strong>{pin.label}</strong><span>{pin.bus}</span></div></div>
          <div className={styles.rows}><div><span>Bus</span><b>{pin.bus}</b></div><div><span>Đang nối</span><b>{cables.filter((cable)=>cable.target===pin.id).map((cable)=>cable.source).join(', ')||'—'}</b></div><div><span>Radar E2</span><b className={fault==='radar-wire'?styles.bad:styles.ok}>{fault==='radar-wire'?'OPEN CIRCUIT':'CONNECTED'}</b></div></div>
        </section>

        <section className={styles.panel}>
          <h2>Dòng dữ liệu</h2>
          <div className={styles.rows}><div><span>Tốc độ</span><b>{telemetry.speed} km/h</b></div><div><span>Radar</span><b>{telemetry.distance===null?'—':`${telemetry.distance} m`}</b></div><div><span>SD backlog</span><b>{telemetry.queued} packet</b></div><div><span>Đường chính</span><b>{system.realtime?'ESP32 → Pi':system.spool?'ESP32 → microSD':'Degraded'}</b></div><div><span>Pi boot</span><b>{piState==='rollback'?'Rollback → known-good':piState==='standby-active'?'Standby promoted':piState==='hardware-offline'?'Hardware offline':'Known-good healthy'}</b></div></div>
        </section>
      </aside>
    </div>

    <footer className={styles.footer}>Software-in-the-loop WebGL visualization. Sơ đồ chân là mô hình nghiên cứu, chưa phải harness/pinout sản xuất và không tạo quyền điều khiển xe.</footer>
  </main>;
}
