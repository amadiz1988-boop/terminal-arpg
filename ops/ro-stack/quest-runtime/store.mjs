import { createHash, randomUUID } from 'node:crypto';
import { createQuestState } from './runtime.mjs';

export class QuestRuntimeConflictError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function escapeSql(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "''");
}

function encode(value) {
  return escapeSql(JSON.stringify(value));
}

function parseStateRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  const state = JSON.parse(Buffer.from(row[2], 'hex').toString('utf8'));
  const active = state.questId && state.currentStep;
  return {
    ...state,
    stateVersion: 2,
    questSessionId:
      state.questSessionId ??
      (active
        ? `legacy:${Number(row[1])}:${Number(row[0])}:${Number(state.questId)}`
        : null),
    objectiveId: state.objectiveId ?? state.currentStep?.id ?? null,
    objectiveGeneration:
      Number(state.objectiveGeneration) || (active ? 1 : 0),
    agentLease: state.agentLease ?? null,
    processedAgentEvents: Array.isArray(state.processedAgentEvents)
      ? state.processedAgentEvents
      : [],
    charId: Number(row[0]),
    accountId: Number(row[1]),
    revision: Number(row[3]),
    updatedAt: row[4],
  };
}

export class MariaDbQuestRuntimeStore {
  constructor({ sql }) {
    if (typeof sql !== 'function') throw new TypeError('sql is required');
    this.sql = sql;
  }

  async load(charId, accountId) {
    const output = await this.sql(
      `SELECT char_id,account_id,HEX(state_json),revision,updated_at FROM web_quest_runtime WHERE char_id=${Number(charId)} AND account_id=${Number(accountId)} LIMIT 1;`,
    );
    return parseStateRow(output);
  }

  async loadOrCreate({ charId, accountId, authority, deathRetryThreshold }) {
    let state = await this.load(charId, accountId);
    if (state) return state;
    const initial = createQuestState({
      charId,
      accountId,
      authority,
      deathRetryThreshold,
    });
    await this.sql(
      `INSERT IGNORE INTO web_quest_runtime (char_id,account_id,state_json,revision,state_version,updated_at) VALUES (${Number(charId)},${Number(accountId)},'${encode(initial)}',0,${Number(initial.stateVersion)},CURRENT_TIMESTAMP(3));`,
    );
    state = await this.load(charId, accountId);
    if (!state) throw new Error('QUEST_RUNTIME_CREATE_FAILED');
    return state;
  }

  async save(nextState, expectedRevision) {
    const persisted = { ...nextState, revision: Number(expectedRevision) + 1 };
    const output = await this.sql(
      `UPDATE web_quest_runtime SET state_json='${encode(persisted)}',revision=revision+1,state_version=${Number(persisted.stateVersion)},updated_at=CURRENT_TIMESTAMP(3) WHERE char_id=${Number(persisted.charId)} AND account_id=${Number(persisted.accountId)} AND revision=${Number(expectedRevision)}; SELECT ROW_COUNT();`,
    );
    if (Number(output.split(/\r?\n/).at(-1)) !== 1) {
      throw new QuestRuntimeConflictError('STALE_REVISION');
    }
    return await this.load(persisted.charId, persisted.accountId);
  }

