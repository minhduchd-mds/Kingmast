import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const registry = JSON.parse(readFileSync(resolve(root, 'docs/safety/sotif/V008_TRIGGERING_CONDITION_REGISTRY.json'), 'utf8'));
const operatingDomain = JSON.parse(readFileSync(resolve(root, 'docs/safety/sotif/V008_RESEARCH_OPERATING_DOMAIN.json'), 'utf8'));
const args = process.argv.slice(2);
const json = args.includes('--json');
const all = args.includes('--all');
const requested = args.find((arg) => !arg.startsWith('--')) ?? null;

function bridgeScenario(scenario) {
  return {
    schema: 'kingmast-sotif-openx-bridge-manifest/v1',
    productVersion: registry.productVersion,
    scenarioId: scenario.id,
    title: scenario.title,
    feature: scenario.feature,
    category: scenario.category,
    scenarioClass: scenario.class,
    trigger: scenario.trigger,
    inputs: scenario.inputs,
    expected: scenario.expected,
    hazards: scenario.hazards,
    sourceRefs: scenario.sourceRefs,
    forbiddenClaims: scenario.forbiddenClaims,
    controlAuthority: 'none',
    qualificationClaim: 'openx-bridge-draft-only-not-asam-conformance-or-physical-validation',
    targetFormats: {
      openOdd: {
        version: '1.0.0',
        scope: 'operating-domain-context',
        mappingStatus: 'conceptual-only-not-schema-validated',
      },
      openScenarioXml: {
        version: '1.4.0',
        scope: 'dynamic-scenario-description',
        mappingStatus: 'bridge-manifest-only-no-xosc-schema-claim',
      },
    },
    operatingDomain: {
      profileId: operatingDomain.profileId,
      sourceSchema: operatingDomain.schema,
      physicalValidationStatus: operatingDomain.physicalValidation.status,
      validatedSpeedRangeKmh: operatingDomain.physicalValidation.validatedSpeedRangeKmh,
      maxValidatedGnssAccuracyM: operatingDomain.physicalValidation.maxValidatedGnssAccuracyM,
      publicRoadApproved: operatingDomain.physicalValidation.publicRoadApproved,
    },
    dynamicIntent: {
      actors: scenario.category === 'vulnerable-road-user'
        ? ['ego-vehicle', 'vulnerable-road-user']
        : ['ego-vehicle', 'conflict-object-or-context'],
      trigger: scenario.trigger,
      expectedAdvisoryBehavior: scenario.expected,
      actuatorAuthority: 'none',
    },
    conformance: {
      openOddSchemaValidated: false,
      openScenarioXmlSchemaValidated: false,
      asamConformant: false,
      externalSimulatorExecuted: false,
      physicalHilExecuted: false,
      controlledTrackExecuted: false,
    },
    exportRules: {
      preserveScenarioId: true,
      preserveHazardTraceability: true,
      preserveSourceTraceability: true,
      preserveForbiddenClaims: true,
      preserveWarningOnlyAuthority: true,
      requireHumanReviewBeforeExternalExecution: true,
    },
    limitations: [
      'This bridge manifest is not an ASAM OpenODD document and is not an ASAM OpenSCENARIO XML .xosc document.',
      'A future concrete exporter must validate generated artifacts against the official selected ASAM schemas before any conformance statement.',
      'Simulation does not satisfy HIL, target-hardware, controlled-track, homologation or public-road evidence requirements.',
      'Numeric physical-performance limits remain absent until separately evidenced on production-intent hardware.',
    ],
  };
}

const selected = all
  ? registry.scenarios
  : requested
    ? registry.scenarios.filter((scenario) => scenario.id === requested)
    : [registry.scenarios[0]].filter(Boolean);

if (requested && selected.length === 0) throw new Error(`unknown SOTIF scenario id: ${requested}`);

const manifests = selected.map(bridgeScenario);
const report = {
  schema: 'kingmast-sotif-openx-bridge-report/v1',
  generatedAt: new Date().toISOString(),
  productVersion: registry.productVersion,
  scenarioCount: manifests.length,
  targetVersions: { openOdd: '1.0.0', openScenarioXml: '1.4.0' },
  openOddSchemaValidated: false,
  openScenarioXmlSchemaValidated: false,
  asamConformant: false,
  physicalHilExecuted: false,
  controlledTrackExecuted: false,
  publicRoadApproved: false,
  controlAuthority: 'none',
  qualificationClaim: 'openx-bridge-draft-only-not-asam-conformance-or-physical-validation',
  manifests,
};

if (json) console.log(JSON.stringify(report, null, 2));
else console.log(`[sotif-openx] scenarios=${report.scenarioCount}; OpenODD=${report.targetVersions.openOdd}; OpenSCENARIO XML=${report.targetVersions.openScenarioXml}; schema-validated=false; physical-validation=false`);
