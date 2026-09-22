import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_DELTA_TRIGGERS,
  FRESH_RESEARCH_JUSTIFICATIONS,
  GATE_DECISIONS,
  MATURE_REFERENCE_MATRIX_FIELDS,
  OPENKORE_INCUMBENT_CATEGORIES,
  REUSE_GATE_EXEMPT_CATEGORIES,
  REUSE_GATE_FAILURE_CODES,
  REUSE_GATE_REQUIRED_CATEGORIES,
  RESEARCH_INVALIDATION_RULES,
  evaluateReuseGate,
  isOpenKoreRelevant,
  normalizeCategory,
} from '../../.agents/skills/external-ecosystem-reuse/scripts/reuse-gate.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

type Json = Record<string, unknown>;

const fullChecks = (): Record<string, Json> => ({
  currentProject: {
    status: 'CHECKED',
    evidence: 'src/map/persistent_agent.cpp: gate3 executor',
  },
  legacyProject: {
    status: 'CHECKED',
    evidence: 'docs/openkore-exit-source-of-truth.md',
  },
  reuseRegistry: {
    status: 'CHECKED',
    evidence: 'ops/research/external-reuse-registry.json',
  },
  rAthena: {
    status: 'CHECKED',
    evidence: 'rathena map.hpp iterator',
  },
  openKore: { status: 'NOT_APPLICABLE', reason: 'not an OpenKore capability' },
  externalEcosystem: {
    status: 'NOT_APPLICABLE',
    reason: 'no external component required',
  },
  genericOSS: {
    status: 'NOT_APPLICABLE',
    reason: 'no third-party dependency required',
  },
});

const withChecks = (
  patch: (checks: Record<string, Json>) => void,
): Record<string, Json> => {
  const checks = fullChecks();
  patch(checks);
  return checks;
};

const baseGate = (overrides: Json = {}): Json => ({
  featureId: 'test-feature',
  featureName: 'Test Feature',
  scope: 'NEW_CAPABILITY',
  taskCategory: 'NEW_CAPABILITY',
  checks: fullChecks(),
  decision: 'ALREADY_EXISTS',
  whyNotReuse: '',
  freshResearchPerformed: false,
  registryUpdateRequired: false,
  capabilityScope: 'test mature capability surface',
  matureReferenceApplicable: true,
  referenceGate: 'PASS',
  deltaReferenceAuditRequired: true,
  matureReferenceMatrix: matureReferenceMatrix(),
  ...overrides,
});

const wrap = (gate: Json | null, extra: Json = {}): Json =>
  gate === null
    ? { taskCategory: 'NEW_CAPABILITY', ...extra }
    : { PRE_IMPLEMENTATION_REUSE_GATE: gate, ...extra };

const openKoreChecked = (): Record<string, Json> =>
  withChecks((checks) => {
    checks.openKore = {
      status: 'CHECKED',
      evidence: 'docs/openkore-harvest-registry.md#A3 FollowActor',
    };
  });

const matureReferenceMatrix = (): Json => ({
  currentGiCapability: 'existing Ghost Island capability and parent contract',
  openKoreCapability: 'OpenKore mature behavior or NOT_APPLICABLE with reason',
  rAthenaCapability: 'rAthena authoritative primitive or data contract',
  otherMatureReference: 'NOT_APPLICABLE: no additional source required',
  matureExceptionBehavior: 'exceptions preserved by bounded policy',
  matureRecoveryBehavior: 'retry, resume and failure behavior preserved',
  matureConfigSemantics: 'configuration meanings preserved',
  matureUiSemantics: 'visible control semantics preserved',
  directReuse: 'reuse current project and native primitives',
  adapt: 'adapter owns transport and projection differences',
  projectPolicy: 'Ghost Island authority and product policy remain canonical',
  improvements: 'no regression; bounded observability improvement only',
  matureCapabilityLoss: 'NONE',
  resultEquivalentOrBetter: 'PASS',
});

