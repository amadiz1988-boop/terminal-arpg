// Real long-lived child test for the Native lifecycle start contract.
// Node -> Windows PowerShell 5.1 -> Invoke-BoundedLauncher -> launcher ->
// long-lived service, matching the Production I/O topology in isolation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtimeAdapter } from '../deploy-native-candidate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OWNER = 'F\uFF5CM1 \u6700\u7D42\u6574\u5408';
const LEASE = '00000000-0000-4000-8000-00000000f00d';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-start-adapter-'));
const started = [];
let count = 0;
const test = async (name, fn) => { await fn(); console.log(`PASS ${++count} ${name}`); };
const freePort = () => new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const accepts = port => new Promise(resolve => { const c = net.connect(port, '127.0.0.1', () => { c.destroy(); resolve(true); }); c.on('error', () => resolve(false)); });
async function fixture(mode, owner = OWNER) {
  const root = fs.mkdtempSync(path.join(tmp, mode + '-'));
  fs.mkdirSync(path.join(root, 'logs'));
  for (const name of ['launcher.ps1', 'service.ps1']) fs.copyFileSync(path.join(here, 'native-start-fixture-' + name), path.join(root, name));
  fs.writeFileSync(path.join(root, 'mode.txt'), mode);
  const port = await freePort(); fs.writeFileSync(path.join(root, 'port.txt'), String(port));
  fs.writeFileSync(path.join(root, 'lease.json'), JSON.stringify({ lease_id: LEASE, owner_task_id: owner }));
  return { root, port };
}
const serviceIds = root => { const f = path.join(root, 'state.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).processes.map(p => p.id) : []; };
async function start(f, { owner = OWNER, timeout } = {}) {
  if (timeout) process.env.FIXTURE_LAUNCHER_TIMEOUT = String(timeout); else delete process.env.FIXTURE_LAUNCHER_TIMEOUT;
  const adapter = runtimeAdapter(f.root, owner, LEASE, { logRoot: path.join(f.root, 'caller-logs'), script: path.join(here, 'native-start-adapter-probe.ps1') });
  const t = Date.now(); let error = null;
  try { await adapter('start'); } catch (e) { error = e.message; }
  started.push(...serviceIds(f.root));
  return { elapsed: Date.now() - t, error };
}
// A PowerShell 7 style module root that shadows Microsoft.PowerShell.Utility.
function pollutedModuleRoot() {
  const dir = path.join(tmp, 'ps7-modules', 'Microsoft.PowerShell.Utility');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Microsoft.PowerShell.Utility.psd1'), "@{ ModuleVersion = '99.0'; FunctionsToExport = @(); CmdletsToExport = @() }");
  return path.dirname(dir);
}

try {
  await test('control: pipe-captured launcher blocks while the service lives (root cause)', async () => {
    const f = await fixture('alive-stdout');
    const t = Date.now();
    const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '${path.join(f.root, 'launcher.ps1')}' -Action start | Out-Host`],
      { windowsHide: true, timeout: 10000, stdio: 'pipe' });
    started.push(...serviceIds(f.root));
    assert.equal(r.error?.code, 'ETIMEDOUT'); assert.ok(Date.now() - t >= 9500);
    assert.ok(serviceIds(f.root).every(alive));
    console.log('ROOT_CAUSE_REPRODUCED=INHERITED_STDIO_HANDLE');
  });
  await test('1 service starts and remains alive -> bounded success', async () => {
    const f = await fixture('alive-both'); const r = await start(f);
    assert.equal(r.error, null); assert.ok(r.elapsed < 30000, String(r.elapsed));
    const ids = serviceIds(f.root); assert.equal(ids.length, 1); assert.ok(alive(ids[0])); assert.equal(await accepts(f.port), true);
  });
  await test('2 service exits immediately with failure -> FAIL', async () => {
    const f = await fixture('exit-fail'); const r = await start(f);
    assert.equal(r.error, 'NATIVE_RUNTIME_START_FAILED'); assert.ok(r.elapsed < 30000);
  });
  await test('3 service never reaches listener -> FAIL', async () => {
    const f = await fixture('never-ready'); const r = await start(f);
    assert.equal(r.error, 'NATIVE_RUNTIME_START_FAILED'); assert.ok(r.elapsed < 30000);
  });
  await test('4 stdout remains active after start -> caller returns', async () => {
    const f = await fixture('alive-stdout'); const r = await start(f);
    assert.equal(r.error, null); assert.ok(r.elapsed < 30000);
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.match(fs.readFileSync(path.join(f.root, 'logs', 'service.out.log'), 'utf8'), /tick \d+/);
  });
  await test('5 stderr remains active after start -> caller returns', async () => {
    const f = await fixture('alive-stderr'); const r = await start(f);
    assert.equal(r.error, null); assert.ok(r.elapsed < 30000);
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.match(fs.readFileSync(path.join(f.root, 'logs', 'service.err.log'), 'utf8'), /err \d+/);
  });
  await test('6 launcher timeout before health -> FAIL', async () => {
    const f = await fixture('hang'); const r = await start(f, { timeout: 4 });
    assert.equal(r.error, 'NATIVE_RUNTIME_START_FAILED'); assert.ok(r.elapsed < 20000, String(r.elapsed));
  });
  await test('7 second runtime attempt -> BLOCKED', async () => {
    const f = await fixture('alive-stdout'); assert.equal((await start(f)).error, null);
    const first = serviceIds(f.root);
    const r = await start(f); assert.equal(r.error, 'NATIVE_RUNTIME_START_FAILED');
    assert.deepEqual(serviceIds(f.root), first);
  });
  await test('8 PowerShell 5.1 module path normalized -> Get-FileHash available', async () => {
    const saved = process.env.PSModulePath; process.env.PSModulePath = pollutedModuleRoot() + ';' + (saved || '');
    try {
      const raw = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) { exit 0 } else { exit 7 }'], { windowsHide: true, env: process.env });
      const f = await fixture('alive-stdout'); const r = await start(f);
      assert.equal(r.error, null);
      assert.equal(raw.status, 7, 'inherited PowerShell 7 module path must reproduce the missing Get-FileHash');
      console.log(`INHERITED_PSMODULEPATH_GET_FILEHASH_EXIT=${raw.status}`);
    } finally { if (saved === undefined) delete process.env.PSModulePath; else process.env.PSModulePath = saved; }
  });
  await test('9 Unicode lease owner preserved through Node -> PowerShell 5.1', async () => {
    const f = await fixture('alive-stdout'); assert.equal((await start(f)).error, null);
    const g = await fixture('alive-stdout'); assert.equal((await start(g, { owner: 'F\uFF5CM1 \u6700\u7D42\u6574\u7406' })).error, 'NATIVE_RUNTIME_START_FAILED');
  });
  await test('10 ProcDump current identity contract passes in PowerShell 5.1', async () => {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'test-procdump-process-identity.ps1')], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /PROCDUMP_IDENTITY_TEST_COUNT=\d+/);
  });
  console.log(`REAL_LONG_LIVED_START_TEST_COUNT=${count}`);
} finally {
  for (const pid of new Set(started)) { try { process.kill(pid); } catch { } }
  delete process.env.FIXTURE_LAUNCHER_TIMEOUT;
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (!fs.realpathSync(tmp).toLowerCase().startsWith(fs.realpathSync(os.tmpdir()).toLowerCase() + path.sep)) throw Error('UNSAFE_FIXTURE_CLEANUP');
  try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { }
}
