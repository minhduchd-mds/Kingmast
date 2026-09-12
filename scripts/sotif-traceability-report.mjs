import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));

const registry = json('docs/safety/sotif/V008_TRIGGERING_CONDITION_REGISTRY.json');

const featureEvidence = {
  'front-collision-warning': [
    'services/risk-engine/src/risk.test.ts',
    'services/risk-engine/src/safety-scenarios.test.ts',
    'services/risk-engine/src/sil-replay.test.ts',
    'services/risk-engine/src/sotif-monitor.test.ts',
    'services/risk-engine/src/sotif-assurance.test.ts',
  ],
  'object-awareness': [
    'services/risk-engine/src/edge-fusion.test.ts',
    'services/risk-engine/src/object-alerts.test.ts',
    'services/risk-engine/src/sotif-monitor.test.ts',
    'services/risk-engine/src/sotif-assurance.test.ts',
  ],
  'lane-departure-warning': [
    'services/risk-engine/src/lane-departure.test.ts',
    'services/risk-engine/src/vision-lane-free-space.test.ts',
    'services/risk-engine/src/sotif-monitor.test.ts',
    'services/risk-engine/src/sotif-assurance.test.ts',
  ],
  'navigation-context': [
    'services/risk-engine/src/navigation.test.ts',
    'services/risk-engine/src/road-context.test.ts',
    'services/risk-engine/src/sotif-monitor.test.ts',
    'services/risk-engine/src/sotif-assurance.test.ts',
  ],
};

const classLayers = {
  nominal: ['L0-static-contract', 'L1-unit', 'L3-SIL'],
  boundary: ['L0-static-contract', 'L1-unit', 'L3-SIL', 'L4-HIL', 'L5-controlled-track'],
  'triggering-condition': ['L0-static-contract', 'L1-unit', 'L3-SIL', 'L4-HIL', 'L5-controlled-track'],
  degradation: ['L0-static-contract', 'L1-unit', 'L2-service-integration', 'L3-SIL', 'L4-HIL', 'L5-controlled-track'],
  misuse: ['L0-static-contract', 'L1-unit', 'L2-service-integration', 'L6-independent-review'],
};

function directIdEvidence(paths, scenarioId) {
  return paths.filter((path) => existsSync(resolve(root, path)) && read(path).includes(scenarioId));
}

const cases = registry.scenarios.map((scenario) => {
  const candidates = featureEvidence[scenario.feature] ?? [];
  const missingCandidateFiles = candidates.filter((path) => !existsSync(resolve(root, path)));
  const directScenarioIdMatches = directIdEvidence(candidates, scenario.id);
  const requiredValidationLayers = classLayers[scenario.class] ?? [];

  return {
    testCaseId: `TC-${scenario.id}`,
    scenarioId: scenario.id,
    title: scenario.title,
    feature: scenario.feature,
    category: scenario.category,
    scenarioClass: scenario.class,
    objective: scenario.expected,
    inputs: scenario.inputs,
    expected: scenario.expected,
    hazards: scenario.hazards,
    sourceRefs: scenario.sourceRefs,
    forbiddenClaims: scenario.forbiddenClaims,
    candidateAutomatedEvidence: candidates,
    directScenarioIdEvidence: directScenarioIdMatches,
    directScenarioIdAssertionPresent: directScenarioIdMatches.length > 0,
    missingCandidateFiles,
    requiredValidationLayers,
    physicalEvidenceState: 'pending',
    targetHardwareQualified: false,
    hilQualified: false,
    controlledTrackQualified: false,
    publicRoadApproved: false,
    controlAuthority: 'none',
  };
});

const report = {
  schema: 'kingmast-sotif-test-traceability-report/v1',
  productVersion: registry.productVersion,
  generatedAt: new Date().toISOString(),
  scenarioCount: cases.length,
  candidateMappedCount: cases.filter((item) => item.candidateAutomatedEvidence.length > 0 && item.missingCandidateFiles.length === 0).length,
  directScenarioIdAssertionCount: cases.filter((item) => item.directScenarioIdAssertionPresent).length,
  physicalEvidenceCompleteCount: 0,
  controlAuthority: 'none',
  qualificationClaim: 'traceability-planning-report-only-not-sotif-conformity-or-physical-validation',
  interpretation: {
    candidateAutomatedEvidence: 'Relevant test files are candidate evidence paths. Their presence does not prove that the exact scenario is executed.',
    directScenarioIdEvidence: 'A direct match only means the stable scenario ID is asserted in the named test source; it is stronger traceability but still software evidence.',
    physicalEvidenceState: 'Physical HIL/track evidence remains pending until separately captured and reviewed.',
  },
  cases,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
