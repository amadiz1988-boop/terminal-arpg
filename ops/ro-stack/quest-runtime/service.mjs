import { CommitType } from './contracts.mjs';
import {
  bindObjectiveToAgent,
  normalizeAuthority,
  publicQuestState,
  reconcileRestart,
  setCareerTarget,
} from './runtime.mjs';
import { applyAgentEvent, StaleAgentCallbackError } from './agent-events.mjs';
import {
  appendQuestSemanticEvent,
  QuestSemanticEventType,
  recordQuestTransition,
} from './event-log.mjs';

const idempotencyKeyPattern = /^[A-Za-z0-9_.:-]{8,128}$/;

export class QuestRuntimeService {
  constructor({
    store,
    authorityReader,
    authoritativeCommitters = {},
    deathRetryThreshold = 3,
  }) {
    if (!store || typeof authorityReader !== 'function')
      throw new TypeError('store and authorityReader are required');
    this.store = store;
    this.authorityReader = authorityReader;
    this.authoritativeCommitters = authoritativeCommitters;
    this.deathRetryThreshold = deathRetryThreshold;
  }

  async loadContext({ charId, accountId }) {
    const existing = await this.store.load(charId, accountId);
    const authority = normalizeAuthority(
      await this.authorityReader({
        charId,
        accountId,
        questId: existing?.questId ?? null,
        adapterId: existing?.adapterId ?? existing?.careerTarget ?? null,
      }),
    );
    const state =
      existing ??
      (await this.store.loadOrCreate({
        charId,
        accountId,
        authority,
        deathRetryThreshold: this.deathRetryThreshold,
      }));
    return { state: { ...state, authority }, authority };
  }

  async readPublicState(identity) {
    const { state } = await this.loadContext(identity);
    return publicQuestState(state);
  }

  async updateCareerTarget(identity, { careerTarget, expectedRevision }) {
    const { state } = await this.loadContext(identity);
    if (Number(expectedRevision) !== state.revision)
      throw new Error('STALE_REVISION');
    const next = setCareerTarget(state, careerTarget);
    return publicQuestState(await this.store.save(next, state.revision));
  }

  async recoverAfterProcessRestart(identity) {
    const { state, authority } = await this.loadContext(identity);
    let next = recordQuestTransition(state, reconcileRestart(state, authority));
    next = appendQuestSemanticEvent(
      next,
      QuestSemanticEventType.RUNTIME_STATE_RESTORED,
      { checkpoint: next.checkpoint },
      { dedupKey: `restart:${next.objectiveGeneration}`, throttleMs: 0 },
    );
    if (state.activeTrial && !next.activeTrial) {
      next = appendQuestSemanticEvent(
        next,
        QuestSemanticEventType.TRIAL_RESET_TO_CHECKPOINT,
        { checkpoint: next.checkpoint },
        { dedupKey: `trial-restart:${next.objectiveGeneration}`, throttleMs: 0 },
      );
    }
    return publicQuestState(await this.store.save(next, state.revision));
  }

  async dispatchCurrentObjective(identity, bridge) {
    let lastError;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { state } = await this.loadContext(identity);
      const leased = bindObjectiveToAgent(state);
      try {
        const saved = await this.store.save(leased, state.revision);
        const dispatch = await bridge.dispatch(saved);
        return { state: publicQuestState(saved), dispatch };
      } catch (error) {
        lastError = error;
        if (error?.code !== 'STALE_REVISION') throw error;
      }
    }
    throw lastError;
  }

  async applyAgentCallback(event) {
    const identity = event?.identity ?? {};
    const runtimeIdentity = {
      charId: Number(identity.charId),
      accountId: Number(identity.accountId),
    };
    let lastError;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { state } = await this.loadContext(runtimeIdentity);
      let applied;
      try {
        applied = applyAgentEvent(state, event);
      } catch (error) {
        if (!(error instanceof StaleAgentCallbackError)) throw error;
        const recorded = appendQuestSemanticEvent(
          state,
          QuestSemanticEventType.STALE_CALLBACK_IGNORED,
          { reason: error.code },
          {
            dedupKey: `stale:${state.objectiveGeneration}:${error.code}`,
            throttleMs: 15_000,
          },
        );
        if (recorded === state)
          return { duplicate: false, stale: true, state: publicQuestState(state) };
        try {
          const saved = await this.store.save(recorded, state.revision);
          return { duplicate: false, stale: true, state: publicQuestState(saved) };
        } catch (saveError) {
          lastError = saveError;
          if (saveError?.code === 'STALE_REVISION') continue;
          throw saveError;
        }
      }
      if (applied.duplicate)
        return { duplicate: true, state: publicQuestState(state) };
      try {
        const saved = await this.store.save(applied.state, state.revision);
        return { duplicate: false, state: publicQuestState(saved) };
      } catch (error) {
        lastError = error;
        if (error?.code !== 'STALE_REVISION') throw error;
      }
    }
    throw lastError;
  }

  async commit(identity, request) {
    if (!idempotencyKeyPattern.test(request?.idempotencyKey ?? ''))
      throw new Error('INVALID_IDEMPOTENCY_KEY');
    if (!Object.values(CommitType).includes(request?.commitType))
      throw new Error('INVALID_COMMIT_TYPE');
    const committer = this.authoritativeCommitters[request.commitType];
    if (typeof committer !== 'function')
      throw new Error('COMMITTER_NOT_AVAILABLE');
    const claim = await this.store.claimCommit({
      charId: identity.charId,
      idempotencyKey: request.idempotencyKey,
      commitType: request.commitType,
      payload: request.payload,
      expectedRevision: request.expectedRevision,
    });
    if (claim.completed) return { ...claim.result, deduplicated: true };
    try {
      const { state, authority } = await this.loadContext(identity);
      if (Number(request.expectedRevision) !== state.revision)
        throw new Error('STALE_REVISION');
      const reservedState = await this.store.save(
        { ...state, authority, updatedAt: new Date().toISOString() },
        state.revision,
      );
      const result = await committer({
        identity: structuredClone(identity),
        authority: structuredClone(authority),
        payload: structuredClone(request.payload),
        commitRevision: reservedState.revision,
      });
      if (!result?.verified) throw new Error('SERVER_VERIFICATION_FAILED');
      const committedResult = {
        ...result,
        questRevision: reservedState.revision,
      };
      await this.store.completeCommit({
        charId: identity.charId,
        idempotencyKey: request.idempotencyKey,
        claimToken: claim.claimToken,
        result: committedResult,
      });
      return { ...committedResult, deduplicated: false };
    } catch (error) {
      await this.store.failCommit({
        charId: identity.charId,
        idempotencyKey: request.idempotencyKey,
        claimToken: claim.claimToken,
        errorCode: error?.message ?? 'COMMIT_FAILED',
      });
      throw error;
    }
  }
}