describe('reuse gate — scope classification (Phase 14)', () => {
  it('A: new subsystem with no gate fails REUSE_GATE_MISSING', () => {
    const result = evaluateReuseGate({ taskCategory: 'NEW_SUBSYSTEM' });
    expect(result.passed).toBe(false);
    expect(result.gateRequired).toBe(true);
    expect(result.failureCodes).toContain('REUSE_GATE_MISSING');
  });

  it('J: ordinary bugfix / typo / maintenance does not require the gate', () => {
    for (const category of ['BUG_FIX', 'TYPO_FIX', 'MAINTENANCE', 'TEST_ONLY', 'DOC_ONLY']) {
      const result = evaluateReuseGate({ taskCategory: category });
      expect(result.passed).toBe(true);
      expect(result.gateRequired).toBe(false);
      expect(result.gateMode).toBe('EXEMPT');
    }
  });

  it('Example 3: unrelated web CSS bugfix needs no reuse gate', () => {
    const result = evaluateReuseGate({
      taskCategory: 'BUG_FIX',
      featureName: 'web css margin fix',
    });
    expect(result.passed).toBe(true);
    expect(result.gateRequired).toBe(false);
  });

  it('unknown or missing category fails closed', () => {
    expect(evaluateReuseGate({}).failureCodes).toContain('TASK_CATEGORY_UNKNOWN');
    expect(
      evaluateReuseGate({ taskCategory: 'SOMETHING_NEW' }).failureCodes,
    ).toContain('TASK_CATEGORY_UNKNOWN');
  });

  it('every gated category requires a gate', () => {
    for (const category of REUSE_GATE_REQUIRED_CATEGORIES) {
      const result = evaluateReuseGate({ taskCategory: category });
      expect(result.gateRequired).toBe(true);
      expect(result.failureCodes).toContain('REUSE_GATE_MISSING');
    }
  });

  it('exempt list and normalizeCategory stay stable', () => {
    expect(REUSE_GATE_EXEMPT_CATEGORIES).toContain('BUG_FIX');
    expect(normalizeCategory(' new capability ')).toBe('NEW_CAPABILITY');
    expect(normalizeCategory('new-capability')).toBe('NEW_CAPABILITY');
  });
});

describe('reuse gate — fail-closed evaluation (Phase 5, 6)', () => {
  it('B: gate exists but decision is missing fails REUSE_DECISION_MISSING', () => {
    const result = evaluateReuseGate(
      wrap(baseGate({ decision: '' })),
    );
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('REUSE_DECISION_MISSING');
  });

  it('unknown decision fails REUSE_DECISION_MISSING', () => {
    const result = evaluateReuseGate(wrap(baseGate({ decision: 'DO_IT_LIVE' })));
    expect(result.failureCodes).toContain('REUSE_DECISION_MISSING');
  });

  it('C: BUILD_NEW with empty whyNotReuse fails', () => {
    const result = evaluateReuseGate(
      wrap(baseGate({ decision: 'BUILD_NEW', whyNotReuse: '' })),
    );
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('BUILD_NEW_WITHOUT_WHY_NOT_REUSE');
  });

  it('BUILD_NEW with a rationale passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'BUILD_NEW',
          whyNotReuse:
            'current project has no equivalent; registry has no candidate; license resolved in-house',
          registryUpdateRequired: true,
          registryUpdate: {
            status: 'UPDATED',
            entryId: 'gen-new-algo',
            evidence: 'ops/research/external-reuse-registry.json#gen-new-algo',
          },
        }),
      ),
    );
    expect(result.passed).toBe(true);
  });

  it('existing capability found without rationale fails EXISTING_CAPABILITY_IGNORED', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'BUILD_NEW',
          whyNotReuse: '',
          checks: withChecks((checks) => {
            checks.currentProject = {
              status: 'CHECKED',
              evidence: 'src/map/persistent_agent.cpp',
              implementationFound: 'YES',
            };
          }),
        }),
      ),
    );
    expect(result.failureCodes).toContain('EXISTING_CAPABILITY_IGNORED');
    expect(result.failureCodes).not.toContain('BUILD_NEW_WITHOUT_WHY_NOT_REUSE');
  });

  it('required check left RESEARCH_REQUIRED fails REQUIRED_CHECK_INCOMPLETE', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          checks: withChecks((checks) => {
            checks.rAthena = { status: 'RESEARCH_REQUIRED' };
          }),
        }),
      ),
    );
    expect(result.failureCodes).toContain('REQUIRED_CHECK_INCOMPLETE');
  });

  it('NOT_APPLICABLE without a reason fails; with a reason passes (I)', () => {
    const missingReason = evaluateReuseGate(
      wrap(
        baseGate({
          checks: withChecks((checks) => {
            checks.externalEcosystem = { status: 'NOT_APPLICABLE' };
          }),
        }),
      ),
    );
    expect(missingReason.failureCodes).toContain('REQUIRED_CHECK_INCOMPLETE');

    const withReason = evaluateReuseGate(
      wrap(baseGate({ decision: 'REFERENCE_ONLY' })),
    );
    expect(withReason.passed).toBe(true);
  });
});