  async claimCommit({
    charId,
    idempotencyKey,
    commitType,
    payload,
    expectedRevision,
  }) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const claimToken = randomUUID();
    await this.sql(
      `INSERT IGNORE INTO web_quest_commit (idempotency_key,char_id,commit_type,payload_hash,expected_revision,commit_status,requested_at) VALUES ('${escapeSql(idempotencyKey)}',${Number(charId)},'${escapeSql(commitType)}','${payloadHash}',${Number(expectedRevision)},'PENDING',CURRENT_TIMESTAMP(3)); UPDATE web_quest_commit SET claim_token='${claimToken}',commit_status='EXECUTING',started_at=CURRENT_TIMESTAMP(3) WHERE idempotency_key='${escapeSql(idempotencyKey)}' AND char_id=${Number(charId)} AND payload_hash='${payloadHash}' AND expected_revision=${Number(expectedRevision)} AND commit_status='PENDING' AND claim_token IS NULL;`,
    );
    const output = await this.sql(
      `SELECT commit_type,payload_hash,expected_revision,commit_status,COALESCE(claim_token,''),HEX(COALESCE(result_json,'')),COALESCE(error_code,'') FROM web_quest_commit WHERE idempotency_key='${escapeSql(idempotencyKey)}' AND char_id=${Number(charId)} LIMIT 1;`,
    );
    if (!output) throw new Error('COMMIT_RESERVATION_FAILED');
    const row = output.split('\t');
    if (
      row[0] !== commitType ||
      row[1] !== payloadHash ||
      Number(row[2]) !== Number(expectedRevision)
    ) {
      throw new QuestRuntimeConflictError('IDEMPOTENCY_KEY_REUSED');
    }
    if (row[3] === 'COMPLETED') {
      return {
        owner: false,
        completed: true,
        result: row[5]
          ? JSON.parse(Buffer.from(row[5], 'hex').toString('utf8'))
          : null,
      };
    }
    if (row[3] === 'FAILED')
      throw new QuestRuntimeConflictError(row[6] || 'COMMIT_FAILED');
    if (row[4] !== claimToken)
      throw new QuestRuntimeConflictError('COMMIT_IN_PROGRESS');
    return { owner: true, completed: false, claimToken };
  }

  async completeCommit({ charId, idempotencyKey, claimToken, result }) {
    const output = await this.sql(
      `UPDATE web_quest_commit SET commit_status='COMPLETED',result_json='${encode(result)}',completed_at=CURRENT_TIMESTAMP(3) WHERE idempotency_key='${escapeSql(idempotencyKey)}' AND char_id=${Number(charId)} AND claim_token='${escapeSql(claimToken)}' AND commit_status='EXECUTING'; SELECT ROW_COUNT();`,
    );
    if (Number(output.split(/\r?\n/).at(-1)) !== 1)
      throw new QuestRuntimeConflictError('COMMIT_OWNERSHIP_LOST');
  }

  async failCommit({ charId, idempotencyKey, claimToken, errorCode }) {
    await this.sql(
      `UPDATE web_quest_commit SET commit_status='FAILED',error_code='${escapeSql(errorCode)}',completed_at=CURRENT_TIMESTAMP(3) WHERE idempotency_key='${escapeSql(idempotencyKey)}' AND char_id=${Number(charId)} AND claim_token='${escapeSql(claimToken)}' AND commit_status='EXECUTING';`,
    );
  }
}

export class MemoryQuestRuntimeStore {
  constructor() {
    this.states = new Map();
    this.commits = new Map();
  }

  key(charId, accountId) {
    return `${accountId}:${charId}`;
  }

  async load(charId, accountId) {
    return structuredClone(
      this.states.get(this.key(charId, accountId)) ?? null,
    );
  }

  async loadOrCreate(options) {
    const key = this.key(options.charId, options.accountId);
    if (!this.states.has(key)) this.states.set(key, createQuestState(options));
    return structuredClone(this.states.get(key));
  }

  async save(nextState, expectedRevision) {
    const key = this.key(nextState.charId, nextState.accountId);
    const current = this.states.get(key);
    if (!current || current.revision !== expectedRevision)
      throw new QuestRuntimeConflictError('STALE_REVISION');
    const saved = structuredClone({
      ...nextState,
      revision: expectedRevision + 1,
    });
    this.states.set(key, saved);
    return structuredClone(saved);
  }

  async claimCommit({
    charId,
    idempotencyKey,
    commitType,
    payload,
    expectedRevision,
  }) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const key = `${charId}:${idempotencyKey}`;
    const existing = this.commits.get(key);
    if (existing) {
      if (
        existing.commitType !== commitType ||
        existing.payloadHash !== payloadHash ||
        existing.expectedRevision !== expectedRevision
      ) {
        throw new QuestRuntimeConflictError('IDEMPOTENCY_KEY_REUSED');
      }
      if (existing.status === 'COMPLETED')
        return {
          owner: false,
          completed: true,
          result: structuredClone(existing.result),
        };
      if (existing.status === 'FAILED')
        throw new QuestRuntimeConflictError(
          existing.errorCode || 'COMMIT_FAILED',
        );
      throw new QuestRuntimeConflictError('COMMIT_IN_PROGRESS');
    }
    const claimToken = randomUUID();
    this.commits.set(key, {
      commitType,
      payloadHash,
      expectedRevision,
      status: 'EXECUTING',
      claimToken,
    });
    return { owner: true, completed: false, claimToken };
  }

  async completeCommit({ charId, idempotencyKey, claimToken, result }) {
    const commit = this.commits.get(`${charId}:${idempotencyKey}`);
    if (
      !commit ||
      commit.claimToken !== claimToken ||
      commit.status !== 'EXECUTING'
    ) {
      throw new QuestRuntimeConflictError('COMMIT_OWNERSHIP_LOST');
    }
    Object.assign(commit, {
      status: 'COMPLETED',
      result: structuredClone(result),
    });
  }

  async failCommit({ charId, idempotencyKey, claimToken, errorCode }) {
    const commit = this.commits.get(`${charId}:${idempotencyKey}`);
    if (commit?.claimToken === claimToken)
      Object.assign(commit, { status: 'FAILED', errorCode });
  }
}
