'use client';

import {AlertTriangle,BrainCircuit,Eye,Route} from 'lucide-react';
import {useMemo} from 'react';
import {useNextgenRuntime} from '../lib/use-nextgen-runtime';
import {buildNextgenStatusCards,type NextgenStatusCard} from '../lib/nextgen-view-model';
import {useI18n} from '../lib/i18n';

function iconFor(card:NextgenStatusCard){
  if(card.id==='driver')return Eye;
  if(card.id.startsWith('advisory-'))return Route;
  if(card.id==='perception'||card.id==='camera')return BrainCircuit;
  return AlertTriangle;
}

export default function NextgenIntelligenceHud(){
  const{snapshot,loading,error}=useNextgenRuntime(true,2_000);
  const{isVietnamese}=useI18n();
  const card=useMemo(()=>buildNextgenStatusCards(snapshot,isVietnamese).find((item)=>item.tone==='critical'||item.tone==='caution')??null,[snapshot,isVietnamese]);
  if((loading&&!snapshot)||error||!card)return null;
  const Icon=iconFor(card);
  const critical=card.tone==='critical';
  return <aside className={`connectedRoadHud connectedRoadCompact nextgenIntelligenceHud severity-${critical?'critical':'caution'}`} role={critical?'alert':'status'} aria-label={isVietnamese?'Trí tuệ dự báo KINGMAST':'KINGMAST predictive intelligence'} data-testid="nextgen-intelligence" data-attention={critical?'critical':'transient'}>
    <div className="connectedRoadHead"><span><BrainCircuit strokeWidth={1.8}/><strong>{isVietnamese?'Trí tuệ xe':'Vehicle intelligence'}</strong><small>{isVietnamese?'chỉ khuyến cáo':'advisory only'}</small></span></div>
    <div className={`connectedAdvisory severity-${critical?'critical':'caution'}`}><Icon strokeWidth={1.9}/><span><strong>{card.title}</strong><small>{card.detail}</small></span></div>
  </aside>;
}