describe('reuse gate — OpenKore incumbent rule (Phase 7, 16)', () => {
  it('covers the required OpenKore incumbent categories', () => {
    for (const category of [
      'navigation',
      'routing',
      'combat',
      'target selection',
      'skills',
      'loot',
      'inventory',
      'equipment',
      'npc',
      'dialog',
      'quest',
      'supply',
      'buy/sell/storage',
      'death/respawn',
      'party',
      'follow',
      'reconnect',
      'automation',
      'policy',
      'timeout/retry',
      'failure recovery',
      'observability',
      'status export',
      'task scheduling',
    ]) {
      expect(OPENKORE_INCUMBENT_CATEGORIES).toContain(
        normalizeCategory(category).toLowerCase(),
      );
    }
  });

  it('D: OpenKore-relevant capability without an OpenKore check fails', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          categories: ['navigation'],
          checks: withChecks((checks) => {
            delete checks.openKore;
          }),
        }),
      ),
    );
    expect(result.openKoreRelevant).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('OPENKORE_REUSE_CHECK_MISSING');
  });

  it('E: OpenKore census/harvest checked first passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          categories: ['navigation'],
          checks: openKoreChecked(),
          decision: 'REIMPLEMENT_FROM_BEHAVIOR',
          whyNotReuse: 'OpenKore route planner is behavior contract only',
        }),
      ),
    );
    expect(result.openKoreRelevant).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('OpenKore-relevant NOT_APPLICABLE is not accepted', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          openKoreRelevant: true,
          checks: withChecks((checks) => {
            checks.openKore = {
              status: 'NOT_APPLICABLE',
              reason: 'we will just rebuild it',
            };
          }),
        }),
      ),
    );
    expect(result.failureCodes).toContain('OPENKORE_REUSE_CHECK_MISSING');
  });

  it('explicit openKoreRelevant=false is respected', () => {
    expect(isOpenKoreRelevant({}, { openKoreRelevant: false })).toBe(false);
    expect(isOpenKoreRelevant({}, { openKoreRelevant: true })).toBe(true);
  });
});

