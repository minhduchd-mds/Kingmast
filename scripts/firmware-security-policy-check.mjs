import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const configPath='edge/esp32/kingmast_edge/config.example.h';
const firmwarePath='edge/esp32/kingmast_edge/kingmast_edge.ino';
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const config=read(configPath);
const firmware=read(firmwarePath);

if(!config.includes('#define KINGMAST_API_URL "https://'))failures.push('ESP32 example endpoint must remain HTTPS');
if(!config.includes('KINGMAST_TLS_CA_CERT'))failures.push('ESP32 example must provision an explicit gateway CA certificate');
if(/setInsecure\s*\(/.test(firmware))failures.push('ESP32 firmware must never disable TLS certificate validation');
if(!/setCACert\s*\(\s*KINGMAST_TLS_CA_CERT\s*\)/.test(firmware))failures.push('ESP32 firmware must validate the gateway certificate chain');
if(/#define\s+WIFI_PASSWORD\s+"(?!YOUR_WIFI_PASSWORD")(?=.{8,}")/.test(config))failures.push('config.example.h must not contain a real Wi-Fi password');
if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(config+firmware))failures.push('private keys must never be committed in ESP32 source/config examples');
if(/http:\/\//i.test(config+firmware))failures.push('ESP32 production telemetry source must not contain plaintext HTTP endpoints');
if(!firmware.includes('secureConfigurationValid()'))failures.push('ESP32 firmware must fail closed on insecure/placeholder configuration');
if(!firmware.includes('epochMillis()')||!firmware.includes('syncClock()'))failures.push('ESP32 publisher must keep explicit clock synchronization/fresh timestamp support');

if(failures.length){console.error('KINGMAST firmware security policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST firmware security policy passed.');
