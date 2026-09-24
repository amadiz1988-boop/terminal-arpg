import {
  MissionStageType,
  ObjectiveCompletionMode,
  PreflightStatus,
  QuestStatus,
} from './contracts.mjs';
import {
  completeQuestStep,
  completeSupply,
  failTrial,
  markNeedsAttention,
  reachSafePoint,
  recordDeath,
  recoverAfterRespawn,
} from './runtime.mjs';
import { recordAgentSemanticEvent } from './event-log.mjs';

export const AgentEventType = Object.freeze({
  QUEST_OBJECTIVE_START: 'QUEST_OBJECTIVE_START',
  QUEST_OBJECTIVE_PROGRESS: 'QUEST_OBJECTIVE_PROGRESS',
  QUEST_OBJECTIVE_COMPLETE: 'QUEST_OBJECTIVE_COMPLETE',
  QUEST_OBJECTIVE_FAILED: 'QUEST_OBJECTIVE_FAILED',
  SUPPLY_PENDING: 'SUPPLY_PENDING',
  SUPPLY_ACTIVE: 'SUPPLY_ACTIVE',
  SUPPLY_COMPLETE: 'SUPPLY_COMPLETE',
  TRIAL_POLICY_APPLIED: 'TRIAL_POLICY_APPLIED',
  TRIAL_POLICY_RELEASED: 'TRIAL_POLICY_RELEASED',
  CHARACTER_DEAD: 'CHARACTER_DEAD',
  RESPAWNED: 'RESPAWNED',
  READY_TO_RESUME: 'READY_TO_RESUME',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  NAVIGATION_STARTED: 'NAVIGATION_STARTED',
  MAP_ENTERED: 'MAP_ENTERED',
  NAVIGATION_BLOCKED: 'NAVIGATION_BLOCKED',
  ROUTE_REPLANNED: 'ROUTE_REPLANNED',
  NPC_REACHED: 'NPC_REACHED',
  HOSTILE_THREAT_DETECTED: 'HOSTILE_THREAT_DETECTED',
  HOSTILE_AVOIDANCE_STARTED: 'HOSTILE_AVOIDANCE_STARTED',
  HOSTILE_SAFE_POSITION: 'HOSTILE_SAFE_POSITION',
  HOSTILE_DEFENSIVE_FALLBACK: 'HOSTILE_DEFENSIVE_FALLBACK',
  ROUTE_NODE_ENTERED: 'ROUTE_NODE_ENTERED',
  ROUTE_CHOICE_MADE: 'ROUTE_CHOICE_MADE',
  ROUTE_DEAD_END: 'ROUTE_DEAD_END',
  ROUTE_BACKTRACK: 'ROUTE_BACKTRACK',
  ROUTE_ENCOUNTER: 'ROUTE_ENCOUNTER',
  ROUTE_SHORTCUT_FOUND: 'ROUTE_SHORTCUT_FOUND',
});

const eventIdPattern = /^[A-Za-z0-9_.:-]{8,128}$/;

export class StaleAgentCallbackError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function assertIdentity(state, event) {
  if (!eventIdPattern.test(String(event?.eventId ?? '')))
    throw new TypeError('INVALID_AGENT_EVENT_ID');
  if (!Object.values(AgentEventType).includes(event?.type))
    throw new TypeError('INVALID_AGENT_EVENT_TYPE');
  const identity = event.identity ?? {};
  if (
    Number(identity.charId) !== Number(state.charId) ||
    Number(identity.accountId) !== Number(state.accountId)
  ) {
    throw new StaleAgentCallbackError('CHARACTER_IDENTITY_MISMATCH');
  }
  const lease = state.agentLease;
  if (!lease) throw new StaleAgentCallbackError('AGENT_LEASE_NOT_ACTIVE');
  if (
    identity.questSessionId !== lease.questSessionId ||
    identity.objectiveId !== lease.objectiveId ||
    Number(identity.generation) !== Number(lease.generation) ||
    Number(identity.sourceRevision) !== Number(lease.sourceRevision)
  ) {
    throw new StaleAgentCallbackError('STALE_AGENT_CALLBACK');
  }
}

function remember(state, event, next) {
  const processed = [...(state.processedAgentEvents ?? []), event.eventId].slice(
    -128,
  );
  return { ...next, processedAgentEvents: processed };
}