describe('reuse gate — decisions and registry behavior (Phase 4, 9)', () => {
  it('F: ALREADY_EXISTS with current-project evidence passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'ALREADY_EXISTS',
          checks: withChecks((checks) => {
            checks.currentProject = {
              status: 'CHECKED',
              evidence: 'src/map/persistent_agent.cpp supply cycle exists',
              implementationFound: 'YES',
            };
          }),
        }),
      ),
    );
    expect(result.passed).toBe(true);
  });

  it('G: DIRECT_REUSE on a registry hit passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'DIRECT_REUSE',
          checks: withChecks((checks) => {
            checks.reuseRegistry = {
              status: 'REGISTRY_HIT',
              reference: 'ra-map-iteration (rating A)',
            };
          }),
        }),
      ),
    );
    expect(result.passed).toBe(true);
  });

  it('decision taxonomy is exactly the approved set', () => {
    expect(GATE_DECISIONS).toEqual([
      'DIRECT_REUSE',
      'PORTABLE_LOGIC',
      'REIMPLEMENT_FROM_BEHAVIOR',
      'REFERENCE_ONLY',
      'BUILD_NEW',
      'ALREADY_EXISTS',
    ]);
  });

  it('H: fresh research without registry write-back evidence fails', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'REFERENCE_ONLY',
          freshResearchPerformed: true,
          registryUpdateRequired: true,
        }),
      ),
    );
    expect(result.failureCodes).toContain('REGISTRY_UPDATE_MISSING');
  });

  it('fresh research with UPDATED write-back passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'REFERENCE_ONLY',
          freshResearchPerformed: true,
          registryUpdateRequired: true,
          registryUpdate: {
            status: 'UPDATED',
            entryId: 'gen-pino',
            evidence: 'ops/research/external-reuse-registry.json#gen-pino',
          },
        }),
      ),
    );
    expect(result.passed).toBe(true);
  });

  it('fresh research with NO_CHANGE evidence passes', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'DIRECT_REUSE',
          freshResearchPerformed: true,
          registryUpdateRequired: true,
          registryUpdate: {
            status: 'NO_CHANGE',
            entryId: 'ra-map-iteration',
            evidence: 're-verified 2026-09-17; entry unchanged',
          },
        }),
      ),
    );
    expect(result.passed).toBe(true);
  });
});

describe('reuse gate — redundant research and loops (Phase 10, 15)', () => {
  it('registry hit plus redundant research without justification fails', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'DIRECT_REUSE',
          freshResearchPerformed: true,
          registryUpdateRequired: true,
          registryUpdate: {
            status: 'UPDATED',
            evidence: 'x',
          },
          checks: withChecks((checks) => {
            checks.reuseRegistry = {
              status: 'REGISTRY_HIT',
              reference: 'ra-map-iteration',
            };
          }),
        }),
      ),
    );
    expect(result.failureCodes).toContain(
      'REDUNDANT_RESEARCH_WITHOUT_JUSTIFICATION',
    );
  });

  it('registry hit plus justified fresh research is allowed', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          decision: 'DIRECT_REUSE',
          freshResearchPerformed: true,
          freshResearchJustification: 'STALE',
          registryUpdateRequired: true,
          registryUpdate: { status: 'UPDATED', evidence: 'refreshed entry' },
          checks: withChecks((checks) => {
            checks.reuseRegistry = {
              status: 'REGISTRY_HIT',
              reference: 'ra-map-iteration',
            };
          }),
        }),
      ),
    );
    expect(result.passed).toBe(true);
    expect(FRESH_RESEARCH_JUSTIFICATIONS).toContain('STALE');
  });

  it('discovery stall fails closed', () => {
    const result = evaluateReuseGate(
      wrap(baseGate({ researchStalled: true })),
    );
    expect(result.failureCodes).toContain('DISCOVERY_STALLED');
  });

  it('research invalidation rules are enumerated', () => {
    expect(RESEARCH_INVALIDATION_RULES).toEqual(
      expect.arrayContaining([
        'UPSTREAM_VERSION_CHANGED',
        'PROJECT_REQUIREMENT_CHANGED',
        'LICENSE_STATUS_UNRESOLVED',
        'INTEGRATION_IMMINENT',
        'EVIDENCE_TOO_SHALLOW',
        'REGISTRY_TOO_OLD_FOR_FAST_MOVING_DEPENDENCY',
      ]),
    );
  });

  it('exposes a stable failure-code catalogue', () => {
    expect(Object.keys(REUSE_GATE_FAILURE_CODES)).toEqual(
      expect.arrayContaining([
        'REUSE_GATE_MISSING',
        'REUSE_DECISION_MISSING',
        'BUILD_NEW_WITHOUT_WHY_NOT_REUSE',
        'OPENKORE_REUSE_CHECK_MISSING',
        'EXISTING_CAPABILITY_IGNORED',
        'REDUNDANT_RESEARCH_WITHOUT_JUSTIFICATION',
        'REQUIRED_CHECK_INCOMPLETE',
        'REGISTRY_UPDATE_MISSING',
        'REUSE_GATE_INHERITANCE_MISSING',
        'REUSE_GATE_INHERITANCE_SCOPE_UNPROVEN',
        'CAPABILITY_DELTA_AUDIT_MISSING',
        'MATURE_REFERENCE_MATRIX_INCOMPLETE',
        'MATURE_CAPABILITY_LOSS',
        'RESULT_NOT_EQUIVALENT_OR_BETTER',
        'TASK_CATEGORY_UNKNOWN',
        'DISCOVERY_STALLED',
      ]),
    );
  });
});

