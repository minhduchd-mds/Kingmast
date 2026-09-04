export type PartnerScope='safety-score.read'|'trip-summary.read'|'vehicle-health.read';
export interface PartnerConsent{
  partnerId:string;
  scopes:PartnerScope[];
  grantedAtMs:number;
  expiresAtMs:number;
  explicit:boolean;
  revokedAtMs:number|null;
}
const ALLOWED_SCOPES:readonly PartnerScope[]=['safety-score.read','trip-summary.read','vehicle-health.read'];

export function createPartnerConsent(input:{partnerId:string;scopes:string[];grantedAtMs:number;expiresAtMs:number;explicit:boolean}):PartnerConsent{
  if(!input.explicit)throw new Error('explicit-consent-required');
  if(!input.partnerId.trim())throw new Error('partner-id-required');
  if(input.expiresAtMs<=input.grantedAtMs||input.expiresAtMs-input.grantedAtMs>90*24*60*60*1000)throw new Error('invalid-consent-expiry');
  const scopes=[...new Set(input.scopes)];
  if(scopes.length===0||scopes.some((scope)=>!ALLOWED_SCOPES.includes(scope as PartnerScope)))throw new Error('partner-scope-not-allowed');
  return{partnerId:input.partnerId.trim(),scopes:scopes as PartnerScope[],grantedAtMs:input.grantedAtMs,expiresAtMs:input.expiresAtMs,explicit:true,revokedAtMs:null};
}
export function consentAllows(consent:PartnerConsent,scope:PartnerScope,nowMs=Date.now()){return consent.explicit&&consent.revokedAtMs===null&&nowMs<consent.expiresAtMs&&consent.scopes.includes(scope);}
export function revokePartnerConsent(consent:PartnerConsent,nowMs=Date.now()):PartnerConsent{return{...consent,revokedAtMs:nowMs};}
