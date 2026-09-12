import {readFileSync} from 'node:fs';

const policy=JSON.parse(readFileSync('deploy/security/vehicle-security-zones.json','utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(policy.schema==='kingmast-vehicle-security-zones/v1','unexpected vehicle security zone schema');
expect(policy.controlAuthority==='none','vehicle security policy must preserve zero control authority');
expect(policy.defaultTrust==='deny','default trust must remain deny');
expect(policy.internetInboundToVehicle===false,'Internet inbound to vehicle must remain disabled');
expect(policy.cloudInImmediateWarningPath===false,'cloud must not enter immediate warning path');
expect(policy.hardwareBoundaryRequired===true,'hardware vehicle boundary must remain mandatory');
expect(policy.softwareIsolationAloneIsSufficient===false,'software isolation alone must never be treated as sufficient');

const zones=new Map((Array.isArray(policy.zones)?policy.zones:[]).map((zone)=>[zone.id,zone]));
for(const required of ['external-internet','cloud-context','hmi','risk-engine','sensor-gateway','oem-vehicle'])expect(zones.has(required),`missing required zone ${required}`);

for(const id of ['external-internet','cloud-context','hmi','risk-engine','sensor-gateway','oem-vehicle']){
  const zone=zones.get(id);
  if(zone)expect(zone.actuatorAuthority==='none',`${id} must have actuatorAuthority=none`);
}

const hmi=zones.get('hmi');
expect(hmi?.runtimeUser==='kingmast-hmi','HMI must use dedicated runtime user');
expect(hmi?.listen==='127.0.0.1:3000','HMI must remain loopback-bound');
expect(hmi?.vehicleDeviceAccess==='none','HMI must not access vehicle devices');
expect(Array.isArray(hmi?.linuxCapabilities)&&hmi.linuxCapabilities.length===0,'HMI Linux capability set must remain empty');

const risk=zones.get('risk-engine');
expect(risk?.runtimeUser==='kingmast-risk','risk engine must use dedicated runtime user');
expect(risk?.listen==='127.0.0.1:4000','risk engine must remain loopback-bound');
expect(risk?.vehicleDeviceAccess==='none','risk engine must not access vehicle devices');
expect(Array.isArray(risk?.linuxCapabilities)&&risk.linuxCapabilities.length===0,'risk-engine Linux capability set must remain empty');

const gateway=zones.get('sensor-gateway');
expect(gateway?.internetReachable===false,'sensor gateway must not be Internet reachable');
expect(gateway?.vehicleBusAuthority==='receive-only','sensor gateway vehicle bus authority must remain receive-only');

const vehicle=zones.get('oem-vehicle');
expect(vehicle?.internetReachable===false,'OEM vehicle zone must not be Internet reachable');
expect(vehicle?.canTxEnabled===false,'KINGMAST vehicle boundary must keep CAN TX disabled');
expect(vehicle?.requiredTransceiverMode==='listen-only-or-physically-tx-disabled','vehicle transceiver must remain listen-only or physically TX-disabled');

const flows=Array.isArray(policy.flows)?policy.flows:[];
const flow=(from,to)=>flows.find((item)=>item.from===from&&item.to===to)?.policy;
expect(flow('sensor-gateway','oem-vehicle')==='deny','sensor gateway must have no write flow to OEM vehicle');
expect(flow('hmi','oem-vehicle')==='deny','HMI must have no flow to OEM vehicle');
expect(flow('risk-engine','oem-vehicle')==='deny','risk engine must have no flow to OEM vehicle');
expect(flow('cloud-context','oem-vehicle')==='deny','cloud context must have no flow to OEM vehicle');
expect(flow('oem-vehicle','sensor-gateway')==='receive-only-telemetry','OEM vehicle data flow must remain receive-only telemetry');

if(failures.length){
  console.error(`KINGMAST vehicle security-zone policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('KINGMAST vehicle security-zone policy passed: Internet/cloud/HMI/risk remain unable to obtain vehicle control authority and CAN TX stays disabled by policy.');
