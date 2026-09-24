import { CommitType } from './contracts.mjs';
import { publicQuestState } from './runtime.mjs';
import { recordQuestTransition } from './event-log.mjs';
import { projectMissionInteractionStage } from './mission-interaction-contract.mjs';

export class JobQuestService {
  constructor({ runtimeService, bridge, adapter }) {
    if (!runtimeService || !bridge || !adapter) {
      throw new TypeError('job quest service dependencies are required');
    }
    this.runtimeService = runtimeService;
    this.bridge = bridge;
    this.adapter = adapter;
    this.adapterMetadata = Object.freeze({
      adapterId: adapter.id,
      displayName: adapter.displayName,
      steps: Object.freeze([...adapter.steps]),
    });
  }

  publicState(state) {
    const projected = publicQuestState(state);
    const adapterState = this.adapter.publicState(state);
    const adapterStatus = this.adapter.publicStatus(state);
    return {
      ...projected,
      missionStage: projectMissionInteractionStage({
        state,
        adapter: this.adapter,
        adapterState,
        adapterStatus,
        publicState: projected,
      }),
      adapterId: this.adapter.id,
      adapterMetadata: this.adapterMetadata,
      adapterState,
      adapterStatus,
    };
  }

  async reconcile(identity) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { state, authority } =
        await this.runtimeService.loadContext(identity);
      const adapterState = this.adapter.initializeState(state);
      const initialized =
        adapterState.adapterId === this.adapter.id
          ? adapterState
          : { ...adapterState, adapterId: this.adapter.id };
      const next = recordQuestTransition(
        initialized,
        this.adapter.reconcileState(initialized, authority),
      );
      const changed = next !== initialized || initialized !== state;
      if (!changed) {
        if (this.adapter.shouldAutoDispatch?.(state)) {
          const dispatched = await this.runtimeService.dispatchCurrentObjective(
            identity,
            this.bridge,
          );
          return this.publicStateFromPublic(dispatched.state, state);
        }
        return this.publicState({ ...state, authority });
      }
      try {
        const saved = await this.runtimeService.store.save(
          { ...next, authority },
          state.revision,
        );
        if (this.adapter.shouldAutoDispatch?.(saved)) {
          const dispatched = await this.runtimeService.dispatchCurrentObjective(
            identity,
            this.bridge,
          );
          return this.publicStateFromPublic(dispatched.state, saved);
        }
        return this.publicState(saved);
      } catch (error) {
        if (error?.code !== 'STALE_REVISION') throw error;
      }
    }
    throw new Error('STALE_REVISION');
  }

  publicStateFromPublic(publicState, persistedState) {
    const adapterState = this.adapter.publicState(persistedState);
    const adapterStatus = this.adapter.publicStatus(persistedState);
    return {
      ...publicState,
      missionStage: projectMissionInteractionStage({
        state: persistedState,
        adapter: this.adapter,
        adapterState,
        adapterStatus,
        publicState,
      }),
      adapterId: this.adapter.id,
      adapterMetadata: this.adapterMetadata,
      adapterState,
      adapterStatus,
    };
  }

  async setCareerTarget(identity, { careerTarget, expectedRevision }) {
    const { state, authority } =
      await this.runtimeService.loadContext(identity);
    if (Number(expectedRevision) !== Number(state.revision))
      throw new Error('STALE_REVISION');
    if (
      state.formalQuestStarted === true &&
      state.adapterId &&
      state.adapterId !== this.adapter.id
    ) {
      throw new Error('FORMAL_JOB_QUEST_ALREADY_STARTED');
    }
    const initialized = this.adapter.initializeState({ ...state, authority });
    const selected = {
      ...this.adapter.selectCareerTarget(initialized, careerTarget),
      adapterId: this.adapter.id,
    };
    const next = recordQuestTransition(initialized, selected);
    return this.publicState(
      await this.runtimeService.store.save(next, state.revision),
    );
  }

  async act(identity, { action, payload = {}, expectedRevision }) {
    const { state, authority } =
      await this.runtimeService.loadContext(identity);
    if (Number(expectedRevision) !== Number(state.revision))
      throw new Error('STALE_REVISION');
    const initialized = this.adapter.initializeState({ ...state, authority });
    const applied = this.adapter.prepareAction
      ? this.adapter.prepareAction({
          state: initialized,
          action,
          payload,
          authority,
        })
      : this.adapter.applyAction(initialized, action, payload, authority);
    const next = recordQuestTransition(initialized, applied);
    const saved = await this.runtimeService.store.save(next, state.revision);
    const shouldDispatch =
      Boolean(saved.currentObjective) &&
      [
        'GO_MAP',
        'SERVER_COMMAND',
        'SUPPLY',
        'COMBAT_HOLD',
        'NO_KILL_ROUTE',
      ].includes(saved.currentObjective.type);
    if (!shouldDispatch)
      return { questRuntime: this.publicState(saved), dispatch: null };
    const dispatched = await this.runtimeService.dispatchCurrentObjective(
      identity,
      this.bridge,
    );
    return {
      questRuntime: this.publicStateFromPublic(dispatched.state, saved),
      dispatch: dispatched.dispatch,
    };
  }

  async commit(identity, request) {
    const result = await this.runtimeService.commit(identity, {
      idempotencyKey: request.idempotencyKey,
      commitType: CommitType.JOB_CHANGE,
      expectedRevision: request.expectedRevision,
      payload: this.adapter.finalCommit.payload,
    });
    return { result, questRuntime: await this.reconcile(identity) };
  }
}
