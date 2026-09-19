import { CommitType } from './contracts.mjs';
import { defineMissionInteractionDefinitions } from './mission-interaction-contract.mjs';

const adapterIdPattern = /^[A-Z][A-Z0-9_]{1,31}$/;

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} is required`);
  }
  return value;
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} is required`);
  return value;
}

export function assertQuestServerCommand(command) {
  requiredObject(command, 'serverCommand');
  if (!/^terminal_[a-z0-9_]{1,22}_sync$/.test(command.name ?? '')) {
    throw new TypeError('serverCommand.name is invalid');
  }
  const args = Array.isArray(command.arguments)
    ? command.arguments.map((value) => String(value))
    : [];
  if (
    args.length > 16 ||
    args.some((value) => !/^[A-Za-z0-9_.:-]{1,64}$/.test(value))
  ) {
    throw new TypeError('serverCommand.arguments are invalid');
  }
  return { name: command.name, arguments: args };
}

export function defineJobQuestAdapter(definition) {
  requiredObject(definition, 'job adapter');
  if (!adapterIdPattern.test(definition.id ?? '')) {
    throw new TypeError('job adapter id is invalid');
  }
  if (!Number.isSafeInteger(definition.jobId) || definition.jobId <= 0) {
    throw new TypeError('job adapter jobId is invalid');
  }
  requiredObject(definition.eligibility, 'job adapter eligibility');
  if (
    typeof definition.displayName !== 'string' ||
    !definition.displayName.trim() ||
    definition.displayName.length > 48
  ) {
    throw new TypeError('job adapter displayName is invalid');
  }
  if (
    !Number.isSafeInteger(definition.eligibility.sourceJobId) ||
    definition.eligibility.sourceJobId < 0 ||
    !Number.isSafeInteger(definition.eligibility.minimumJobLevel) ||
    definition.eligibility.minimumJobLevel < 1 ||
    !Number.isSafeInteger(definition.eligibility.skillPoint) ||
    definition.eligibility.skillPoint < 0
  ) {
    throw new TypeError('job adapter eligibility rules are invalid');
  }
  requiredFunction(
    definition.eligibility.evaluate,
    'job adapter eligibility.evaluate',
  );
  const questStateMapping = requiredObject(
    definition.questStateMapping,
    'job adapter questStateMapping',
  );
  if (
    !Array.isArray(questStateMapping.questIds) ||
    questStateMapping.questIds.length === 0 ||
    questStateMapping.questIds.some(
      (value) => !Number.isSafeInteger(value) || value <= 0,
    ) ||
    !Array.isArray(questStateMapping.variables) ||
    questStateMapping.variables.some(
      (value) => !/^[A-Za-z0-9_]{1,64}$/.test(value),
    )
  ) {
    throw new TypeError('job adapter questStateMapping is invalid');
  }
  if (
    !Array.isArray(definition.steps) ||
    definition.steps.length === 0 ||
    definition.steps.some((value) => !/^[a-z][a-z0-9_.-]{1,63}$/.test(value)) ||
    new Set(definition.steps).size !== definition.steps.length
  ) {
    throw new TypeError('job adapter steps are required');
  }
  if (!Array.isArray(definition.quizDefinitions)) {
    throw new TypeError('job adapter quizDefinitions are required');
  }
  if (!Array.isArray(definition.trialDefinitions)) {
    throw new TypeError('job adapter trialDefinitions are required');
  }
  requiredObject(definition.routeEvents, 'job adapter routeEvents');
  if (!Array.isArray(definition.requiredItems)) {
    throw new TypeError('job adapter requiredItems are required');
  }
  const equipmentRequirements = definition.equipmentRequirements ?? [];
  if (
    !Array.isArray(equipmentRequirements) ||
    equipmentRequirements.some(
      (requirement) =>
        !Number.isSafeInteger(requirement?.itemId) ||
        requirement.itemId <= 0 ||
        requirement.mustBeEquipped !== true,
    )
  ) {
    throw new TypeError('job adapter equipmentRequirements are invalid');
  }
  if (
    definition.requiredItems.some(
      (item) =>
        !Number.isSafeInteger(item?.itemId) ||
        item.itemId <= 0 ||
        !Number.isSafeInteger(item?.minimumAmount) ||
        item.minimumAmount < 0,
    )
  ) {
    throw new TypeError('job adapter requiredItems are invalid');
  }
  requiredObject(definition.checkpointRules, 'job adapter checkpointRules');
  const finalCommit = requiredObject(
    definition.finalCommit,
    'job adapter finalCommit',
  );
  if (finalCommit.commitType !== CommitType.JOB_CHANGE) {
    throw new TypeError('job adapter finalCommit must use JOB_CHANGE');
  }
  if (
    !Number.isSafeInteger(finalCommit.completionQuestId) ||
    finalCommit.completionQuestId <= 0
  ) {
    throw new TypeError('job adapter finalCommit.completionQuestId is invalid');
  }
  requiredFunction(finalCommit.validate, 'job adapter finalCommit.validate');
  requiredFunction(
    finalCommit.isComplete,
    'job adapter finalCommit.isComplete',
  );
  requiredFunction(finalCommit.result, 'job adapter finalCommit.result');
  for (const name of [
    'initializeState',
    'selectCareerTarget',
    'applyAction',
    'reconcileState',
    'publicState',
    'publicStatus',
  ]) {
    requiredFunction(definition[name], `job adapter ${name}`);
  }
  return Object.freeze({
    ...definition,
    equipmentRequirements: Object.freeze([...equipmentRequirements]),
    interactionDefinitions: defineMissionInteractionDefinitions(
      definition.interactionDefinitions ?? {},
    ),
    finalCommit: Object.freeze({
      ...finalCommit,
      command: assertQuestServerCommand(finalCommit.command),
    }),
  });
}

