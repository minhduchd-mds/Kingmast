'use client';

import { Bot,CheckCircle2,LoaderCircle,MessageCircle,Mic,MicOff,Send,ShieldCheck,TriangleAlert,Volume2,VolumeX,X } from 'lucide-react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { useI18n } from '../lib/i18n';
import { parseAssistantNavigationIntent,requestAssistantNavigation,type AssistantNavigationResultDetail } from '../lib/assistant-navigation';
import { useDeviceHealth } from '../lib/use-device-health';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';

type AssistantMode='provider'|'grounded-fallback'|'offline-fallback';
type AssistantReply={answer:string;mode:AssistantMode;grounded:boolean;executionAllowed:boolean;providerConfigured:boolean;controlAuthority:'none'};
type Message={id:number;role:'user'|'assistant';text:string;mode?:AssistantMode;grounded?:boolean};

type RecognitionResultEvent={results:{[index:number]:{[index:number]:{transcript:string};isFinal:boolean};length:number}};
interface RecognitionLike{lang:string;continuous:boolean;interimResults:boolean;start():void;stop():void;abort():void;onresult:((event:RecognitionResultEvent)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;}
type RecognitionCtor=new()=>RecognitionLike;
type SpeechWindow=Window & {SpeechRecognition?:RecognitionCtor;webkitSpeechRecognition?:RecognitionCtor;kingmastNative?:{voice?:{listen?:(input:{locale:string})=>Promise<{text:string}>;speak?:(input:{text:string;locale:string})=>Promise<void>;cancel?:()=>void}}};

function localIntent(input:string){const value=input.toLocaleLowerCase('vi');if(/(thiết bị|device|sensor|cảm biến|radar|camera|lỗi|fault|kết nối)/.test(value))return'device';if(/(làm được gì|trợ giúp|help|what can)/.test(value))return'help';return'unknown';}
function routeAnswer(result:AssistantNavigationResultDetail,locale:string){
  const vi=locale==='vi-VN';if(!result.ok||!result.route){if(result.error==='offline')return vi?'Hiện đang ngoại tuyến nên em chưa thể tìm tuyến mới. Tuyến và cảnh báo đang có trên xe vẫn giữ nguyên.':'You are offline, so I cannot search for a new route right now. Existing on-vehicle guidance and warnings remain available.';if(result.error==='not-found')return vi?'Em chưa tìm thấy điểm đến đó. Anh nói rõ hơn tên địa điểm hoặc quận, thành phố giúp em nhé.':'I could not find that destination. Try the place name with a district or city.';return vi?'Em chưa lấy được tuyến đường đáng tin cậy lúc này. Em sẽ không đoán đường đi.':'I could not get a trustworthy route right now, so I will not guess the directions.';}
  const km=result.route.distanceM/1000;const min=Math.max(1,Math.round(result.route.durationS/60));const distance=km<10?km.toFixed(1):Math.round(km).toString();const traffic=result.route.traffic?.aware===true;const delay=result.route.traffic?.delayS??null;const place=result.destinationName??(vi?'điểm đến':'the destination');
  if(traffic){const delayText=delay!==null&&delay>=60?(vi?` Giao thông hiện tại làm chậm khoảng ${Math.round(delay/60)} phút.`:` Current traffic adds about ${Math.round(delay/60)} minutes.`):'';return vi?`Em đã chọn tuyến nhanh phù hợp giao thông hiện tại tới ${place}: khoảng ${distance} km, ${min} phút. Tuyến đã hiện trên bản đồ.${delayText}`:`I found a traffic-aware route to ${place}: about ${distance} km and ${min} minutes. It is now shown on the map.${delayText}`;}
  return vi?`Em đã chọn tuyến nhanh nhất theo dữ liệu định tuyến hiện có tới ${place}: khoảng ${distance} km, ${min} phút. Tuyến đã hiện trên bản đồ; hiện chưa có dữ liệu giao thông trực tiếp nên em không khẳng định đây là đường ít tắc nhất.`:`I found the fastest route available from the current routing data to ${place}: about ${distance} km and ${min} minutes. It is on the map; live traffic is not available, so I cannot claim it is the least congested route.`;
}

export default function AssistantOverlay(){
  const{locale,t}=useI18n();const devices=useDeviceHealth();
  const[open,setOpen]=useState(false);const[input,setInput]=useState('');const[messages,setMessages]=useState<Message[]>([]);const[busy,setBusy]=useState(false);const[listening,setListening]=useState(false);const[speakReplies,setSpeakReplies]=useState(true);const[moving,setMoving]=useState(false);const[lastMode,setLastMode]=useState<AssistantMode|null>(null);const[voiceError,setVoiceError]=useState<string|null>(null);
  const recognitionRef=useRef<RecognitionLike|null>(null);const audioRef=useRef<HTMLAudioElement|null>(null);const audioUrlRef=useRef<string|null>(null);const messageId=useRef(0);const inputRef=useRef<HTMLInputElement|null>(null);

  const stopSpeech=useCallback(()=>{try{audioRef.current?.pause();}catch{}audioRef.current=null;if(audioUrlRef.current){URL.revokeObjectURL(audioUrlRef.current);audioUrlRef.current=null;}const native=(window as SpeechWindow).kingmastNative?.voice;try{native?.cancel?.();}catch{}if('speechSynthesis'in window)window.speechSynthesis.cancel();},[]);
  useEffect(()=>{const onTelemetry=(event:Event)=>{const detail=(event as CustomEvent<KingmastTelemetryEventDetail>).detail;setMoving(Boolean(detail?.frame?.vehicle&&detail.frame.vehicle.source!=='simulator'&&detail.frame.vehicle.speedKmh>=5));};window.addEventListener('kingmast:telemetry',onTelemetry);return()=>window.removeEventListener('kingmast:telemetry',onTelemetry);},[]);
  useEffect(()=>{if(moving)setInput('');},[moving]);
  useEffect(()=>()=>{recognitionRef.current?.abort();stopSpeech();},[stopSpeech]);
  useEffect(()=>{const openAssistant=()=>setOpen(true);window.addEventListener('kingmast:assistant-open',openAssistant);return()=>window.removeEventListener('kingmast:assistant-open',openAssistant);},[]);

  const safeDevices=useMemo(()=>devices.devices.map((device)=>({id:device.id,label:device.label,connection:device.connection,health:device.health,faults:device.faults.map((fault)=>({code:fault.code,layer:fault.layer,severity:fault.severity,summary:fault.summary,action:fault.action}))})),[devices.devices]);
  const localFallback=useCallback((question:string)=>{const intent=localIntent(question);if(intent==='help')return t('assistant.help');if(intent==='device'){
    const bad=devices.devices.filter((device)=>device.health==='fault'||device.health==='warning'||device.health==='calibration-required');const disconnected=devices.devices.filter((device)=>device.connection==='disconnected');
    if(bad.length)return t('assistant.deviceFaults',{count:bad.length,devices:bad.map((device)=>{const fault=device.faults[0];return fault?`${device.label}: ${fault.summary} (${fault.layer}/${fault.code})`:device.label;}).join('; ')});
    if(disconnected.length)return t('assistant.deviceDisconnected',{devices:disconnected.map((device)=>device.label).join(', ')});
    return t('assistant.deviceAllReady');
  }return t('assistant.requestFailed');},[devices.devices,t]);

  const speak=useCallback(async(text:string)=>{if(!speakReplies||!text)return;stopSpeech();
    try{const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),4200);const response=await fetch('/api/kingmast/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,locale,moving}),cache:'no-store',signal:controller.signal});window.clearTimeout(timer);if(response.ok){const blob=await response.blob();if(blob.size>0){const url=URL.createObjectURL(blob);audioUrlRef.current=url;const audio=new Audio(url);audioRef.current=audio;audio.onended=()=>{if(audioUrlRef.current===url){URL.revokeObjectURL(url);audioUrlRef.current=null;}audioRef.current=null;};audio.onerror=()=>{if(audioUrlRef.current===url){URL.revokeObjectURL(url);audioUrlRef.current=null;}audioRef.current=null;};await audio.play();return;}}}catch{}
    const native=(window as SpeechWindow).kingmastNative?.voice;if(native?.speak){try{await native.speak({text,locale});return;}catch{}}
    if(!('speechSynthesis'in window))return;const utterance=new SpeechSynthesisUtterance(text);utterance.lang=locale==='vi-VN'?'vi-VN':'en-US';const voices=window.speechSynthesis.getVoices();const match=voices.find((voice)=>voice.lang.toLocaleLowerCase().startsWith(locale==='vi-VN'?'vi':'en'));if(match)utterance.voice=match;utterance.rate=moving?1.03:.98;utterance.pitch=1;window.speechSynthesis.speak(utterance);
  },[locale,moving,speakReplies,stopSpeech]);

  const appendAssistant=useCallback((text:string,mode:AssistantMode,grounded:boolean)=>{setLastMode(mode);setMessages((current)=>[...current.slice(-7),{id:++messageId.current,role:'assistant',text,mode,grounded}]);setBusy(false);void speak(text);},[speak]);
  const submit=useCallback(async(raw:string)=>{const question=raw.trim().slice(0,240);if(!question||busy)return;setVoiceError(null);setBusy(true);setInput('');setMessages((current)=>[...current.slice(-7),{id:++messageId.current,role:'user',text:question}]);
    const navigationIntent=parseAssistantNavigationIntent(question);if(navigationIntent){const result=await requestAssistantNavigation(navigationIntent);appendAssistant(routeAnswer(result,locale),'grounded-fallback',Boolean(result.route));return;}
    let reply:AssistantReply|null=null;try{const response=await fetch('/api/kingmast/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:question,locale,devices:safeDevices}),cache:'no-store'});if(response.ok){const payload=await response.json() as AssistantReply;if(payload.controlAuthority==='none'&&typeof payload.answer==='string')reply=payload;}}catch{}
    const text=reply?.answer||localFallback(question);appendAssistant(text,reply?.mode??'offline-fallback',reply?.grounded??false);
  },[appendAssistant,busy,locale,localFallback,safeDevices]);

  const startVoice=useCallback(async()=>{if(listening){recognitionRef.current?.stop();setListening(false);return;}setVoiceError(null);const native=(window as SpeechWindow).kingmastNative?.voice;if(native?.listen){setListening(true);try{const result=await native.listen({locale});const text=result.text.trim();if(text)await submit(text);}catch{setVoiceError(t('assistant.voiceUnavailable'));}finally{setListening(false);}return;}
    const Ctor=(window as SpeechWindow).SpeechRecognition??(window as SpeechWindow).webkitSpeechRecognition;if(!Ctor){setVoiceError(t('assistant.voiceUnavailable'));return;}const recognition=new Ctor();recognition.lang=locale==='vi-VN'?'vi-VN':'en-US';recognition.continuous=false;recognition.interimResults=false;recognition.onresult=(event)=>{const text=event.results[0]?.[0]?.transcript?.trim()??'';if(text)void submit(text);};recognition.onerror=()=>{setVoiceError(t('assistant.voiceUnavailable'));setListening(false);};recognition.onend=()=>setListening(false);recognitionRef.current=recognition;setListening(true);try{recognition.start();}catch{setListening(false);setVoiceError(t('assistant.voiceUnavailable'));}},[listening,locale,submit,t]);

  const quick=[t('assistant.quickHealth'),t('assistant.quickAlert'),t('assistant.quickRoad'),t('assistant.quickRoute'),t('assistant.quickCharge'),t('assistant.quickHelp')];
  return <div className={`assistantLayer ${open?'isOpen':''} ${moving?'isMoving':'isParked'}`} data-testid="kingmast-assistant">
    {!open?<button type="button" className="assistantLauncher" aria-label={t('assistant.open')} onClick={()=>setOpen(true)}><Bot/><span>{t('assistant.shortTitle')}</span></button>:null}
    {open?<section className="assistantPanel" role="dialog" aria-modal="false" aria-label={t('assistant.title')}>
      <header className="assistantHeader"><span className="assistantOrb"><Bot/></span><span><strong>{t('assistant.title')}</strong><small>{t('assistant.tagline')}</small></span><div><button type="button" aria-label={speakReplies?t('assistant.speakOff'):t('assistant.speakOn')} aria-pressed={speakReplies} onClick={()=>{setSpeakReplies((value)=>!value);if(speakReplies)stopSpeech();}}>{speakReplies?<Volume2/>:<VolumeX/>}</button><button type="button" aria-label={t('assistant.close')} onClick={()=>setOpen(false)}><X/></button></div></header>
      <div className="assistantTrust"><ShieldCheck/><span><strong>{t('assistant.grounded')}</strong><small>{t('assistant.noControl')}</small></span><b data-mode={lastMode??'idle'}>{lastMode==='provider'?t('assistant.provider'):lastMode==='offline-fallback'?t('assistant.offline'):lastMode==='grounded-fallback'?t('assistant.grounded'):moving?'Drive':'Ready'}</b></div>
      <div className="assistantMessages" aria-live="polite">{messages.length===0?<div className="assistantWelcome"><MessageCircle/><strong>{moving?t('assistant.movingHint'):t('assistant.parkedHint')}</strong><div className="assistantQuick">{quick.slice(0,moving?3:6).map((item)=><button type="button" key={item} onClick={()=>void submit(item)}>{item}</button>)}</div></div>:messages.map((message)=><div key={message.id} className={`assistantMessage role-${message.role}`}><span>{message.text}</span>{message.role==='assistant'?<small>{message.mode==='provider'?t('assistant.provider'):message.mode==='offline-fallback'?t('assistant.offline'):t('assistant.grounded')}</small>:null}</div>)}{busy?<div className="assistantMessage role-assistant isBusy"><LoaderCircle className="isSpinning"/><span>{t('assistant.thinking')}</span></div>:null}</div>
      {voiceError?<div className="assistantVoiceError" role="status"><TriangleAlert/><span>{voiceError}</span></div>:null}
      <div className="assistantComposer"><button type="button" className={listening?'isListening':''} aria-label={listening?t('assistant.stopVoice'):t('assistant.voice')} aria-pressed={listening} onClick={()=>void startVoice()}>{listening?<MicOff/>:<Mic/>}</button><input ref={inputRef} aria-label={t('assistant.placeholder')} placeholder={moving?t('assistant.inputParkedOnly'):t('assistant.placeholder')} value={input} maxLength={240} disabled={moving||busy} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void submit(input);}}}/><button type="button" aria-label={t('assistant.send')} disabled={moving||busy||!input.trim()} onClick={()=>void submit(input)}>{busy?<LoaderCircle className="isSpinning"/>:<Send/>}</button></div>
      <footer><CheckCircle2/><span>{moving?t('assistant.movingHint'):t('assistant.parkedHint')}</span></footer>
    </section>:null}
  </div>;
}
