import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { restoreIntermediateNative } from '../native-candidate-amendment.mjs';

const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const names = ['login-server.exe', 'char-server.exe', 'map-server.exe'];
const leaseId = 'fixture-lease';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-rollback-'));
  const buildRoot = path.join(root, 'build');
  const production = path.join(root, 'production');
  const oldArtifacts = [], candidateArtifacts = [], saved = [];
  for (const name of names) {
    const old = Buffer.from('old-' + name), next = Buffer.from('new-' + name);
    const oldPath = `.local/ro-stack/rathena/${name}`;
    const savedPath = `intermediate-rollback/${name}`;
    for (const [base, relative, bytes] of [[production, oldPath, next], [buildRoot, savedPath, old]]) {
      const file = path.join(base, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    oldArtifacts.push({ path: oldPath, sha256: hash(old) });
    candidateArtifacts.push({ path: name, sha256: hash(next) });
    saved.push({ path: savedPath, production_path: oldPath, sha256: hash(old) });
  }
  let phase = 'running';
  const actions = [];
  const before = { pids: { login: 1, char: 2, map: 3 }, dashboard_pid: 4, database_pid: 5,
    procdump_receipt: { runtimeGenerationId: 'old' } };
  const adapter = async action => {
    actions.push(action);
    if (action === 'stop') { phase = 'stopped'; return null; }
    if (action === 'start') { phase = 'restored'; return null; }
    if (phase === 'stopped') return { counts: { login: 0, char: 0, map: 0 } };
    return { pass: true, openkore_runtime_count: 0, counts: { login: 1, char: 1, map: 1 },
      pids: { login: 11, char: 12, map: 13 }, dashboard_pid: 4, database_pid: 5,
      procdump_receipt: { mapPid: 13, procdumpAttachStatus: 'ATTACHED',
        runtimeGenerationId: 'restored', mapBinarySha256: oldArtifacts[2].sha256 },
      procdump_account: 'NT AUTHORITY\\SYSTEM',
      procdump_process_identity: { PROCESS_IDENTITY_MATCH: 'YES' } };
  };
  return { root, buildRoot, production, oldArtifacts, candidateArtifacts,
    reference: { artifacts: saved }, before, adapter, actions,
    input: () => ({ root: production, buildRoot, leaseId, reference: { artifacts: saved },
      oldArtifacts, candidateArtifacts, adapter, before, timing: { attempts: 1, delayMs: 0 } }),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

{
  const x = fixture();
  try {
    const result = await restoreIntermediateNative(x.input());
    assert.equal(result.restored, true);
    assert.deepEqual(x.actions, ['stop', 'snapshot', 'start', 'snapshot']);
    for (const item of x.oldArtifacts)
      assert.equal(hash(fs.readFileSync(path.join(x.production, item.path))), item.sha256);
    console.log('PASS exact f7 bytes restored and authoritative runtime health rechecked');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    fs.writeFileSync(path.join(x.buildRoot, x.reference.artifacts[0].path), 'tampered');
    await assert.rejects(restoreIntermediateNative(x.input()), /INTERMEDIATE_ROLLBACK_CHANGED/);
    assert.deepEqual(x.actions, []);
    console.log('PASS changed rollback artifact blocks before runtime stop');
  } finally { x.cleanup(); }
}
{
  const x = fixture();
  try {
    fs.writeFileSync(path.join(x.production, x.oldArtifacts[0].path), 'foreign');
    await assert.rejects(restoreIntermediateNative(x.input()), /ROLLBACK_PREIMAGE_CHANGED/);
    assert.deepEqual(x.actions, ['stop', 'snapshot']);
    console.log('PASS foreign production preimage blocks replacement');
  } finally { x.cleanup(); }
}
