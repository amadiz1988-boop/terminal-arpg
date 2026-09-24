import { MissionStageType } from './contracts.mjs';

export const DEFAULT_DIALOG_AUTO_DELAY_MS = 2400;

const interactiveTypes = new Set([
  MissionStageType.QUIZ,
  MissionStageType.CHOICE,
  MissionStageType.ROUTE_EVENT,
]);
const idPattern = /^[A-Za-z0-9_.:-]{1,128}$/;
const actionKinds = new Set(['SERVER_ACTION', 'SERVER_COMMIT']);

const cleanText = (value, maximum = 2048) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maximum);

const nullablePositiveInteger = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export function dialogPacingMs(value) {
  const length = cleanText(value).length;
  return Math.min(5200, Math.max(1800, 1000 + length * 38));
}

function normalizeDialogLine(line, index, prefix, defaultSpeaker) {
  const source = typeof line === 'string' ? { text: line } : line;
  const text = cleanText(source?.text);
  if (!text) throw new TypeError('mission interaction dialog line text is required');
  const id = cleanText(source?.id || `${prefix}.line-${index + 1}`, 128);
  if (!idPattern.test(id)) {
    throw new TypeError('mission interaction dialog line id is invalid');
  }
  const pacingMs = Number(source?.pacingMs ?? dialogPacingMs(text));
  if (!Number.isSafeInteger(pacingMs) || pacingMs < 1000 || pacingMs > 8_000) {
    throw new TypeError('mission interaction dialog pacing is invalid');
  }
  return Object.freeze({
    id,
    text,
    speaker: cleanText(source?.speaker || defaultSpeaker, 96) || null,
    pacingMs,
    sourceRef: cleanText(source?.sourceRef, 256) || null,
  });
}

function normalizeAvailableAction(action) {
  const id = cleanText(action?.id, 96);
  const label = cleanText(action?.label, 96);
  const kind = cleanText(action?.kind || 'SERVER_ACTION', 32);
  if (!idPattern.test(id) || !label || !actionKinds.has(kind)) {
    throw new TypeError('mission interaction action is invalid');
  }
  return Object.freeze({ id, label, kind });
}

function normalizeDefinition(phase, definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError(`mission interaction definition is invalid: ${phase}`);
  }
  const dialogLines = Array.isArray(definition.dialogLines)
    ? definition.dialogLines.map((line, index) =>
        normalizeDialogLine(
          line,
          index,
          cleanText(definition.interactionKey || phase, 128),
          definition.npcName,
        ),
      )
    : [];
  const availableActions = Array.isArray(definition.availableActions)
    ? definition.availableActions.map(normalizeAvailableAction)
    : [];
  if (definition.autoAdvanceAllowed == null) {
    throw new TypeError(`autoAdvanceAllowed is required: ${phase}`);
  }
  if (definition.requiresPlayerInput == null) {
    throw new TypeError(`requiresPlayerInput is required: ${phase}`);
  }
  return Object.freeze({
    ...definition,
    interactionKey: cleanText(definition.interactionKey || phase, 128),
    npcId: cleanText(definition.npcId, 96) || null,
    npcKey: cleanText(definition.npcKey, 96) || null,
    npcName: cleanText(definition.npcName, 96) || null,
    npcVisualKey: cleanText(definition.npcVisualKey, 96) || null,
    dialogLines: Object.freeze(dialogLines),
    availableActions: Object.freeze(availableActions),
    autoAdvanceAllowed: definition.autoAdvanceAllowed === true,
    requiresPlayerInput: definition.requiresPlayerInput === true,
    sourceRef: cleanText(definition.sourceRef, 256) || null,
  });
}

export function defineMissionInteractionDefinitions(definitions = {}) {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) {
    throw new TypeError('mission interaction definitions are invalid');
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(definitions).map(([phase, definition]) => {
        if (!/^[A-Z][A-Z0-9_]{1,47}$/.test(phase)) {
          throw new TypeError('mission interaction phase is invalid');
        }
        return [phase, normalizeDefinition(phase, definition)];
      }),
    ),
  );
}

