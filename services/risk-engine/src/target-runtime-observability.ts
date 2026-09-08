import { existsSync,readFileSync,readdirSync } from 'node:fs';
import { freemem,loadavg,totalmem,uptime } from 'node:os';
import { join } from 'node:path';

const MIB=1024*1024;
const MAX_THERMAL_ZONES=32;

export interface TargetThermalSnapshot {
  available:boolean;
  sensors:number;
  minC:number|null;
  maxC:number|null;
}

export interface TargetRuntimeSnapshot {
  capturedAtMs:number;
  uptimeS:number;
  load1:number;
  load5:number;
  load15:number;
  totalMemoryMiB:number;
  freeMemoryMiB:number;
  thermal:TargetThermalSnapshot;
}

export interface TargetRuntimeRequirements {
  thermalRequired:boolean;
  maxTemperatureC:number;
  minFreeMemoryMiB:number;
}

function round(value:number,digits=3){return Number(value.toFixed(digits));}

function boundedTemperature(value:number){
  if(!Number.isFinite(value))return null;
  const celsius=Math.abs(value)>1_000?value/1_000:value;
  return celsius>=-80&&celsius<=220?round(celsius):null;
}

export function readLinuxThermalSnapshot(root='/sys/class/thermal'):TargetThermalSnapshot{
  if(process.platform!=='linux'||!existsSync(root))return{available:false,sensors:0,minC:null,maxC:null};
  const temperatures:number[]=[];
  try{
    const zones=readdirSync(root,{withFileTypes:true})
      .filter((entry)=>entry.isDirectory()&&entry.name.startsWith('thermal_zone'))
      .slice(0,MAX_THERMAL_ZONES);
    for(const zone of zones){
      try{
        const parsed=boundedTemperature(Number(readFileSync(join(root,zone.name,'temp'),'utf8').trim()));
        if(parsed!==null)temperatures.push(parsed);
      }catch{
        // A disappearing or permission-restricted thermal zone is treated as unavailable evidence.
      }
    }
  }catch{
    return{available:false,sensors:0,minC:null,maxC:null};
  }
  if(!temperatures.length)return{available:false,sensors:0,minC:null,maxC:null};
  return{available:true,sensors:temperatures.length,minC:Math.min(...temperatures),maxC:Math.max(...temperatures)};
}

export function captureTargetRuntimeSnapshot(nowMs=Date.now()):TargetRuntimeSnapshot{
  const [load1=0,load5=0,load15=0]=loadavg();
  return{
    capturedAtMs:nowMs,
    uptimeS:round(Math.max(0,uptime())),
    load1:round(Math.max(0,load1)),
    load5:round(Math.max(0,load5)),
    load15:round(Math.max(0,load15)),
    totalMemoryMiB:round(Math.max(0,totalmem()/MIB)),
    freeMemoryMiB:round(Math.max(0,freemem()/MIB)),
    thermal:readLinuxThermalSnapshot(),
  };
}

export class TargetRuntimeAccumulator {
  private sampleCount=0;
  private uptimeStartS:number|null=null;
  private uptimeEndS:number|null=null;
  private load1Max=0;
  private load5Max=0;
  private load15Max=0;
  private totalMemoryMiB=0;
  private freeMemoryMinMiB=Number.POSITIVE_INFINITY;
  private thermalAvailableSamples=0;
  private thermalSensorsMax=0;
  private thermalMinC=Number.POSITIVE_INFINITY;
  private thermalMaxC=Number.NEGATIVE_INFINITY;

  observe(snapshot:TargetRuntimeSnapshot){
    this.sampleCount+=1;
    this.uptimeStartS??=snapshot.uptimeS;
    this.uptimeEndS=snapshot.uptimeS;
    this.load1Max=Math.max(this.load1Max,snapshot.load1);
    this.load5Max=Math.max(this.load5Max,snapshot.load5);
    this.load15Max=Math.max(this.load15Max,snapshot.load15);
    this.totalMemoryMiB=Math.max(this.totalMemoryMiB,snapshot.totalMemoryMiB);
    this.freeMemoryMinMiB=Math.min(this.freeMemoryMinMiB,snapshot.freeMemoryMiB);
    if(snapshot.thermal.available){
      this.thermalAvailableSamples+=1;
      this.thermalSensorsMax=Math.max(this.thermalSensorsMax,snapshot.thermal.sensors);
      if(snapshot.thermal.minC!==null)this.thermalMinC=Math.min(this.thermalMinC,snapshot.thermal.minC);
      if(snapshot.thermal.maxC!==null)this.thermalMaxC=Math.max(this.thermalMaxC,snapshot.thermal.maxC);
    }
  }

  summary(requirements:TargetRuntimeRequirements){
    const thermalAvailable=this.thermalAvailableSamples>0;
    const thermalRequiredPassed=!requirements.thermalRequired||thermalAvailable;
    const temperaturePassed=!thermalAvailable||this.thermalMaxC<=requirements.maxTemperatureC;
    const freeMemoryMinMiB=Number.isFinite(this.freeMemoryMinMiB)?round(this.freeMemoryMinMiB):0;
    const memoryPassed=requirements.minFreeMemoryMiB<=0||freeMemoryMinMiB>=requirements.minFreeMemoryMiB;
    return{
      sampleCount:this.sampleCount,
      uptimeStartS:this.uptimeStartS,
      uptimeEndS:this.uptimeEndS,
      load:{max1m:round(this.load1Max),max5m:round(this.load5Max),max15m:round(this.load15Max)},
      memory:{totalMiB:round(this.totalMemoryMiB),freeMinMiB:freeMemoryMinMiB,minFreeBudgetMiB:requirements.minFreeMemoryMiB,passed:memoryPassed},
      thermal:{available:thermalAvailable,availableSamples:this.thermalAvailableSamples,sensorsMax:this.thermalSensorsMax,minC:Number.isFinite(this.thermalMinC)?round(this.thermalMinC):null,maxC:Number.isFinite(this.thermalMaxC)?round(this.thermalMaxC):null,required:requirements.thermalRequired,maxBudgetC:requirements.maxTemperatureC,availabilityPassed:thermalRequiredPassed,temperaturePassed},
      privacy:{rawHardwareSerialIncluded:false,hostnameIncluded:false,networkAddressesIncluded:false,processArgumentsIncluded:false,environmentIncluded:false},
      passed:thermalRequiredPassed&&temperaturePassed&&memoryPassed,
    };
  }
}
