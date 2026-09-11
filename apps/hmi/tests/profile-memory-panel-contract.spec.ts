import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from '@playwright/test';

const component=readFileSync(join(process.cwd(),'components/ProfileMemoryPanel.tsx'),'utf8');
const layout=readFileSync(join(process.cwd(),'app/layout.tsx'),'utf8');

test('profile memory is mounted as a parked-only read surface',()=>{
  expect(layout).toContain("import ProfileMemoryPanel");
  expect(layout).toContain('<ProfileMemoryPanel/>');
  expect(component).toContain('speedKmh<=PARKED_MAX_KMH');
  expect(component).toContain('snapshot?.activeProfileId');
  expect(component).toContain('fetchProfileMemory(profileId');
});

test('profile memory never grants vehicle control or writes identity from the browser',()=>{
  expect(component).toContain('data-control-authority="none"');
  expect(component).not.toMatch(/method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i);
  expect(component).not.toMatch(/onClick=/);
  expect(component).not.toMatch(/faceProfileId|trustedDeviceId/);
});
