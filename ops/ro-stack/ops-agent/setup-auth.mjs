import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { createCredentialRecord, writeCredentialRecord } from './auth.mjs';
import { loadOpsAgentConfig } from './config.mjs';

export async function initializeOpsAgentAuth({ force = false, username = 'admin' } = {}) {
  const config = await loadOpsAgentConfig();
  if (!force) {
    try {
      await access(config.authFile);
      return { created: false, username, credentialFile: config.authFile };
    } catch {}
  }
  const { password, record } = createCredentialRecord({ username });
  await writeCredentialRecord(config.authFile, record);
  return {
    created: true,
    username: record.username,
    password,
    credentialFile: config.authFile,
  };
}

const launchedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  const command = process.argv[2] ?? 'initialize';
  if (!['initialize', 'rotate'].includes(command)) {
    throw new Error('Usage: node setup-auth.mjs initialize|rotate');
  }
  const result = await initializeOpsAgentAuth({ force: command === 'rotate' });
  if (!result.created) {
    console.log('OPS_AGENT_AUTH_ALREADY_INITIALIZED');
  } else {
    console.log(`OPS_AGENT_ADMIN_USERNAME=${result.username}`);
    console.log(`OPS_AGENT_ADMIN_PASSWORD=${result.password}`);
    console.log('Save this password now. It is not stored in plaintext.');
  }
}
