'use client';

import { useEffect,useState } from 'react';
import AssistantOverlay from './AssistantOverlay';

const FIRST_RUN_STORAGE_KEY='kingmast:v006:first-run-complete';

export default function AssistantRuntime(){
  const[ready,setReady]=useState(false);
  useEffect(()=>{try{setReady(window.localStorage.getItem(FIRST_RUN_STORAGE_KEY)==='1');}catch{setReady(false);}},[]);
  return ready?<AssistantOverlay/>:null;
}
