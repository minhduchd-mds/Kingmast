'use client';

import { CheckCircle2,ChevronRight,CircleDashed,Database,FlaskConical,Link2,Search,ShieldCheck,Target,Wrench } from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { capabilityDetail } from '../lib/capability-detail';
import { CAPABILITY_GROUPS,KINGMAST_CAPABILITIES,capabilityStateLabel,capabilitySummary,type CapabilityState } from '../lib/capability-registry';

type CapabilityFilter='all'|CapabilityState;

const FILTERS:Array<{value:CapabilityFilter;label:string}>=[
  {value:'all',label:'All'},
  {value:'available',label:'Available'},
  {value:'software-ready',label:'Software ready'},
  {value:'requires-integration',label:'Needs integration'},
  {value:'research',label:'Research'},
];

function StateIcon({state}:{state:CapabilityState}){if(state==='available')return <CheckCircle2/>;if(state==='software-ready')return <ShieldCheck/>;if(state==='requires-integration')return <Link2/>;return <FlaskConical/>;}

export default function CapabilityCenter(){
  const summary=capabilitySummary();
  const[filter,setFilter]=useState<CapabilityFilter>('all');
  const[query,setQuery]=useState('');
  const[selectedId,setSelectedId]=useState(4);
  const normalized=query.trim().toLocaleLowerCase('en');
  const visible=useMemo(()=>KINGMAST_CAPABILITIES.filter((item)=>{
    if(filter!=='all'&&item.state!==filter)return false;
    if(!normalized)return true;
    return `${item.id} ${item.shortName} ${item.name} ${item.group} ${item.source} ${item.note}`.toLocaleLowerCase('en').includes(normalized);
  }),[filter,normalized]);
  useEffect(()=>{if(visible.length&&!visible.some((item)=>item.id===selectedId))setSelectedId(visible[0]!.id);},[selectedId,visible]);
  const selected=visible.find((item)=>item.id===selectedId)??KINGMAST_CAPABILITIES.find((item)=>item.id===selectedId)??visible[0]??null;
  const detail=selected?capabilityDetail(selected):null;

  return <div className="viewEnter capabilityCenter" data-testid="capability-center">
    <section className="surface capabilityHero">
      <div><small>KINGMAST PRODUCT CAPABILITIES</small><h2>36 capabilities · one safety-first platform</h2><p>Browse software readiness and integration truth without adding clutter to the driving screen. A capability is never presented as live until its real vehicle, sensor or provider dependency is confirmed.</p></div>
      <div className="capabilitySummary" aria-label="Capability implementation summary">
        <span><strong>{summary.available}</strong><small>Available</small></span>
        <span><strong>{summary['software-ready']}</strong><small>Software ready</small></span>
        <span><strong>{summary['requires-integration']}</strong><small>Vehicle integration</small></span>
        <span><strong>{summary.research}</strong><small>Research</small></span>
      </div>
    </section>

    <section className="surface capabilityToolbar" aria-label="Capability filters">
      <div className="capabilityFilters" role="group" aria-label="Filter capability status">{FILTERS.map((item)=><button type="button" key={item.value} className={filter===item.value?'selected':''} aria-pressed={filter===item.value} onClick={()=>setFilter(item.value)}>{item.label}</button>)}</div>
      <label className="capabilitySearch"><Search/><span className="srOnly">Search capabilities</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search capability" aria-label="Search capabilities"/></label>
      <b className="capabilityResultCount" aria-live="polite">{visible.length} shown</b>
    </section>

    <div className="capabilityWorkspace">
      <div className="capabilityGroups" data-testid="capability-results">
        {CAPABILITY_GROUPS.map((group)=>{const items=visible.filter((item)=>item.group===group);if(!items.length)return null;return <section className="surface capabilityGroup" key={group}>
          <header><span><CircleDashed/><strong>{group}</strong></span><b>{items.length}</b></header>
          <div className="capabilityGrid">
            {items.map((item)=><button type="button" key={item.key} className={`capabilityCard state-${item.state} ${selected?.id===item.id?'isSelected':''}`} data-capability={item.key} aria-pressed={selected?.id===item.id} onClick={()=>setSelectedId(item.id)}>
              <span className="capabilityId">{String(item.id).padStart(2,'0')}</span>
              <span className="capabilityCopy"><strong>{item.shortName}</strong><small>{item.name}</small><p>{item.note}</p></span>
              <span className="capabilityMeta"><span><StateIcon state={item.state}/>{capabilityStateLabel[item.state]}</span><em>{item.drivingPolicy.replace('-',' ')}</em><ChevronRight/></span>
            </button>)}
          </div>
        </section>;})}
        {!visible.length?<section className="surface capabilityEmpty"><Search/><strong>No capability matches</strong><small>Change the status filter or search phrase.</small><button type="button" onClick={()=>{setFilter('all');setQuery('');}}>Clear filters</button></section>:null}
      </div>

      {selected&&detail?<aside className="surface capabilityDetail" data-testid="capability-detail" aria-labelledby="capability-detail-title">
        <header><span className={`capabilityDetailState state-${selected.state}`}><StateIcon state={selected.state}/>{capabilityStateLabel[selected.state]}</span><b>{String(selected.id).padStart(2,'0')}</b></header>
        <div className="capabilityDetailTitle"><small>{selected.group}</small><h3 id="capability-detail-title">{selected.name}</h3><p>{selected.note}</p></div>
        <div className="capabilityDetailFacts"><span><Database/><span><small>Source</small><strong>{selected.source}</strong></span></span><span><Target/><span><small>Driver policy</small><strong>{selected.drivingPolicy.replace('-',' ')}</strong></span></span></div>
        <div className="capabilityDetailSections">
          <section><strong>Driver behavior</strong><p>{detail.driverBehavior}</p></section>
          <section><strong>Integration gate</strong><p>{detail.integrationGate}</p></section>
          <section className="safety"><strong><ShieldCheck/> Safety boundary</strong><p>{detail.safetyBoundary}</p></section>
          <section><strong><Wrench/> Next integration action</strong><p>{detail.nextAction}</p></section>
        </div>
        <footer>Capability status describes current KINGMAST integration readiness, not OEM certification.</footer>
      </aside>:null}
    </div>

    <footer className="capabilitySafety"><ShieldCheck/><span><strong>Production safety boundary</strong><small>No brake, steering, throttle, gear, torque or CAN write authority is exposed by these capabilities.</small></span></footer>
  </div>;
}
