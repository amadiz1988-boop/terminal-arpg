#!/usr/bin/env node

// Deterministic, dependency-free evaluator for the fail-closed
// PRE_IMPLEMENTATION_REUSE_GATE defined in docs/pre-implementation-reuse-gate.md.
//
// The exported evaluator does no network or filesystem work. It only decides
// whether a supplied gate record is a PASS or which fail-closed codes it
// violates. The CLI entry reads one JSON file.

import fs from 'node:fs';

export const REUSE_GATE_FIELD = 'PRE_IMPLEMENTATION_REUSE_GATE';

export const REUSE_GATE_CHECKS = [
  'currentProject',
  'legacyProject',
  'reuseRegistry',
  'rAthena',
  'openKore',
  'externalEcosystem',
  'genericOSS',
];

export const CHECK_STATUS = {
  CHECKED: 'CHECKED',
  REGISTRY_HIT: 'REGISTRY_HIT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  RESEARCH_REQUIRED: 'RESEARCH_REQUIRED',
};

export const REUSE_GATE_REQUIRED_CATEGORIES = [
  'NEW_FEATURE',
  'NEW_SUBSYSTEM',
  'NEW_CAPABILITY',
  'NEW_EXTERNAL_DEPENDENCY',
  'NEW_MAJOR_ALGORITHM',
  'REPLACEMENT_OF_EXISTING_SUBSYSTEM',
];

export const REUSE_GATE_EXEMPT_CATEGORIES = [
  'BUG_FIX',
  'TEST_ONLY',
  'DOC_ONLY',
  'PROVENANCE_ONLY',
  'FORMAT_ONLY',
  'MAINTENANCE',
  'TYPO_FIX',
];

export const REUSE_GATE_INHERITING_CATEGORY = 'KNOWN_IMPLEMENTATION_TASK';

export const GATE_DECISIONS = [
  'DIRECT_REUSE',
  'PORTABLE_LOGIC',
  'REIMPLEMENT_FROM_BEHAVIOR',
  'REFERENCE_ONLY',
  'BUILD_NEW',
  'ALREADY_EXISTS',
];

export const GATE_DECISION_DEFINITIONS = {
  DIRECT_REUSE: 'Adopt an existing implementation as-is; no new logic.',
  PORTABLE_LOGIC:
    'Transpose proven logic/design into our architecture, adapting to our authority boundaries.',
  REIMPLEMENT_FROM_BEHAVIOR:
    'Reimplement from an observed behavior contract because the original is not portable.',
  REFERENCE_ONLY:
    'Use as design reference only; no code, dependency or license obligation taken.',
  BUILD_NEW: 'Build new capability with no reusable source; requires whyNotReuse.',
  ALREADY_EXISTS:
    'The project already has the capability; no implementation necessary.',
};

// Categories that make OpenKore an INCUMBENT_LEGACY_IMPLEMENTATION reference
// while OPENKORE_REMOVED = NO. Harvest/census knowledge must be checked first.
export const OPENKORE_INCUMBENT_CATEGORIES = [
  'navigation',
  'routing',
  'combat',
  'target_selection',
  'skills',
  'loot',
  'inventory',
  'equipment',
  'npc',
  'dialog',
  'quest',
  'supply',
  'buy_sell_storage',
  'death_respawn',
  'party',
  'follow',
  'reconnect',
  'automation',
  'policy',
  'timeout_retry',
  'failure_recovery',
  'observability',
  'status_export',
  'task_scheduling',
];

export const RESEARCH_INVALIDATION_RULES = [
  'UPSTREAM_VERSION_CHANGED',
  'PROJECT_REQUIREMENT_CHANGED',
  'LICENSE_STATUS_UNRESOLVED',
  'INTEGRATION_IMMINENT',
  'EVIDENCE_TOO_SHALLOW',
  'REGISTRY_TOO_OLD_FOR_FAST_MOVING_DEPENDENCY',
];

export const FRESH_RESEARCH_JUSTIFICATIONS = [
  'STALE',
  'INSUFFICIENT_EVIDENCE',
  'VERSION_CHANGED',
  'INTEGRATION_IMMINENT',
  'LICENSE_UNRESOLVED',
  'REGISTRY_MISS',
];

