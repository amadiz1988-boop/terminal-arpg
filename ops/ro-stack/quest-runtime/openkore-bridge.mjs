import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agentCommandFromState } from './agent-events.mjs';

function instanceId(accountId) {
  return `player_${Number(accountId)}`;
}

export class OpenKoreQuestBridge {
  constructor({ instancesRoot, service, watchLeaseMs = 600_000, clock = Date.now }) {
    if (!instancesRoot || !service) throw new TypeError('bridge dependencies required');
    this.instancesRoot = instancesRoot;
    this.service = service;
    this.watchLeaseMs = watchLeaseMs;
    this.clock = clock;
    this.watchedAccounts = new Map();
  }

  watchAccount(accountId) {
    this.watchedAccounts.set(
      Number(accountId),
      this.clock() + this.watchLeaseMs,
    );
  }

  async dispatch(state) {
    this.watchAccount(state.accountId);
    const command = agentCommandFromState(state);
    const commandId = randomUUID();
    const directory = join(
      this.instancesRoot,
      instanceId(state.accountId),
      'commands',
    );
    await mkdir(directory, { recursive: true });
    const pending = join(directory, `${commandId}.pending`);
    const target = join(directory, `${commandId}.cmd`);
    await writeFile(
      pending,
      `quest_runtime_apply\n${JSON.stringify(command)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    await rename(pending, target);
    return { commandId, command };
  }

  async consumeAccount(accountId) {
    const directory = join(
      this.instancesRoot,
      instanceId(accountId),
      'quest-events',
    );
    let names;
    try {
      names = (await readdir(directory)).filter((name) => name.endsWith('.event'));
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    const results = [];
    for (const name of names.sort()) {
      const path = join(directory, name);
      try {
        const event = JSON.parse(await readFile(path, 'utf8'));
        const result = await this.service.applyAgentCallback(event);
        results.push({ name, ...result });
      } catch (error) {
        results.push({ name, rejected: true, reason: error?.code ?? error?.message });
      } finally {
        await unlink(path).catch(() => {});
      }
    }
    if (results.length) this.watchAccount(accountId);
    return results;
  }

  async refreshWatchedAccounts() {
    let entries;
    try {
      entries = await readdir(this.instancesRoot, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return this.watchedAccounts.size;
      throw error;
    }
    for (const entry of entries) {
      const match = entry.isDirectory() && entry.name.match(/^player_(\d+)$/);
      if (!match) continue;
      try {
        const events = await readdir(
          join(this.instancesRoot, entry.name, 'quest-events'),
        );
        if (events.some((name) => name.endsWith('.event')))
          this.watchAccount(match[1]);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    return this.watchedAccounts.size;
  }

  async consumeWatchedAccounts() {
    const results = [];
    const now = this.clock();
    for (const [accountId, expiresAt] of [...this.watchedAccounts]) {
      if (expiresAt <= now) {
        this.watchedAccounts.delete(accountId);
        continue;
      }
      results.push(...(await this.consumeAccount(accountId)));
    }
    return results;
  }

  watchedAccountCount() {
    return this.watchedAccounts.size;
  }
}