export function projectMissionInteractionStage({
  state,
  adapter,
  adapterState,
  adapterStatus,
  publicState,
}) {
  const rawStage = publicState?.missionStage ?? state?.missionStage ?? {};
  const phase = cleanText(adapterStatus?.phase || adapterState?.phase || 'UNKNOWN', 48);
  const definition = adapter?.interactionDefinitions?.[phase] ?? {};
  const type = cleanText(rawStage.type || definition.type || MissionStageType.DIALOG, 32);
  const currentStepId = cleanText(publicState?.currentStep?.id || state?.currentStep?.id, 96) || null;
  const questSessionId = cleanText(publicState?.questSessionId || state?.questSessionId, 128) || null;
  const revision = Number(publicState?.revision ?? state?.revision ?? 0);
  const generation = Number(
    publicState?.objectiveGeneration ?? state?.objectiveGeneration ?? 0,
  );
  const interactionKey = cleanText(
    rawStage.interactionKey || definition.interactionKey || currentStepId || phase,
    128,
  );
  const identityPrefix = [
    adapter?.id,
    questSessionId || `char-${Number(state?.charId ?? 0)}`,
    interactionKey,
    type,
    cleanText(rawStage.status, 48) || 'READY',
  ].join(':');
  const defaultSpeaker =
    rawStage.npcName ||
    definition.npcName ||
    rawStage.npc ||
    rawStage.finalNpc ||
    null;
  const dialogSource = Array.isArray(rawStage.dialogLines)
    ? rawStage.dialogLines
    : definition.dialogLines ?? [];
  const dialogLines = Object.freeze(
    dialogSource.map((line, index) =>
      normalizeDialogLine(line, index, identityPrefix, defaultSpeaker),
    ),
  );
  const availableActions = Object.freeze(
    (Array.isArray(rawStage.availableActions)
      ? rawStage.availableActions
      : definition.availableActions ?? []
    ).map(normalizeAvailableAction),
  );
  const status = cleanText(rawStage.status || publicState?.questStatus || 'READY', 48);
  const completed =
    rawStage.completed === true ||
    status === 'COMPLETED' ||
    publicState?.questStatus === 'COMPLETED';
  const requiresPlayerInput =
    rawStage.requiresPlayerInput === true ||
    definition.requiresPlayerInput === true ||
    interactiveTypes.has(type) ||
    status === 'INPUT_REQUIRED' ||
    status === 'READY_TO_COMMIT' ||
    availableActions.length > 0;
  const autoAdvanceAllowed =
    (rawStage.autoAdvanceAllowed === true ||
      definition.autoAdvanceAllowed === true) &&
    type === MissionStageType.DIALOG &&
    !requiresPlayerInput &&
    dialogLines.length > 1;
  const currentLineValue = Number(rawStage.currentLine ?? 0);
  const currentLine = Number.isSafeInteger(currentLineValue)
    ? Math.max(0, Math.min(currentLineValue, Math.max(0, dialogLines.length - 1)))
    : 0;
  const questId = nullablePositiveInteger(publicState?.questId ?? state?.questId);
  return Object.freeze({
    ...rawStage,
    interactionId: cleanText(rawStage.interactionId || identityPrefix, 384),
    adapterId: adapter?.id ?? null,
    questId,
    authorityIdentity: Object.freeze({
      questSessionId,
      currentStepId,
      questId,
    }),
    npcId: cleanText(rawStage.npcId || definition.npcId, 96) || null,
    npcKey: cleanText(rawStage.npcKey || definition.npcKey, 96) || null,
    npcName: cleanText(defaultSpeaker, 96) || null,
    npcVisualKey:
      cleanText(rawStage.npcVisualKey || definition.npcVisualKey, 96) || null,
    dialogLines,
    currentLine,
    autoAdvanceAllowed,
    requiresPlayerInput,
    availableActions,
    completed,
    revision: Number.isSafeInteger(revision) ? revision : 0,
    generation: Number.isSafeInteger(generation) ? generation : 0,
    presentationOnly: true,
    sourceRef: cleanText(rawStage.sourceRef || definition.sourceRef, 256) || null,
  });
}
