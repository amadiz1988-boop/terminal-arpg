import { randomUUID } from 'node:crypto';
import { agentCommandFromState } from './agent-events.mjs';

// P2I native Quest Runtime transport for SERVER_AGENT characters.
//
// This replaces the OpenKore `.pending`/`.cmd`/`.event` file transport with the
// canonical `persistent_agent_command` queue. It is a TRANSPORT only:
//   - it translates a resolved quest objective into a generic Persistent Agent
//     execution primitive (today: run_server_command / start_navigation),
//   - it enqueues that primitive at the current authoritative agent revision,
//   - it never marks quest progress itself. Progress is derived exclusively from
//     rAthena authority through the Quest Runtime reconcile path.
//
// Job/adapter-specific command names stay in the Quest Runtime adapters; the
// Persistent Agent executes them generically and the bound rAthena NPC script
// remains the sole authority for the mutation.

const commandNamePattern = /^[a-z][a-z0-9_]{0,30}$/;
const argumentPattern = /^[A-Za-z0-9_.:-]{1,64}$/;
const mapPattern = /^[a-z0-9_]{1,31}$/;

export class ServerAgentQuestBridge {
  constructor({ enqueueCommand, readAgentStateRevision, clock = Date.now }) {
    if (typeof enqueueCommand !== 'function')
      throw new TypeError('server agent quest bridge requires enqueueCommand');
    if (typeof readAgentStateRevision !== 'function')
      throw new TypeError('server agent quest bridge requires readAgentStateRevision');
    this.enqueueCommand = enqueueCommand;
    this.readAgentStateRevision = readAgentStateRevision;
    this.clock = clock;
  }

  async dispatch(state) {
    const command = agentCommandFromState(state);
    const translated = translateQuestObjective(command.objective);
    if (translated.reconcileOnly)
      return {
        commandId: null,
        action: null,
        payload: {},
        transport: 'reconcile',
        reconcileOnly: true,
        command: {
          protocolVersion: command.protocolVersion,
          identity: command.identity,
          action: null,
        },
      };
    const expectedRevision = Number(
      await this.readAgentStateRevision(Number(state.charId)),
    );
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      throw new Error('AGENT_STATE_UNAVAILABLE');
    const commandId = randomUUID();
    const payload =
      translated.payload === undefined
        ? {}
        : structuredClone(translated.payload);
    await this.enqueueCommand({
      charId: Number(state.charId),
      accountId: Number(state.accountId),
      action: translated.action,
      payload,
      expectedRevision,
      commandId,
    });
    return {
      commandId,
      action: translated.action,
      payload,
      transport: 'persistent_agent_command',
      command: {
        protocolVersion: command.protocolVersion,
        identity: command.identity,
        action: translated.action,
      },
    };
  }

  // Native progress is observed from rAthena authority (Quest Runtime reconcile),
  // never from a callback file. These methods keep the bridge surface compatible
  // with the OpenKore bridge so the callback pump can stay unchanged.
  async consumeAccount() {
    return [];
  }

  async refreshWatchedAccounts() {
    return 0;
  }

  async consumeWatchedAccounts() {
    return [];
  }

  watchedAccountCount() {
    return 0;
  }

  watchAccount() {}
}

export function translateQuestObjective(objective) {
  if (!objective || typeof objective !== 'object')
    throw new Error('QUEST_OBJECTIVE_INVALID');
  if (objective.type === 'SERVER_COMMAND')
    return translateServerCommand(objective);
  if (objective.type === 'GO_MAP') return translateGoMap(objective);
  if (objective.type === 'NO_KILL_ROUTE') return translateNoKillRoute(objective);
  throw new Error(`QUEST_OBJECTIVE_NOT_NATIVE:${String(objective.type ?? 'UNKNOWN')}`);
}

// NO_KILL_ROUTE is orchestrated in ordered phases by the Quest Runtime (Assassin
// adapter): the bridge only translates the current phase into a generic
// primitive. Phase rules and native authority stay in the adapter; no quest
// numbers or job rules live here.
function translateNoKillRoute(objective) {
  const noKillPhase = String(objective.noKillPhase ?? '');
  if (noKillPhase === 'START_PENDING')
    return translateServerCommand(objective);
  if (noKillPhase === 'NAVIGATING') return translateGoMap(objective);
  if (noKillPhase === 'RECONCILING') return { reconcileOnly: true };
  throw new Error(`QUEST_NO_KILL_PHASE_INVALID:${noKillPhase || 'MISSING'}`);
}

function translateServerCommand(objective) {
  const serverCommand = objective.serverCommand;
  if (!serverCommand || typeof serverCommand !== 'object')
    throw new Error('QUEST_SERVER_COMMAND_MISSING');
  const name = String(serverCommand.name ?? '');
  if (!commandNamePattern.test(name))
    throw new Error('QUEST_SERVER_COMMAND_INVALID');
  const args = Array.isArray(serverCommand.arguments)
    ? serverCommand.arguments.map((value) => String(value))
    : [];
  if (
    args.length > 16 ||
    args.some((value) => !argumentPattern.test(value))
  )
    throw new Error('QUEST_SERVER_COMMAND_ARGUMENTS_INVALID');
  const payload = { command: name };
  if (args.length) payload.arguments = args.join(' ');
  return { action: 'run_server_command', payload };
}

function translateGoMap(objective) {
  const map = String(objective.map ?? '');
  const x = Number(objective.x);
  const y = Number(objective.y);
  if (!mapPattern.test(map) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y))
    throw new Error('QUEST_GO_MAP_INVALID');
  // A route objective that expects native threat avoidance / rerouting is not
  // expressible through the generic navigation primitive. Fail closed instead of
  // silently downgrading the trial semantics.
  const waypoints = Array.isArray(objective.waypoints) ? objective.waypoints : [];
  if (
    objective.unavoidableThreatPolicy ||
    objective.blockedThreatRange ||
    objective.threatPolicy
  )
    throw new Error('QUEST_GO_MAP_THREAT_POLICY_NOT_NATIVE');
  const route = waypoints.length
    ? waypoints.map((point) => {
        const waypointMap = String(point?.map ?? map);
        const waypointX = Number(point?.x);
        const waypointY = Number(point?.y);
        if (
          !mapPattern.test(waypointMap) ||
          !Number.isSafeInteger(waypointX) ||
          !Number.isSafeInteger(waypointY)
        )
          throw new Error('QUEST_GO_MAP_WAYPOINT_INVALID');
        return { map: waypointMap, x: waypointX, y: waypointY };
      })
    : [{ map, x, y }];
  return { action: 'start_navigation', payload: { route } };
}
