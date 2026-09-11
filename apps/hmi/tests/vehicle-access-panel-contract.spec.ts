import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from '@playwright/test';

const component=readFileSync(join(process.cwd(),'components/VehicleAccessPanel.tsx'),'utf8');
const layout=readFileSync(join(process.cwd(),'app/layout.tsx'),'utf8');

test('vehicle access summary mounts only behind parked and active-profile gates',()=>{
  expect(layout).toContain("import VehicleAccessPanel");
  expect(layout).toContain('<VehicleAccessPanel/>');
  expect(component).toContain('speedKmh<=PARKED_MAX_KMH');
  expect(component).toContain('snapshot?.activeProfileId');
  expect(component).toContain('fetchVehicleAccessGrants(vehicleId');
});

test('cockpit access summary stays read-only and has no actuator authority',()=>{
  expect(component).toContain('data-control-authority="none"');
  expect(component).not.toContain('revokeVehicleAccessGrant');
  expect(component).not.toMatch(/onClick=/);
  expect(component).not.toMatch(/brake|steer|throttle|gear/i);
});