export const REGISTRY_UPDATE_STATUSES = ['UPDATED', 'NO_CHANGE'];

export const REUSE_GATE_FAILURE_CODES = {
  REUSE_GATE_MISSING: 'Gate required but no structured gate record exists.',
  REUSE_DECISION_MISSING: 'Gate present but decision is missing or unknown.',
  BUILD_NEW_WITHOUT_WHY_NOT_REUSE:
    'BUILD_NEW requires a non-empty whyNotReuse rationale.',
  EXISTING_CAPABILITY_IGNORED:
    'Current project already implements the capability but BUILD_NEW has no rationale.',
  OPENKORE_REUSE_CHECK_MISSING:
    'OpenKore-relevant capability without checking preserved harvest/census knowledge.',
  REDUNDANT_RESEARCH_WITHOUT_JUSTIFICATION:
    'Redundant ecosystem research after a registry hit without a justification.',
  REQUIRED_CHECK_INCOMPLETE:
    'A required source check is missing, incomplete or lacks evidence.',
  REGISTRY_UPDATE_MISSING:
    'Research was performed but no registry write-back / no-change evidence exists.',
  REUSE_GATE_INHERITANCE_MISSING:
    'KNOWN_IMPLEMENTATION_TASK without REUSE_GATE_INHERITED_FROM.',
  TASK_CATEGORY_UNKNOWN: 'Task category missing or unrecognized.',
  DISCOVERY_STALLED:
    'Equivalent discovery exhausted without new material evidence.',
};

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeCategory(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeToken(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isTrue(value) {
  return value === true || value === 'YES' || value === 'TRUE' || value === 'true';
}

function isFalse(value) {
  return value === false || value === 'NO' || value === 'FALSE' || value === 'false';
}

function extractGate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const direct = raw[REUSE_GATE_FIELD];
  if (direct && typeof direct === 'object') return direct;
  if (raw.gate && typeof raw.gate === 'object') return raw.gate;
  return null;
}

function taskCategoryOf(raw, gate) {
  const candidates = [
    raw && raw.taskCategory,
    gate && gate.taskCategory,
    gate && gate.scope,
    raw && raw.scope,
  ];
  return candidates.find((value) => hasText(value)) || '';
}

export function isGateRequiredForCategory(category) {
  return REUSE_GATE_REQUIRED_CATEGORIES.includes(normalizeCategory(category));
}

export function isGateExemptCategory(category) {
  return REUSE_GATE_EXEMPT_CATEGORIES.includes(normalizeCategory(category));
}

export function openKoreCategoriesOf(raw, gate) {
  const source = [
    ...((gate && gate.categories) || []),
    ...((gate && gate.openKoreCategories) || []),
    ...((raw && raw.categories) || []),
  ];
  return source.map(normalizeToken).filter(Boolean);
}

export function isOpenKoreRelevant(raw, gate) {
  const explicit =
    (gate && gate.openKoreRelevant) ?? (raw && raw.openKoreRelevant);
  if (isTrue(explicit)) return true;
  if (isFalse(explicit)) return false;
  const categories = openKoreCategoriesOf(raw, gate);
  return categories.some((category) =>
    OPENKORE_INCUMBENT_CATEGORIES.includes(category),
  );
}

function validateNonOpenKoreCheck(check, addFailure) {
  if (!check || typeof check !== 'object') {
    addFailure('REQUIRED_CHECK_INCOMPLETE', 'missing');
    return;
  }
  const status = check.status;
  if (status === CHECK_STATUS.CHECKED) {
    if (!hasText(check.evidence)) {
      addFailure('REQUIRED_CHECK_INCOMPLETE', 'CHECKED without evidence');
    }
    return;
  }
  if (status === CHECK_STATUS.REGISTRY_HIT) {
    if (!hasText(check.reference) && !hasText(check.evidence)) {
      addFailure('REQUIRED_CHECK_INCOMPLETE', 'REGISTRY_HIT without reference');
    }
    return;
  }
  if (status === CHECK_STATUS.NOT_APPLICABLE) {
    if (!hasText(check.reason)) {
      addFailure('REQUIRED_CHECK_INCOMPLETE', 'NOT_APPLICABLE without reason');
    }
    return;
  }
  if (status === CHECK_STATUS.RESEARCH_REQUIRED) {
    addFailure('REQUIRED_CHECK_INCOMPLETE', 'RESEARCH_REQUIRED');
    return;
  }
  addFailure('REQUIRED_CHECK_INCOMPLETE', `unknown status "${status ?? ''}"`);
}

/**
 * Evaluate a gate record.
 *
 * Accepts either a bare gate record (with a PRE_IMPLEMENTATION_REUSE_GATE key)
 * or an envelope { taskCategory, gate | PRE_IMPLEMENTATION_REUSE_GATE, ... }.
 *
 * @returns {{
 *   featureId: string|null,
 *   taskCategory: string,
 *   gateRequired: boolean,
 *   gateMode: 'FULL'|'INHERITED'|'EXEMPT',
 *   decision: string|null,
 *   openKoreRelevant: boolean,
 *   passed: boolean,
 *   failureCodes: string[],
 *   reasons: string[],
 * }}
 */
export function evaluateReuseGate(raw) {
  const gate = extractGate(raw);
  const category = taskCategoryOf(raw, gate);
  const normalizedCategory = normalizeCategory(category);
  const inheritedFrom = hasText(
    (raw && (raw.REUSE_GATE_INHERITED_FROM || raw.inheritedFrom)) ||
      (gate && (gate.REUSE_GATE_INHERITED_FROM || gate.inheritedFrom)),
  );

  const result = {
    featureId: (gate && gate.featureId) || null,
    taskCategory: normalizedCategory || null,
    gateRequired: false,
    gateMode: 'EXEMPT',
    decision: (gate && gate.decision) || null,
    openKoreRelevant: gate ? isOpenKoreRelevant(raw, gate) : false,
    passed: false,
    failureCodes: [],
    reasons: [],
  };

  const addFailure = (code, reason) => {
    if (!result.failureCodes.includes(code)) result.failureCodes.push(code);
    if (hasText(reason)) {
      result.reasons.push(reason.startsWith(code) ? reason : `${code}: ${reason}`);
    }
  };

  if (!normalizedCategory) {
    result.gateRequired = true;
    result.gateMode = 'FULL';
    addFailure('TASK_CATEGORY_UNKNOWN', 'task category is missing');
  } else if (REUSE_GATE_EXEMPT_CATEGORIES.includes(normalizedCategory)) {
    result.passed = true;
    return result;
  } else if (normalizedCategory === REUSE_GATE_INHERITING_CATEGORY) {
    result.gateRequired = true;
    result.gateMode = 'INHERITED';
    if (!inheritedFrom) {
      addFailure(
        'REUSE_GATE_INHERITANCE_MISSING',
        'KNOWN_IMPLEMENTATION_TASK requires REUSE_GATE_INHERITED_FROM',
      );
      return result;
    }
    result.passed = true;
    return result;
  } else if (REUSE_GATE_REQUIRED_CATEGORIES.includes(normalizedCategory)) {
    result.gateRequired = true;
    result.gateMode = 'FULL';
  } else {
    result.gateRequired = true;
    result.gateMode = 'FULL';
    addFailure('TASK_CATEGORY_UNKNOWN', `unrecognized category "${category}"`);
  }

  if (!gate || !gate.checks || typeof gate.checks !== 'object') {
    addFailure('REUSE_GATE_MISSING', 'no PRE_IMPLEMENTATION_REUSE_GATE record');
    return result;
  }

  if (!hasText(gate.decision)) {
    addFailure('REUSE_DECISION_MISSING', 'decision is empty');
  } else if (!GATE_DECISIONS.includes(gate.decision)) {
    addFailure('REUSE_DECISION_MISSING', `unknown decision "${gate.decision}"`);
  }

  for (const checkName of REUSE_GATE_CHECKS) {
    if (checkName === 'openKore') continue;
    try {
      validateNonOpenKoreCheck(gate.checks[checkName], (code, reason) =>
        addFailure(code, `${checkName}: ${reason}`),
      );
    } catch {
      addFailure('REQUIRED_CHECK_INCOMPLETE', `${checkName}: malformed`);
    }
  }

  const openKoreCheck = gate.checks.openKore;
  if (result.openKoreRelevant) {
    const ok =
      openKoreCheck &&
      typeof openKoreCheck === 'object' &&
      (openKoreCheck.status === CHECK_STATUS.CHECKED ||
        openKoreCheck.status === CHECK_STATUS.REGISTRY_HIT) &&
      (hasText(openKoreCheck.evidence) || hasText(openKoreCheck.reference));
    if (!ok) {
      addFailure(
        'OPENKORE_REUSE_CHECK_MISSING',
        'OpenKore-relevant capability must check harvest/census knowledge first',
      );
    }
  } else {
    validateNonOpenKoreCheck(openKoreCheck, (code, reason) =>
      addFailure(code, `openKore: ${reason}`),
    );
  }

  const implementationFound =
    gate.checks.currentProject &&
    isTrue(
      gate.checks.currentProject.implementationFound ??
        gate.checks.currentProject.existingImplementation,
    );
  const whyNotReuseMissing = !hasText(gate.whyNotReuse);

  if (gate.decision === 'BUILD_NEW' && whyNotReuseMissing) {
    if (implementationFound) {
      addFailure(
        'EXISTING_CAPABILITY_IGNORED',
        'current project implements the capability; explain why it cannot be reused/extended',
      );
    } else {
      addFailure('BUILD_NEW_WITHOUT_WHY_NOT_REUSE', 'whyNotReuse is empty');
    }
  }

  const registryHit = gate.checks.reuseRegistry?.status === CHECK_STATUS.REGISTRY_HIT;
  const freshResearch =
    isTrue(gate.freshResearchPerformed) ||
    (gate.research && isTrue(gate.research.performed));
  const justification = normalizeCategory(
    gate.freshResearchJustification || (gate.research && gate.research.justification) || '',
  );
  if (
    registryHit &&
    freshResearch &&
    !FRESH_RESEARCH_JUSTIFICATIONS.includes(justification)
  ) {
    addFailure(
      'REDUNDANT_RESEARCH_WITHOUT_JUSTIFICATION',
      'registry hit exists; record STALE/INSUFFICIENT/INTEGRATION/VERSION/LICENSE justification',
    );
  }

  if (isTrue(gate.researchStalled)) {
    addFailure('DISCOVERY_STALLED', 'research loop stopped without new evidence');
  }

  const registryUpdateRequired = isTrue(gate.registryUpdateRequired);
  const update = gate.registryUpdate;
  if (freshResearch && !registryUpdateRequired) {
    addFailure(
      'REGISTRY_UPDATE_MISSING',
      'fresh research must set registryUpdateRequired with write-back or no-change evidence',
    );
  }
  if (registryUpdateRequired) {
    const updateOk =
      update &&
      typeof update === 'object' &&
      REGISTRY_UPDATE_STATUSES.includes(update.status) &&
      hasText(update.evidence);
    if (!updateOk) {
      addFailure(
        'REGISTRY_UPDATE_MISSING',
        'registryUpdateRequired=true without UPDATED/NO_CHANGE evidence',
      );
    }
  }

  result.passed = result.failureCodes.length === 0;
  return result;
}

export function formatReuseGateReport(result) {
  const lines = [
    `${REUSE_GATE_FIELD} = ${result.passed ? 'PASS' : 'FAIL'}`,
    `featureId: ${result.featureId || 'UNKNOWN'}`,
    `taskCategory: ${result.taskCategory || 'UNKNOWN'}`,
    `gateRequired: ${result.gateRequired ? 'YES' : 'NO'}`,
    `gateMode: ${result.gateMode}`,
    `openKoreRelevant: ${result.openKoreRelevant ? 'YES' : 'NO'}`,
  ];
  if (!result.passed) {
    lines.push(`failureCodes: ${result.failureCodes.join(', ')}`);
  }
  return lines.join('\n');
}

function runCli() {
  const target = process.argv[2];
  if (!target) {
    console.error(
      'Usage: node reuse-gate.mjs <gate-record.json> [--json]',
    );
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
  const result = evaluateReuseGate(raw);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReuseGateReport(result));
  }
  process.exit(result.passed ? 0 : 1);
}

if (
  process.argv[1] &&
  process.argv[1].replaceAll('\\', '/').endsWith('reuse-gate.mjs')
) {
  runCli();
}
