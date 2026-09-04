import { Bot,Camera,Eye,Route } from 'lucide-react';
import { KINGMAST_CAPABILITIES,capabilityStateLabel,type CapabilityState } from '../lib/capability-registry';

const DRIVER_CAPABILITIES=[
  {key:'ldw',icon:Route,summary:'Lane departure model ready',detail:'Calibrated front-camera lane input required.'},
  {key:'dms',icon:Eye,summary:'Driver attention model ready',detail:'Cabin vision integration required.'},
  {key:'assistant',icon:Bot,summary:'Read-only assistant',detail:'Navigation, road, vehicle-health and alert context only.'},
  {key:'surround',icon:Camera,summary:'Low-speed 360 view',detail:'Native cameras and multi-camera calibration required.'},
] as const;

const stateTone:Record<CapabilityState,string>={available:'ready','software-ready':'staged','requires-integration':'integration',research:'research'};

export default function DriverCapabilityRail(){
  const items=DRIVER_CAPABILITIES.map((item)=>({
    ...item,
    capability:KINGMAST_CAPABILITIES.find((capability)=>capability.key===item.key),
  })).filter((item)=>item.capability!==undefined);

  return <aside className="driverCapabilityRail" aria-label="Driver assistance capability status" data-testid="driver-capability-rail">
    <div className="driverCapabilityIntro">
      <strong>Driver assist</strong>
      <span>Warning-only · no vehicle control</span>
    </div>
    {items.map(({key,icon:Icon,summary,detail,capability})=>{
      if(!capability)return null;
      return <article key={key} className={`driverCapabilityItem tone-${stateTone[capability.state]}`} data-capability={key}>
        <span className="driverCapabilityIcon"><Icon strokeWidth={1.8}/></span>
        <span className="driverCapabilityCopy">
          <span className="driverCapabilityTitle"><strong>{capability.shortName}</strong><em>{capabilityStateLabel[capability.state]}</em></span>
          <small>{summary}</small>
          <p>{detail}</p>
        </span>
      </article>;
    })}
  </aside>;
}
