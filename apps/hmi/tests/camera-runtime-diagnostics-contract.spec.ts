import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from '@playwright/test';

const component=readFileSync(join(process.cwd(),'components/CameraRuntimeDiagnosticsPanel.tsx'),'utf8');
const css=readFileSync(join(process.cwd(),'app/hmi-camera-runtime.css'),'utf8');
const layout=readFileSync(join(process.cwd(),'app/layout.tsx'),'utf8');

test('camera runtime diagnostics is mounted but gated to parked telemetry',()=>{
  expect(layout).toContain("import './hmi-camera-runtime.css'");
  expect(layout).toContain('CameraRuntimeDiagnosticsPanel');
  expect(component).toContain('speedKmh<=PARKED_MAX_KMH');
  expect(component).toContain('if(!parked||cameras.length===0)return null');
});

test('camera diagnostics stays read-only and yields to critical driving attention',()=>{
  expect(component).toContain('data-control-authority="none"');
  expect(component).not.toMatch(/onClick=/);
  expect(component).not.toMatch(/fetch\(|POST|PUT|DELETE/);
  expect(css).toContain('body:has(.hmiV5.severity-critical) .cameraRuntimeDiagnostics');
  expect(css).toContain('@media(max-height:760px)');
});
