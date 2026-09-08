import {buildExternalEvidenceManifest} from './external-evidence-lib.mjs';

const args=process.argv.slice(2);
const valueAfter=(flag)=>{const index=args.indexOf(flag);return index>=0?args[index+1]:undefined;};
const campaignPath=valueAfter('--campaign');
const carlaPath=valueAfter('--carla');
const esminiPath=valueAfter('--esmini');
const parityPath=valueAfter('--parity');
const sourceCommit=valueAfter('--commit');
const scope=valueAfter('--scope');
if(!campaignPath||!carlaPath||!esminiPath||!parityPath||!sourceCommit||!scope)throw new Error('usage: --campaign <campaign.json> --carla <result.json> --esmini <result.json> --parity <parity.json> --commit <40-char-sha> --scope <smoke|validation>');
const manifest=buildExternalEvidenceManifest({campaignPath,carlaPath,esminiPath,parityPath,sourceCommit,scope});
process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
