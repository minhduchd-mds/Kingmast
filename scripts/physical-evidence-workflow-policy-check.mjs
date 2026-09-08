import {readFileSync} from 'node:fs';

const specs=[
  {path:'.github/workflows/hil-physical-evidence.yml',runner:'runs-on: [self-hosted, linux, kingmast-hil]',environment:'environment: hil-physical-evidence',ack:'acknowledge_physical_evidence_only',kind:'KINGMAST_PHYSICAL_EVIDENCE_KIND: hil',manifest:'kingmast.hil-physical-manifest.json'},
  {path:'.github/workflows/closed-track-evidence.yml',runner:'runs-on: [self-hosted, linux, kingmast-track-evidence]',environment:'environment: closed-track-evidence',ack:'acknowledge_existing_physical_capture',kind:'KINGMAST_PHYSICAL_EVIDENCE_KIND: closed-track',manifest:'kingmast.closed-track-physical-manifest.json'},
];
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
for(const spec of specs){
  const source=readFileSync(spec.path,'utf8');
  expect(/\bon:\s*\n\s*workflow_dispatch:/m.test(source),`${spec.path}: workflow must be manual workflow_dispatch`);
  expect(!/^\s*(push|pull_request|schedule):/m.test(source),`${spec.path}: physical evidence workflow must not run from push, PR or schedule`);
  expect(source.includes('permissions:\n  contents: read'),`${spec.path}: contents permission must remain read-only`);
  expect(source.includes(spec.runner),`${spec.path}: dedicated self-hosted runner is required`);
  expect(source.includes(spec.environment),`${spec.path}: protected evidence environment is required`);
  expect(source.includes(spec.ack),`${spec.path}: explicit physical-evidence acknowledgement is required`);
  expect(source.includes('persist-credentials: false'),`${spec.path}: checkout credentials must not persist`);
  expect(source.includes('KINGMAST_EXPECTED_SOURCE_COMMIT: ${{ github.sha }}'),`${spec.path}: package must bind to the exact checked-out source commit`);
  expect(source.includes(spec.kind),`${spec.path}: physical evidence kind must be explicit`);
  expect(source.includes('pnpm evidence:physical-manifest'),`${spec.path}: physical evidence manifest generation is required`);
  expect(source.includes('pnpm evidence:physical-manifest-check'),`${spec.path}: physical evidence manifest verification is required`);
  expect(source.includes(spec.manifest),`${spec.path}: hashed physical evidence manifest must be uploaded`);
  expect(source.includes("reviewDisposition!=='captured-awaiting-independent-review'"),`${spec.path}: package must remain pending independent review`);
  expect(!/\bcurl\b|\bwget\b|git\s+clone/i.test(source),`${spec.path}: workflow must not download ad-hoc runtime code`);
  expect(!/contents:\s*write|security-events:\s*write|actions:\s*write/i.test(source),`${spec.path}: workflow must not receive repository write privileges`);
}
if(failures.length){console.error('KINGMAST physical evidence workflow policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST physical evidence workflow policy passed: manual dedicated runners, exact-source binding, manifest verification, read-only repository authority and independent-review boundary.');
