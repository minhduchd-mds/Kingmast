import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from '@playwright/test';

const hud=readFileSync(join(process.cwd(),'components','NextgenIntelligenceHud.tsx'),'utf8');
const page=readFileSync(join(process.cwd(),'app','page.tsx'),'utf8');

test('main HMI mounts the nextgen intelligence HUD',()=>{
  expect(page).toContain("import NextgenIntelligenceHud");
  expect(page).toContain('<NextgenIntelligenceHud/>');
});

test('nextgen HUD only interrupts for caution or critical states',()=>{
  expect(hud).toContain("item.tone==='critical'||item.tone==='caution'");
  expect(hud).toContain("data-attention={critical?'critical':'transient'}");
});

test('nextgen HUD remains advisory-only and exposes no vehicle-control action',()=>{
  expect(hud).toContain("'chỉ khuyến cáo'");
  expect(hud).not.toMatch(/onClick=.*(brake|steer|throttle|gear)/i);
  expect(hud).not.toMatch(/fetch\([^\n]*(brake|steer|throttle|gear)/i);
});
