import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const cockpit = readFileSync(join(process.cwd(), 'components', 'KingmastCockpitUltra.tsx'), 'utf8');
const interactions = readFileSync(join(process.cwd(), 'components', 'KingmastCockpitInteractions.module.css'), 'utf8');

test('sidebar navigation renders real workspaces and URL state', () => {
  expect(cockpit).toContain('WorkspacePanel');
  expect(cockpit).toContain("url.searchParams.set('view', key)");
  expect(cockpit).toContain("data-testid={`workspace-${nav}`}");
  expect(cockpit).toContain("nav === 'drive' ? <KingmastDriveScene");
});

test('cockpit has one assistant entry point and voice opens the global assistant', () => {
  expect(cockpit).toContain("window.dispatchEvent(new Event('kingmast:assistant-open'))");
  expect(cockpit).not.toContain('className={styles.aiButton}');
});

test('SOS is interactive but stays prototype-only', () => {
  expect(cockpit).toContain('setSosOpen(true)');
  expect(cockpit).toContain('SOS · Chế độ thử nghiệm');
  expect(cockpit).toContain('không có cuộc gọi thực tế');
  expect(interactions).toContain('.sosBackdrop');
  expect(interactions).toContain('.sosDialog');
});