describe('reuse gate — inheritance (Phase 14)', () => {
  it('25: known implementation slice inherits the parent gate', () => {
    const result = evaluateReuseGate({
      taskCategory: 'KNOWN_IMPLEMENTATION_TASK',
      REUSE_GATE_INHERITED_FROM: 'res-life-party-follow-gate-v1',
      SAME_CAPABILITY_SCOPE: 'YES',
      REFERENCE_COVERAGE_STILL_COMPLETE: 'YES',
      NO_NEW_CAPABILITY_SURFACE: 'YES',
      CAPABILITY_SCOPE: 'same approved party-follow implementation slice',
      MATURE_REFERENCE_APPLICABLE: 'NO',
      REFERENCE_GATE: 'INHERITED_PASS',
      DELTA_REFERENCE_AUDIT_REQUIRED: 'NO',
    });
    expect(result.passed).toBe(true);
    expect(result.gateRequired).toBe(true);
    expect(result.gateMode).toBe('INHERITED');
  });

  it('KNOWN_IMPLEMENTATION_TASK without inheritance fails', () => {
    const result = evaluateReuseGate({
      taskCategory: 'KNOWN_IMPLEMENTATION_TASK',
    });
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('REUSE_GATE_INHERITANCE_MISSING');
  });

  it('scope expansion cannot inherit without a delta audit', () => {
    const result = evaluateReuseGate({
      taskCategory: 'KNOWN_IMPLEMENTATION_TASK',
      REUSE_GATE_INHERITED_FROM: 'navigation-parent-v1',
      SAME_CAPABILITY_SCOPE: 'NO',
      REFERENCE_COVERAGE_STILL_COMPLETE: 'NO',
      NO_NEW_CAPABILITY_SURFACE: 'NO',
      DELTA_REFERENCE_AUDIT_REQUIRED: 'NO',
      changesCapabilityUi: 'YES',
    });
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('CAPABILITY_DELTA_AUDIT_MISSING');
    expect(result.failureCodes).toContain(
      'REUSE_GATE_INHERITANCE_SCOPE_UNPROVEN',
    );
  });
});

