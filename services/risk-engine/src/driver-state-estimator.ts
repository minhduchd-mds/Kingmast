import type { DriverStateAssessment,DriverStateObservation } from '@kingmast/contracts/nextgen';

const MAX_SAMPLE_AGE_MS=1_500;
const WINDOW_MS=6_000;
const MIN_FACE_CONFIDENCE=.55;

export class DriverStateEstimator{
  private readonly samples:DriverStateObservation[]=[];
  constructor(private readonly maxSamples=120){}

  ingest(sample:DriverStateObservation,nowMs=Date.now()):DriverStateAssessment{
    if(!Number.isFinite(sample.observedAtMs))return this.unavailable('invalid-timestamp');
    this.samples.push(sample);
    const cutoff=nowMs-WINDOW_MS;
    while(this.samples.length&&this.samples[0]!.observedAtMs<cutoff)this.samples.shift();
    if(this.samples.length>this.maxSamples)this.samples.splice(0,this.samples.length-this.maxSamples);
    return this.assess(nowMs);
  }

  assess(nowMs=Date.now()):DriverStateAssessment{
    const latest=this.samples.at(-1);
    if(!latest)return this.unavailable('no-driver-observation');
    const ageMs=Math.max(0,nowMs-latest.observedAtMs);
    if(nowMs-latest.observedAtMs< -250)return this.unavailable('future-driver-observation');
    if(ageMs>MAX_SAMPLE_AGE_MS)return{state:'driver-unavailable',confidence:0,observedAtMs:latest.observedAtMs,ageMs,reason:'stale-driver-observation',advisoryOnly:true};
    const window=this.samples.filter((sample)=>sample.observedAtMs>=nowMs-WINDOW_MS);
    if(!latest.faceDetected||latest.confidence<MIN_FACE_CONFIDENCE)return{state:'driver-unavailable',confidence:latest.confidence,observedAtMs:latest.observedAtMs,ageMs,reason:'driver-face-unavailable',advisoryOnly:true};
    const valid=window.filter((sample)=>sample.faceDetected&&sample.confidence>=MIN_FACE_CONFIDENCE);
    if(!valid.length)return{state:'unknown',confidence:0,observedAtMs:latest.observedAtMs,ageMs,reason:'insufficient-driver-evidence',advisoryOnly:true};
    const eyesClosedRatio=valid.filter((sample)=>sample.eyesClosed).length/valid.length;
    const gazeAwayRatio=valid.filter((sample)=>sample.gazeAway||Math.abs(sample.headYawDeg)>35||Math.abs(sample.headPitchDeg)>30).length/valid.length;
    const confidence=valid.reduce((sum,sample)=>sum+sample.confidence,0)/valid.length;
    if(eyesClosedRatio>=.48&&valid.length>=3)return{state:'drowsy',confidence,observedAtMs:latest.observedAtMs,ageMs,reason:'sustained-eye-closure',advisoryOnly:true};
    if(gazeAwayRatio>=.6&&valid.length>=3)return{state:'distracted',confidence,observedAtMs:latest.observedAtMs,ageMs,reason:'sustained-gaze-away',advisoryOnly:true};
    return{state:'attentive',confidence,observedAtMs:latest.observedAtMs,ageMs,reason:'driver-attention-evidence-stable',advisoryOnly:true};
  }

  reset(){this.samples.length=0;}
  private unavailable(reason:string):DriverStateAssessment{return{state:'driver-unavailable',confidence:0,observedAtMs:null,ageMs:null,reason,advisoryOnly:true};}
}
