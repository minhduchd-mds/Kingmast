import {readJson,sha256File,validateExternalResult} from './external-evidence-lib.mjs';

const args=process.argv.slice(2);
const valueAfter=(flag)=>{const index=args.indexOf(flag);return index>=0?args[index+1]:undefined;};
const engine=valueAfter('--engine');
const file=valueAfter('--file');
const campaignPath=valueAfter('--campaign');
const sourceCommit=valueAfter('--commit');
const scope=valueAfter('--scope');
if(!['carla','esmini'].includes(engine))throw new Error('--engine must be carla or esmini');
if(!file||!campaignPath||!sourceCommit||!scope)throw new Error('usage: --engine <carla|esmini> --file <result.json> --campaign <campaign.json> --commit <40-char-sha> --scope <smoke|validation>');
const runnerContract=readJson('autonomy-lab/digital-twin/runner-contract.json');
const campaign=readJson(campaignPath);
const report=readJson(file);
const campaignFileSha256=sha256File(campaignPath);
const validation=validateExternalResult({report,engine,campaign,campaignFileSha256,sourceCommit,scope,runnerContract});
if(!validation.ok){console.error(`KINGMAST ${engine} external result validation failed:\n`+validation.errors.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[external-result] engine=${engine}; version=${validation.summary.engineVersion}; scope=${scope}; granularity=${validation.summary.scenarioGranularity}; results=${validation.summary.resultCount}; campaign-bound=true; physical-qualification=false`);