describe('mature capability delta gate — automatic historical triggers', () => {
  const deltaGate = (
    featureId: string,
    categories: string[],
    delta: Json,
  ): Json =>
    wrap(
      baseGate({
        featureId,
        taskCategory: 'KNOWN_IMPLEMENTATION_TASK',
        scope: 'KNOWN_IMPLEMENTATION_TASK',
        categories,
        openKoreRelevant: true,
        checks: openKoreChecked(),
        decision: 'PORTABLE_LOGIC',
        inheritedFrom: 'parent-capability-gate-v1',
        sameCapabilityScope: false,
        referenceCoverageStillComplete: false,
        noNewCapabilitySurface: false,
        deltaReferenceAuditRequired: true,
        capabilityDelta: delta,
      }),
    );

  it.each([
    ['Navigation', ['navigation', 'routing'], { changesBehavior: true }],
    ['Minimap original-color replacement', ['minimap', 'capability_ui'], { changesCapabilityUi: true }],
    ['Supply settings UI', ['supply', 'supply_settings', 'configuration_semantics'], { changesConfigurationSemantics: true, changesCapabilityUi: true }],
    ['Combat AutoSkill', ['combat', 'autoskill', 'skills'], { addsCapability: true, changesExceptionRecovery: true }],
    ['Party Support', ['combat', 'party_support', 'party'], { addsCapability: true, changesBehavior: true }],
  ])('%s triggers a bounded delta reference gate', (_name, categories, delta) => {
    const result = evaluateReuseGate(
      deltaGate(String(_name), categories as string[], delta as Json),
    );
    expect(result.passed).toBe(true);
    expect(result.gateMode).toBe('DELTA');
    expect(result.openKoreRelevant).toBe(true);
  });

  it('capability-changing BUG_FIX does not use the exemption', () => {
    const result = evaluateReuseGate({
      taskCategory: 'BUG_FIX',
      changesBehavior: 'YES',
    });
    expect(result.passed).toBe(false);
    expect(result.gateRequired).toBe(true);
    expect(result.failureCodes).toContain('REUSE_GATE_MISSING');
  });

  it('mature capability loss blocks acceptance', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          matureReferenceMatrix: {
            ...matureReferenceMatrix(),
            matureCapabilityLoss: 'OpenKore no-target recovery',
          },
        }),
      ),
    );
    expect(result.passed).toBe(false);
    expect(result.failureCodes).toContain('MATURE_CAPABILITY_LOSS');
  });

  it('UNKNOWN matrix values and non-PASS equivalence fail closed', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          matureReferenceMatrix: {
            ...matureReferenceMatrix(),
            matureUiSemantics: 'UNKNOWN',
            resultEquivalentOrBetter: 'UNKNOWN',
          },
        }),
      ),
    );
    expect(result.failureCodes).toContain('MATURE_REFERENCE_MATRIX_INCOMPLETE');
    expect(result.failureCodes).toContain('RESULT_NOT_EQUIVALENT_OR_BETTER');
  });

  it('publishes stable trigger and matrix field catalogues', () => {
    expect(CAPABILITY_DELTA_TRIGGERS).toContain('changesCapabilityUi');
    expect(CAPABILITY_DELTA_TRIGGERS).toContain('changesExceptionRecovery');
    expect(MATURE_REFERENCE_MATRIX_FIELDS).toContain('matureUiSemantics');
    expect(MATURE_REFERENCE_MATRIX_FIELDS).toContain('matureRecoveryBehavior');
  });
});

describe('reuse gate — sample gates (Phase 17)', () => {
  it('Example 1: world route planner checks Gate3 + rAthena + OpenKore MapRoute', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          featureId: 'world-route-planner',
          featureName: 'World Route Planner',
          scope: 'NEW_CAPABILITY',
          categories: ['navigation', 'routing'],
          checks: withChecks((checks) => {
            checks.currentProject = {
              status: 'CHECKED',
              evidence: 'Gate3 executor cross-map relocation',
            };
            checks.rAthena = {
              status: 'CHECKED',
              evidence: 'native warp data + map path',
            };
            checks.openKore = {
              status: 'CHECKED',
              evidence:
                'docs/openkore-harvest-registry.md MapRoute / CalcMapRoute',
            };
          }),
          decision: 'PORTABLE_LOGIC',
          whyNotReuse: 'port OpenKore route design, keep rAthena authority',
        }),
      ),
    );
    expect(result.passed).toBe(true);
    expect(result.openKoreRelevant).toBe(true);
  });

  it('Example 2: offline party follow checks OpenKore FollowActor first', () => {
    const result = evaluateReuseGate(
      wrap(
        baseGate({
          featureId: 'offline-party-follow',
          featureName: 'Offline Party Follow',
          categories: ['party', 'follow'],
          checks: openKoreChecked(),
          decision: 'REIMPLEMENT_FROM_BEHAVIOR',
          whyNotReuse: 'FollowActor behavior is the contract',
        }),
      ),
    );
    expect(result.passed).toBe(true);
    expect(result.openKoreRelevant).toBe(true);
  });
});

