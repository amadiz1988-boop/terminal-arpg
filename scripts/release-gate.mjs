import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { resolve } from 'node:path';

const npm = platform() === 'win32' ? 'npm.cmd' : 'npm';
const vinext = resolve(
  'node_modules',
  '.bin',
  platform() === 'win32' ? 'vinext.cmd' : 'vinext',
);
const port = Number(process.env.RELEASE_GATE_PORT ?? 3317);

function run(command, args, options = {}) {
  const {
    shell = platform() === 'win32' && command.toLowerCase().endsWith('.cmd'),
    ...rest
  } = options;
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell, ...rest });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Local site did not start at ${url}`);
}

await run(npm, ['test']);
await run(npm, ['run', 'test:item-localization']);
await run(npm, ['run', 'lint']);
await run(npm, ['run', 'build']);

const url = `http://127.0.0.1:${port}/?fresh=1`;
const server = spawn(vinext, ['dev', '--port', String(port)], {
  stdio: 'inherit',
  shell: platform() === 'win32',
});
try {
  await waitForServer(url);
  await run(process.execPath, ['scripts/ui-qa.mjs'], {
    env: { ...process.env, QA_URL: url },
  });
} finally {
  if (platform() === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  else server.kill('SIGTERM');
}

console.log('RELEASE_GATE_PASS');
