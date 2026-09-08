import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const registry=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-research/source-registry.json'),'utf8'));
const library=JSON.parse(readFileSync(resolve(root,'autonomy-lab/safety-sim/scenario-library.json'),'utf8'));
const sourceById=new Map((registry.sources??[]).map((source)=>[source.id,source]));
const rows=[];
for(const domain of [...new Set((library.scenarios??[]).map((scenario)=>scenario.domain))].sort()){
  const domainScenarios=(library.scenarios??[]).filter((scenario)=>scenario.domain===domain);
  const sourceIds=[...new Set(domainScenarios.flatMap((scenario)=>scenario.sourceRefs??[]))];
  const regionSet=new Set();
  const authoritySet=new Set();
  let nonOem=0;
  for(const id of sourceIds){const source=sourceById.get(id);if(!source)continue;regionSet.add(source.region);authoritySet.add(source.authority);if(source.region!=='OEM')nonOem+=1;}
  const gaps=[];
  if(domainScenarios.length<2)gaps.push('scenario-depth');
  if(sourceIds.length<2)gaps.push('source-diversity');
  if(nonOem===0)gaps.push('independent-non-oem-source');
  if(!regionSet.has('US')&&!regionSet.has('EU')&&!regionSet.has('VN')&&!regionSet.has('International'))gaps.push('regulator-or-standards-grounding');
  rows.push({domain,scenarioCount:domainScenarios.length,sourceCount:sourceIds.length,regions:[...regionSet].sort(),authorities:[...authoritySet].sort(),gaps});
}
const gaps=rows.filter((row)=>row.gaps.length>0);
const report={schema:'kingmast-safety-research-gap-report/v1',generatedAt:new Date().toISOString(),productVersion:registry.version,controlAuthority:'none',qualificationClaim:'research-gap-analysis-only-not-compliance-or-safety-rating',onlineLearning:false,automaticProductionPromotion:false,domainCount:rows.length,domainsWithResearchGaps:gaps.length,domains:rows,nextResearchTargets:gaps.map((row)=>({domain:row.domain,needs:row.gaps})),note:'A research gap prompts more authoritative sources or scenarios. It is not evidence that production is unsafe, and closing a research gap is not a production qualification.'};
const args=new Set(process.argv.slice(2));
if(args.has('--json'))console.log(JSON.stringify(report,null,2));
else{console.log(`[safety-research-gaps] domains=${report.domainCount}; gaps=${report.domainsWithResearchGaps}; automatic-production-promotion=false`);for(const item of report.nextResearchTargets)console.log(`- ${item.domain}: ${item.needs.join(',')}`);}
if(args.has('--ci')&&report.domainsWithResearchGaps!==0)process.exit(1);