function progressStage(state, event) {
  const payload = structuredClone(event.payload ?? {});
  const type = payload.stageType ?? state.missionStage?.type ?? MissionStageType.NAVIGATION;
  return {
    ...state,
    missionStage: {
      ...state.missionStage,
      ...payload,
      type,
      agentEvent: event.type,
    },
    revision: Number(state.revision) + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function applyAgentEvent(state, event) {
  if ((state.processedAgentEvents ?? []).includes(event?.eventId)) {
    return { state, duplicate: true };
  }
  assertIdentity(state, event);
  let next;
  switch (event.type) {
    case AgentEventType.QUEST_OBJECTIVE_START:
    case AgentEventType.QUEST_OBJECTIVE_PROGRESS:
      next = progressStage(state, event);
      break;
    case AgentEventType.QUEST_OBJECTIVE_COMPLETE: {
      const transition = event.payload?.transition;
      if (!transition) {
        next = state.activeTrial &&
          state.currentObjective?.completionMode === ObjectiveCompletionMode.SERVER_AUTHORITY
          ? {
              ...progressStage(state, {
                ...event,
                payload: {
                  ...event.payload,
                  status: 'AWAITING_SERVER_AUTHORITY',
                },
              }),
              agentLease: null,
            }
          : {
              ...progressStage(state, event),
              questStatus: QuestStatus.READY,
              combatPolicy: state.previousCombatPolicy ?? state.combatPolicy,
              previousCombatPolicy: null,
              agentLease: null,
            };
      } else {
        next = completeQuestStep(state, transition);
      }
      break;
    }
    case AgentEventType.QUEST_OBJECTIVE_FAILED:
      next = state.activeTrial
        ? failTrial(state, { reason: event.payload?.reason ?? event.type })
        : markNeedsAttention(state, {
            reason: event.payload?.reason ?? event.type,
            detail: event.payload ?? null,
          });
      break;
    case AgentEventType.NEEDS_ATTENTION:
      next = markNeedsAttention(state, {
        reason: event.payload?.reason ?? event.type,
        detail: event.payload ?? null,
      });
      break;
    case AgentEventType.SUPPLY_PENDING:
      next = progressStage(state, {
        ...event,
        payload: { ...event.payload, stageType: state.missionStage?.type },
      });
      break;
    case AgentEventType.SUPPLY_ACTIVE:
      next = state.missionStage?.type === MissionStageType.SUPPLY
        ? progressStage(state, {
            ...event,
            payload: { ...event.payload, stageType: MissionStageType.SUPPLY },
          })
        : reachSafePoint(state, {
            temporaryObjective: event.payload?.temporaryObjective,
          });
      break;
    case AgentEventType.SUPPLY_COMPLETE:
      if (
        event.payload?.authorityConfirmed !== true ||
        event.payload?.preflightStatus !== PreflightStatus.PASS
      ) {
        next = markNeedsAttention(state, {
          reason: 'SUPPLY_AUTHORITY_NOT_CONFIRMED',
          detail: event.payload ?? null,
        });
      } else {
        next = completeSupply(state, {
          reservation: event.payload?.reservation,
        });
      }
      break;
    case AgentEventType.TRIAL_POLICY_APPLIED:
    case AgentEventType.TRIAL_POLICY_RELEASED:
    case AgentEventType.NAVIGATION_STARTED:
    case AgentEventType.MAP_ENTERED:
    case AgentEventType.NAVIGATION_BLOCKED:
    case AgentEventType.ROUTE_REPLANNED:
    case AgentEventType.NPC_REACHED:
    case AgentEventType.HOSTILE_THREAT_DETECTED:
    case AgentEventType.HOSTILE_AVOIDANCE_STARTED:
    case AgentEventType.HOSTILE_SAFE_POSITION:
    case AgentEventType.HOSTILE_DEFENSIVE_FALLBACK:
    case AgentEventType.ROUTE_NODE_ENTERED:
    case AgentEventType.ROUTE_CHOICE_MADE:
    case AgentEventType.ROUTE_DEAD_END:
    case AgentEventType.ROUTE_BACKTRACK:
    case AgentEventType.ROUTE_ENCOUNTER:
    case AgentEventType.ROUTE_SHORTCUT_FOUND:
      next = progressStage(state, event);
      break;
    case AgentEventType.CHARACTER_DEAD:
      next = recordDeath(state, event.payload);
      break;
    case AgentEventType.RESPAWNED:
      next = recoverAfterRespawn(state, event.payload?.authority);
      break;
    case AgentEventType.READY_TO_RESUME:
      next = {
        ...progressStage(state, event),
        questStatus: QuestStatus.READY,
      };
      break;
    default:
      throw new TypeError('INVALID_AGENT_EVENT_TYPE');
  }
  return {
    state: remember(state, event, recordAgentSemanticEvent(state, next, event)),
    duplicate: false,
  };
}

export function agentCommandFromState(state) {
  if (!state.agentLease) throw new Error('AGENT_LEASE_NOT_ACTIVE');
  return {
    protocolVersion: 1,
    identity: {
      charId: state.charId,
      accountId: state.accountId,
      questSessionId: state.agentLease.questSessionId,
      objectiveId: state.agentLease.objectiveId,
      generation: state.agentLease.generation,
      sourceRevision: state.agentLease.sourceRevision,
    },
    objective: structuredClone(state.currentObjective),
    missionStage: structuredClone(state.missionStage),
    interruptPolicy: state.interruptPolicy,
    combatPolicy: structuredClone(state.combatPolicy),
  };
}
