import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const skillTreePath = join(moduleDir, '..', '..', 'public', 'ro', 'data', 'skill-trees.json');

function loadJobNames() {
  try {
    const payload = JSON.parse(readFileSync(skillTreePath, 'utf8'));
    return Object.freeze(Object.fromEntries(
      Object.entries(payload?.jobs ?? {})
        .filter(([, job]) => String(job?.name ?? '').trim())
        .map(([id, job]) => [String(Number(id)), String(job.name).trim()]),
    ));
  } catch {
    return Object.freeze({});
  }
}

export const JOB_MAPPING_SOURCE = 'public/ro/data/skill-trees.json:jobs';
export const JOB_NAMES = loadJobNames();

export function resolveJobName(classId) {
  const key = String(Number(classId));
  return JOB_NAMES[key] ?? null;
}
