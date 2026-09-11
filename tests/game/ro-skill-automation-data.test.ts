import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Skill = {
  handle: string;
  automationMode:
    | 'attack'
    | 'attackSelf'
    | 'selfRecovery'
    | 'selfBuff'
    | null;
  automationStatus?: string | null;
  resources: {
    spCostByLevel: number[];
    zenyCostByLevel: number[];
    weapons: string[];
    ammo: string[];
    ammoAmount: number;
  };
};

type SkillTree = {
  jobs: Record<string, { skills: Skill[] }>;
};

const tree = JSON.parse(
  readFileSync('public/ro/data/skill-trees.json', 'utf8'),
) as SkillTree;

const skills = new Map(
  Object.values(tree.jobs)
    .flatMap((job) => job.skills)
    .map((skill) => [skill.handle, skill]),
);

describe('RO skill automation data', () => {
  it('keeps representative active skill modes sourced from rAthena', () => {
    expect(skills.get('SM_BASH')?.automationMode).toBe('attack');
    expect(skills.get('SM_MAGNUM')?.automationMode).toBe('attackSelf');
    expect(skills.get('AL_HEAL')?.automationMode).toBe('selfRecovery');
    expect(skills.get('MG_FIREBOLT')?.automationMode).toBe('attack');
    expect(skills.get('AC_DOUBLE')?.automationMode).toBe('attack');
    expect(skills.get('AC_CONCENTRATION')).toMatchObject({
      automationMode: 'selfBuff',
      automationStatus: 'EFST_CONCENTRATION',
    });
  });

  it.each([
    'MG_SIGHT',
    'AL_RUWACH',
    'AL_CRUCIS',
  ])('does not expose rAthena NoDamage skill %s as an attack', (handle) => {
    expect(skills.get(handle)?.automationMode).toBeNull();
  });

  it.each([
    ['SM_ENDURE', 'EFST_ENDURE'],
    ['AL_ANGELUS', 'EFST_ANGELUS'],
    ['AC_CONCENTRATION', 'EFST_CONCENTRATION'],
    ['MC_LOUD', 'EFST_SHOUT'],
  ])('exposes supported buff %s with its OpenKore status', (handle, status) => {
    expect(skills.get(handle)).toMatchObject({
      automationMode: 'selfBuff',
      automationStatus: status,
    });
  });

  it('keeps representative first-job resource requirements from rAthena', () => {
    expect(skills.get('MG_FIREBOLT')?.resources.spCostByLevel[4]).toBe(20);
    expect(skills.get('AC_DOUBLE')?.resources).toMatchObject({
      spCostByLevel: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
      weapons: ['Bow'],
      ammo: ['Arrow'],
      ammoAmount: 1,
    });
    expect(skills.get('MC_MAMMONITE')?.resources).toMatchObject({
      spCostByLevel: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      zenyCostByLevel: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    });
    expect(skills.get('TF_POISON')?.resources.spCostByLevel[0]).toBe(12);
  });
});
