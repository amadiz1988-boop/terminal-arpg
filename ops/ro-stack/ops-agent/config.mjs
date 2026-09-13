import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function parsePowerShellData(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|(\d+)|\$(true|false))\s*$/i,
    );
    if (!match) continue;
    if (match[2] != null) values[match[1]] = match[2];
    else if (match[3] != null) values[match[1]] = Number(match[3]);
    else values[match[1]] = match[4].toLowerCase() === 'true';
  }
  return values;
}

function validPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('Ops Agent port is invalid');
  }
  return port;
}

export async function loadOpsAgentConfig(overrides = {}) {
  const projectRoot = resolve(
    overrides.projectRoot ?? process.env.OPS_AGENT_PROJECT_ROOT ?? moduleRoot,
  );
  const stackConfigPath = join(
    projectRoot,
    'ops',
    'ro-stack',
    'stack.config.psd1',
  );
  let stack = {};
  try {
    stack = parsePowerShellData(await readFile(stackConfigPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const runtimeRoot = resolve(
    overrides.runtimeRoot ??
      process.env.OPS_AGENT_RUNTIME_ROOT ??
      join(projectRoot, '.local', 'ro-stack'),
  );
  return Object.freeze({
    projectRoot,
    runtimeRoot,
    host: overrides.host ?? process.env.OPS_AGENT_HOST ?? '127.0.0.1',
    port: validPort(overrides.port ?? process.env.OPS_AGENT_PORT, 8790),
    timeoutMs: Number(overrides.timeoutMs ?? process.env.OPS_AGENT_TIMEOUT_MS ?? 2500),
    staleHeartbeatMs: Number(
      overrides.staleHeartbeatMs ??
        process.env.OPS_AGENT_STALE_HEARTBEAT_MS ??
        30000,
    ),
    mariaDbService: stack.MariaDbService ?? 'GhostIslandROMariaDB',
    mariaDbPort: validPort(stack.MariaDbPort, 3307),
    databaseUser: stack.DatabaseUser ?? 'rathena_local',
    mainDatabase: stack.MainDatabase ?? 'ragnarok',
    loginPort: validPort(stack.LoginPort, 6901),
    characterPort: validPort(stack.CharacterPort, 6122),
    mapPort: validPort(stack.MapPort, 5122),
    dashboardPort: validPort(overrides.dashboardPort, 8788),
  });
}

export const __test = Object.freeze({ parsePowerShellData });