export function createJobQuestAdapterRegistry(adapters) {
  if (!Array.isArray(adapters) || adapters.length === 0) {
    throw new TypeError('job adapter registry requires adapters');
  }
  const byId = new Map();
  for (const adapter of adapters) {
    if (!adapter || !adapterIdPattern.test(adapter.id ?? '')) {
      throw new TypeError('job adapter registry contains an invalid adapter');
    }
    if (byId.has(adapter.id)) {
      throw new TypeError(`duplicate job adapter: ${adapter.id}`);
    }
    byId.set(adapter.id, adapter);
  }

  const fromJob = (sourceJobId) =>
    Object.freeze(
      [...byId.values()].filter(
        (adapter) =>
          Number(adapter.eligibility.sourceJobId) === Number(sourceJobId),
      ),
    );

  const availableTargets = (authority) => {
    const currentJob = Number(authority?.currentJob);
    const jobLevel = Number(authority?.jobLevel ?? 0);
    const skillPoint = Number(authority?.skillPoint ?? 0);
    return Object.freeze(
      fromJob(currentJob).map((adapter) => {
        const evaluation = adapter.eligibility.evaluate(authority);
        const missingRequirements = [];
        if (adapter.available === false) {
          missingRequirements.push(adapter.unavailableReason ?? '尚未開放');
        }
        if (jobLevel < adapter.eligibility.minimumJobLevel) {
          missingRequirements.push(
            `Job Lv.${jobLevel} / ${adapter.eligibility.minimumJobLevel}`,
          );
        }
        if (skillPoint !== adapter.eligibility.skillPoint) {
          missingRequirements.push(
            `剩餘技能點 ${skillPoint} / 需 ${adapter.eligibility.skillPoint}`,
          );
        }
        if (evaluation?.eligible !== true && missingRequirements.length === 0) {
          missingRequirements.push('目前伺服器狀態尚未符合轉職條件');
        }
        return Object.freeze({
          adapterId: adapter.id,
          displayName: adapter.displayName,
          sourceJobId: adapter.eligibility.sourceJobId,
          targetJobId: adapter.jobId,
          available: adapter.available !== false,
          unavailableReason:
            adapter.available === false
              ? (adapter.unavailableReason ?? '尚未開放')
              : null,
          eligible: adapter.available !== false && evaluation?.eligible === true,
          missingRequirements: Object.freeze(missingRequirements),
          failureCodes: Object.freeze([...(evaluation?.failures ?? [])]),
        });
      }),
    );
  };

  const careerProjection = (authority, state = {}) => {
    const targets = availableTargets(authority);
    const requestedTarget = String(state?.careerTarget ?? '').toUpperCase();
    const selectedCareerTarget =
      targets.find((target) => target.adapterId === requestedTarget) ?? null;
    const activeJourney = Boolean(
      state?.formalQuestStarted ||
        state?.adapterStatus?.active ||
        state?.adapterStatus?.phase === 'COMPLETED',
    );
    const activeAdapterId = String(state?.adapterId ?? '').toUpperCase();
    const activeAdapter = activeJourney ? byId.get(activeAdapterId) : null;
    const currentJob = Number(authority?.currentJob);
    const journeyAdapter =
      activeAdapter &&
      [activeAdapter.eligibility.sourceJobId, activeAdapter.jobId].some(
        (jobId) => Number(jobId) === currentJob,
      )
        ? activeAdapter
        : null;
    const detailAdapterId = journeyAdapter?.id ?? selectedCareerTarget?.adapterId ?? null;
    const mode = journeyAdapter
      ? 'JOURNEY'
      : !selectedCareerTarget
        ? 'EMPTY'
        : selectedCareerTarget.eligible
          ? 'READY'
          : 'ELIGIBILITY';
    return Object.freeze({
      availableCareerTargets: targets,
      selectedCareerTarget,
      careerDetail: Object.freeze({
        mode,
        adapterId: detailAdapterId,
        target: selectedCareerTarget,
      }),
    });
  };

  return Object.freeze({
    get: (adapterId) => byId.get(String(adapterId ?? '').toUpperCase()),
    values: () => byId.values(),
    entries: () => byId.entries(),
    fromJob,
    availableTargets,
    careerProjection,
    [Symbol.iterator]: () => byId[Symbol.iterator](),
  });
}

export function createAuthoritativeJobChangeCommitter({
  adapter,
  queueCharacterCommand,
  sendCommitCommand,
  authorityReader,
  timeoutMs = 20_000,
  pollIntervalMs = 250,
}) {
  if (
    !adapter ||
    typeof authorityReader !== 'function' ||
    (typeof sendCommitCommand !== 'function' &&
      typeof queueCharacterCommand !== 'function')
  ) {
    throw new TypeError('job change committer dependencies are required');
  }
  return async function commitJobChange({ identity, authority, payload }) {
    adapter.finalCommit.validate({ identity, authority, payload });
    if (typeof sendCommitCommand === 'function') {
      await sendCommitCommand({
        identity: structuredClone(identity),
        command: adapter.finalCommit.command,
      });
    } else {
      await queueCharacterCommand(
        { accountId: Number(identity.accountId) },
        'quest_server_command',
        JSON.stringify(adapter.finalCommit.command),
      );
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      const observed = await authorityReader({
        ...identity,
        questId: adapter.finalCommit.completionQuestId,
        adapterId: adapter.id,
      });
      if (adapter.finalCommit.isComplete(observed)) {
        return adapter.finalCommit.result(observed);
      }
    }
    throw new Error('JOB_CHANGE_NOT_CONFIRMED');
  };
}
