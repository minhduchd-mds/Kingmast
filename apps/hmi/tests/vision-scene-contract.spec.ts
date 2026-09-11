import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from '@playwright/test';

const root=process.cwd();
const strip=readFileSync(join(root,'components','VisionSceneStrip.tsx'),'utf8');
const hud=readFileSync(join(root,'components','NextgenIntelligenceHud.tsx'),'utf8');
const css=readFileSync(join(root,'app','hmi-vision-scene.css'),'utf8');

test('vision scene is fresh-only and cannot claim control authority',()=>{
  expect(strip).toContain('scene.freshnessMs>1_200');
  expect(strip).toContain('data-control-authority="none"');
  expect(strip).not.toMatch(/onClick=/);
  expect(strip).not.toMatch(/fetch\(/);
});

test('warning attention suppresses the secondary vision strip',()=>{
  expect(hud).toContain("if(!card)return <VisionSceneStrip");
  expect(css).toContain('body:has(.hmiV5.severity-critical) .visionSceneStrip{display:none}');
});

test('short displays drop the secondary vision strip',()=>{
  expect(css).toContain('@media(max-height:720px){.visionSceneStrip{display:none}}');
});
