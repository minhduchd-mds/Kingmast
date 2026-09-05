import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillsRoot = path.join(root, '.claude', 'skills');
const expected = [
  'kingmast-safety',
  'kingmast-hmi-uiux',
  'kingmast-backend',
  'kingmast-adas-runtime',
  'kingmast-hardware-esp32',
  'kingmast-security',
  'kingmast-quality',
  'kingmast-architecture',
  'kingmast-research',
  'kingmast-release',
];

const fail = (message) => {
  console.error(`SKILL CONTRACT FAIL: ${message}`);
  process.exitCode = 1;
};

for (const required of ['CLAUDE.md', 'AGENTS.md']) {
  if (!fs.existsSync(path.join(root, required))) fail(`${required} is missing`);
}

if (!fs.existsSync(skillsRoot)) {
  fail('.claude/skills is missing');
} else {
  const dirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of expected) {
    if (!dirs.includes(name)) fail(`required skill ${name} is missing`);
  }

  for (const dir of dirs) {
    const file = path.join(skillsRoot, dir, 'SKILL.md');
    if (!fs.existsSync(file)) {
      fail(`${dir}/SKILL.md is missing`);
      continue;
    }

    const text = fs.readFileSync(file, 'utf8');
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter) {
      fail(`${dir}: YAML frontmatter is missing`);
      continue;
    }

    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (name !== dir) fail(`${dir}: frontmatter name must match directory name`);
    if (!description || description.length < 40) fail(`${dir}: description is missing or too vague`);
    if (!text.includes('## Workflow')) fail(`${dir}: Workflow section is required`);
  }

  const safety = fs.readFileSync(path.join(skillsRoot, 'kingmast-safety', 'SKILL.md'), 'utf8');
  for (const token of ['SAE Level 0', 'no steering', 'brake', 'throttle', 'CAN-write', 'fail-closed']) {
    if (!safety.toLowerCase().includes(token.toLowerCase())) fail(`kingmast-safety must preserve ${token}`);
  }

  const release = fs.readFileSync(path.join(skillsRoot, 'kingmast-release', 'SKILL.md'), 'utf8');
  if (!/^disable-model-invocation:\s*true$/m.test(release)) {
    fail('kingmast-release must remain explicitly user-invoked because it has side effects');
  }
}

if (!process.exitCode) {
  console.log(`KINGMAST agent skill contracts passed: ${expected.length} required skills validated.`);
}
