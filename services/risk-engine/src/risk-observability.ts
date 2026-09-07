import type {RiskAssessment} from '@kingmast/contracts';

export interface RiskMetricsSnapshot {
  assessments:number;
  severity:{safe:number;caution:number;critical:number};
  rejected:{stale:number;future:number;radarUnavailable:number};
  latencyMs:{last:number;max:number;buckets:{le1:number;le5:number;le10:number;le25:number;gt25:number}};
}

export class BoundedRiskMetrics {
  private assessments=0;
  private safe=0;
  private caution=0;
  private critical=0;
  private stale=0;
  private future=0;
  private radarUnavailable=0;
  private lastLatencyMs=0;
  private maxLatencyMs=0;
  private le1=0;
  private le5=0;
  private le10=0;
  private le25=0;
  private gt25=0;

  observe(result:RiskAssessment,latencyMs:number){
    const boundedLatency=Number.isFinite(latencyMs)?Math.max(0,Math.min(60_000,latencyMs)):60_000;
    this.assessments+=1;
    if(result.severity==='critical')this.critical+=1;
    else if(result.severity==='caution')this.caution+=1;
    else this.safe+=1;
    if(result.reasons.includes('stale-data-rejected'))this.stale+=1;
    if(result.reasons.includes('future-data-rejected'))this.future+=1;
    if(result.reasons.includes('radar-unavailable'))this.radarUnavailable+=1;
    this.lastLatencyMs=boundedLatency;
    this.maxLatencyMs=Math.max(this.maxLatencyMs,boundedLatency);
    if(boundedLatency<=1)this.le1+=1;
    else if(boundedLatency<=5)this.le5+=1;
    else if(boundedLatency<=10)this.le10+=1;
    else if(boundedLatency<=25)this.le25+=1;
    else this.gt25+=1;
  }

  snapshot():RiskMetricsSnapshot {
    return{
      assessments:this.assessments,
      severity:{safe:this.safe,caution:this.caution,critical:this.critical},
      rejected:{stale:this.stale,future:this.future,radarUnavailable:this.radarUnavailable},
      latencyMs:{last:Number(this.lastLatencyMs.toFixed(3)),max:Number(this.maxLatencyMs.toFixed(3)),buckets:{le1:this.le1,le5:this.le5,le10:this.le10,le25:this.le25,gt25:this.gt25}},
    };
  }
}

export const riskRuntimeMetrics=new BoundedRiskMetrics();
export function riskMetricsSnapshot(){return riskRuntimeMetrics.snapshot();}
