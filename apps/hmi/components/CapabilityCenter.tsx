'use client';

import { CheckCircle2,CircleDashed,FlaskConical,Link2,ShieldCheck } from 'lucide-react';
import { CAPABILITY_GROUPS,KINGMAST_CAPABILITIES,capabilityStateLabel,capabilitySummary,type CapabilityState } from '../lib/capability-registry';

function StateIcon({state}:{state:CapabilityState}){if(state==='available')return <CheckCircle2/>;if(state==='software-ready')return <ShieldCheck/>;if(state==='requires-integration')return <Link2/>;return <FlaskConical/>;}

export default function CapabilityCenter(){
  const summary=capabilitySummary();
  return <div className="viewEnter capabilityCenter" data-testid="capability-center">
    <section className="surface capabilityHero">
      <div><small>KINGMAST PRODUCT CAPABILITIES</small><h2>36 capabilities · one safety-first platform</h2><p>Capability states are explicit. KINGMAST never presents a hardware/provider-dependent function as live until the native vehicle host or trusted provider confirms it.</p></div>
      <div className="capabilitySummary" aria-label="Capability implementation summary">
        <span><strong>{summary.available}</strong><small>Available</small></span>
        <span><strong>{summary['software-ready']}</strong><small>Software ready</small></span>
        <span><strong>{summary['requires-integration']}</strong><small>Vehicle integration</small></span>
        <span><strong>{summary.research}</strong><small>Research</small></span>
      </div>
    </section>
    <div className="capabilityGroups">
      {CAPABILITY_GROUPS.map((group)=><section className="surface capabilityGroup" key={group}>
        <header><span><CircleDashed/><strong>{group}</strong></span><b>{KINGMAST_CAPABILITIES.filter((item)=>item.group===group).length}</b></header>
        <div className="capabilityGrid">
          {KINGMAST_CAPABILITIES.filter((item)=>item.group===group).map((item)=><article key={item.key} className={`capabilityCard state-${item.state}`} data-capability={item.key}>
            <span className="capabilityId">{String(item.id).padStart(2,'0')}</span>
            <div className="capabilityCopy"><strong>{item.shortName}</strong><small>{item.name}</small><p>{item.note}</p></div>
            <div className="capabilityMeta"><span><StateIcon state={item.state}/>{capabilityStateLabel[item.state]}</span><em>{item.drivingPolicy.replace('-',' ')}</em></div>
          </article>)}
        </div>
      </section>)}
    </div>
    <footer className="capabilitySafety"><ShieldCheck/><span><strong>Production safety boundary</strong><small>Warning-only / Level 0. No brake, steering, throttle, gear, torque or CAN write authority is exposed by these capabilities.</small></span></footer>
  </div>;
}
