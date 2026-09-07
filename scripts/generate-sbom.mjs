import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const rootPackage=JSON.parse(readFileSync('package.json','utf8'));
const workspaceOutput=execFileSync('pnpm',['-r','list','--prod','--depth','Infinity','--json'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
const workspaces=JSON.parse(workspaceOutput);
const components=new Map();

function addDependencies(record){
  if(!record||typeof record!=='object')return;
  for(const section of ['dependencies','optionalDependencies']){
    const deps=record[section];
    if(!deps||typeof deps!=='object')continue;
    for(const [name,value] of Object.entries(deps)){
      if(!value||typeof value!=='object')continue;
      const version=typeof value.version==='string'?value.version:'';
      if(version){
        const key=`${name}@${version}`;
        if(!components.has(key))components.set(key,{type:'library',name,version,purl:`pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`});
      }
      addDependencies(value);
    }
  }
}
for(const workspace of workspaces)addDependencies(workspace);

const bom={
  bomFormat:'CycloneDX',
  specVersion:'1.5',
  serialNumber:`urn:uuid:${crypto.randomUUID()}`,
  version:1,
  metadata:{
    timestamp:new Date().toISOString(),
    tools:{components:[{type:'application',name:'KINGMAST pnpm SBOM generator',version:'1'}]},
    component:{type:'application',name:rootPackage.name??'kingmast',version:rootPackage.version??'0.0.0'},
    properties:[
      {name:'kingmast:scope',value:'production-dependencies'},
      {name:'kingmast:authority',value:'warning-only-level-0'},
    ],
  },
  components:[...components.values()].sort((a,b)=>`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)),
};
process.stdout.write(`${JSON.stringify(bom,null,2)}\n`);