describe('reuse gate — historical navigation miss regression (Phase 18)', () => {
  const navigationGate = (includeOpenKore: boolean): Json =>
    baseGate({
      featureId: 'historical-navigation-miss',
      featureName: 'Cross-map route planner from scratch',
      scope: 'NEW_SUBSYSTEM',
      categories: ['navigation', 'routing'],
      decision: 'REIMPLEMENT_FROM_BEHAVIOR',
      whyNotReuse: 'OpenKore planner is behavior spec',
      checks: includeOpenKore
        ? openKoreChecked()
        : withChecks((checks) => {
            delete checks.openKore;
          }),
    });

  it('HISTORICAL_NAVIGATION_MISS_REGRESSION = PASS (fail then pass)', () => {
    const before = evaluateReuseGate(
      wrap(navigationGate(false)),
    );
    expect(before.passed).toBe(false);
    expect(before.failureCodes).toContain('OPENKORE_REUSE_CHECK_MISSING');

    const after = evaluateReuseGate(wrap(navigationGate(true)));
    expect(after.passed).toBe(true);
    expect(after.failureCodes).toEqual([]);
  });
});

describe('reuse gate — governance integration', () => {
  const read = (relative: string): string =>
    fs.readFileSync(path.join(repoRoot, relative), 'utf8');

  it('AGENTS.md points every new feature at the gate', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('PRE_IMPLEMENTATION_REUSE_GATE');
    expect(agents).toContain('docs/pre-implementation-reuse-gate.md');
  });

  it('the canonical spec defines scope, taxonomy and fail-closed codes', () => {
    const spec = read('docs/pre-implementation-reuse-gate.md');
    for (const code of Object.keys(REUSE_GATE_FAILURE_CODES)) {
      expect(spec).toContain(code);
    }
    for (const category of [
      ...REUSE_GATE_REQUIRED_CATEGORIES,
      ...REUSE_GATE_EXEMPT_CATEGORIES,
    ]) {
      expect(spec).toContain(category);
    }
    expect(spec).toContain('MATURE_CAPABILITY_DELTA_GATE');
    expect(spec).toContain('MATURE_CAPABILITY_LOSS = NONE');
    expect(spec).toContain('RESULT_EQUIVALENT_OR_BETTER = PASS');
  });

  it('the existing reuse Skill states the six gate rules', () => {
    const skill = read('.agents/skills/external-ecosystem-reuse/SKILL.md');
    expect(skill).toContain('CHECK BEFORE BUILD');
    expect(skill).toContain('CHECK REGISTRY BEFORE RESEARCH');
    expect(skill).toContain('CHECK PROJECT BEFORE ECOSYSTEM');
    expect(skill).toContain('OPENKORE IS INCUMBENT UNTIL EXIT');
    expect(skill).toContain('BUILD_NEW REQUIRES WHY_NOT_REUSE');
    expect(skill).toContain('NEW RESEARCH MUST WRITE BACK TO REGISTRY');
    expect(skill).toContain('MATURE_CAPABILITY_DELTA_GATE');
    expect(skill).toContain('MATURE_CAPABILITY_LOSS = NONE');
  });

  it('roadmap and worker templates auto-trigger the mature reference delta gate', () => {
    const roadmap = read('docs/PROJECT_ROADMAP.md');
    expect(roadmap).toContain('MATURE_REFERENCE_FIRST = REQUIRED');
    expect(roadmap).toContain(
      'RESULT_EQUIVALENT_OR_BETTER_THAN_MATURE_REFERENCE = REQUIRED',
    );

    for (const template of [
      read('docs/project-control/workline-dispatch-template.md'),
      read('docs/project-control/workline-continuation-template.md'),
    ]) {
      expect(template).toContain('CAPABILITY_SCOPE');
      expect(template).toContain('DELTA_REFERENCE_AUDIT_REQUIRED');
      expect(template).toContain('MATURE_REFERENCE_AUDIT');
      expect(template).toContain('MATURE_CAPABILITY_LOSS');
      expect(template).toContain('RESULT_EQUIVALENT_OR_BETTER');
    }
  });

  it('the reuse registry declares the gate and invalidation rules', () => {
    const registry = JSON.parse(
      read('ops/research/external-reuse-registry.json'),
    );
    expect(registry.preImplementationReuseGate).toBeTruthy();
    expect(
      registry.preImplementationReuseGate.authority,
    ).toBe('docs/pre-implementation-reuse-gate.md');
    expect(registry.researchInvalidationRules).toBeTruthy();
  });
});
