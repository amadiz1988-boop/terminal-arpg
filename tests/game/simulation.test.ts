import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { TALENTS, TALENT_BOARDS } from '../../game/content/talents';
import { isSupportCompatible, SUPPORTS } from '../../game/content/supports';
import { createStarterWeapon } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import { completeCampaignOperation } from '../../game/progression/campaign';
import { exchangeMaps } from '../../game/progression/maps';
import { generateMonsterPacks, generateMonsterPopulation, getRunStopReason, simulateMapCompletion } from '../../game/simulation/map';
import { simulateAcceleratedSession } from '../../game/simulation/session';
import { armourReduction, createCombatState, generateMonsterRoster, maximumMana, SKILL_MANA_COST, stepCombat } from '../../game/simulation/combat';
import type { Item } from '../../game/core/types';

const build = { skill: SKILLS.ember, weapon: createStarterWeapon() };

describe('simulation contracts', () => {
  it('replays map rewards from a seed', () => {
    expect(simulateMapCompletion(824, 1, 'full-clear', build)).toEqual(simulateMapCompletion(824, 1, 'full-clear', build));
  });

  it('uses sourced level-one skill damage instead of one-shot demo values', () => {
    const stats=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief'});
    expect(stats.hitDamage).toBe(10);
    expect(stats.attacksPerSecond).toBeLessThan(2.1);
  });

  it('uses sourced level-one life scaling in the opening area', () => {
    const roster=generateMonsterRoster(824,1,[{position:1,normal:1,magic:1,rare:1,special:0}],1).targets;
    expect(roster.find(target=>target.rank==='normal')?.maxLife).toBe(22);
    expect(roster.find(target=>target.rank==='magic')?.maxLife).toBe(82);
    expect(roster.find(target=>target.rank==='rare')?.maxLife).toBe(143);
    expect(roster.find(target=>target.rank==='boss')?.maxLife).toBe(176);
  });

  it('unlocks maps only after the final campaign operation', () => {
    expect(completeCampaignOperation(4, 'arc').maps).toBeUndefined();
    expect(completeCampaignOperation(5, 'arc').maps?.[1]).toBe(0);
    expect(completeCampaignOperation(5, 'arc').maps?.[2]).toBe(2);
  });

  it('delivers rewards that match the campaign promise', () => {
    expect(completeCampaignOperation(0, 'arc').item?.slot).toBe('armor');
    expect(completeCampaignOperation(1, 'arc').item?.rarity).toBe('RARE');
    expect(completeCampaignOperation(4, 'arc').item?.name).toContain('雷');
  });

  it('keeps T1 infinite and stops a depleted higher tier', () => {
    expect(getRunStopReason({ mode: 'count', completed: 2, goal: 5, elapsedMs: 1000, availableNext: 0, tier: 1 })).toBeNull();
    expect(getRunStopReason({ mode: 'count', completed: 2, goal: 5, elapsedMs: 1000, availableNext: 0, tier: 2 })).toContain('T2 地圖耗盡');
  });

  it('honors count and time stop conditions', () => {
    expect(getRunStopReason({ mode: 'count', completed: 5, goal: 5, elapsedMs: 1000, availableNext: 3, tier: 1 })).toBe('達到設定張數');
    expect(getRunStopReason({ mode: 'time', completed: 3, goal: 1, elapsedMs: 10_000, availableNext: 3, tier: 1 })).toBe('達到設定時間');
  });

  it('makes contract outcomes deterministic and changes rewards', () => {
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed')).toEqual(simulateMapCompletion(900, 2, 'currency', build, 'greed'));
    expect(Object.values(simulateMapCompletion(900, 2, 'currency', build, 'greed').orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThan(0);
    expect(simulateMapCompletion(900, 2, 'currency', build, 'greed').gemDrop).toBeDefined();
  });

  it('gives each map policy a measurable purpose', () => {
    const full = simulateMapCompletion(912, 2, 'full-clear', build);
    const rush = simulateMapCompletion(912, 2, 'boss-rush', build);
    const currency = simulateMapCompletion(912, 2, 'currency', build);
    expect(full.kills).toBeGreaterThan(rush.kills);
    expect(Object.values(currency.orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThan(Object.values(rush.orbs).reduce((sum,value)=>sum+value,0));
    expect(rush.mapDropTier).toBeGreaterThanOrEqual(2);
  });

  it('lets mastery allocation create distinct character growth', () => {
    const base = resolveStats(build);
    const power = resolveStats({ ...build, masteries: { power: 2, tempo: 0, guard: 0 } });
    const guard = resolveStats({ ...build, masteries: { power: 0, tempo: 0, guard: 2 } });
    expect(power.dps).toBeGreaterThan(base.dps);
    expect(guard.life).toBeGreaterThan(base.life);
  });

  it('applies sourced talent effects only to matching skill tags', () => {
    const attackBase=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief')});
    const attackMight=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),talents:['might-damage']});
    const spellBase=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage')});
    const spellMight=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage'),talents:['might-damage']});
    const spellWisdom=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage'),talents:['wisdom-power','wisdom-speed','wisdom-mana']});
    expect(attackMight.hitDamage).toBeGreaterThan(attackBase.hitDamage);
    expect(spellMight.hitDamage).toBe(spellBase.hitDamage);
    expect(spellWisdom.hitDamage).toBeGreaterThan(spellBase.hitDamage);
    expect(spellWisdom.attacksPerSecond).toBeGreaterThan(spellBase.attacksPerSecond);
    expect(maximumMana(1,spellWisdom.manaPercent)).toBe(43);
  });

  it('keeps unverified job bonuses outside the stat resolver', () => {
    const plain=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief')});
    const pendingJob=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief',secondJobId:'assassin',ascendancyNodes:['assassin-katar']});
    expect(pendingJob).toEqual(plain);
  });

  it('stores source provenance for every active talent entry', () => {
    expect(Object.values(TALENT_BOARDS).every(board=>board.sourceStatus==='verified'&&board.sourceUrl==='https://tlidb.com/tw/Talent')).toBe(true);
    expect(TALENTS.every(node=>node.sourceStatus==='verified'&&node.verifiedAt==='2026-09-06')).toBe(true);
  });

  it('lets support choices trade clear speed for boss damage or defense', () => {
    const meleeBuild={skill:SKILLS.quake,weapon:createStarterWeapon('acolyte')};
    const linked: Item = { ...createStarterWeapon('acolyte'), links: 2, sockets: ['R','W'] };
    const clear = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.momentum], supportSlots: 2 });
    const boss = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.focus], supportSlots: 2 });
    const guard = resolveStats({ ...meleeBuild, weapon:linked, supports: [SUPPORTS.fortify], supportSlots: 2 });
    expect(clear.clearScore).toBeGreaterThan(boss.clearScore);
    expect(boss.bossDps).toBeGreaterThan(clear.bossDps);
    expect(guard.life).toBeGreaterThan(clear.life);
  });

  it('requires support conditions to match skill tags', () => {
    expect(isSupportCompatible(SUPPORTS.echo,SKILLS.firebolt.tags)).toBe(true);
    expect(isSupportCompatible(SUPPORTS.echo,SKILLS.venom.tags)).toBe(false);
    expect(isSupportCompatible(SUPPORTS.fortify,SKILLS.venom.tags)).toBe(false);
  });

  it('builds 400 to 600 field monsters into mixed packs and keeps one boss separate', () => {
    const population=generateMonsterPopulation(824);
    const packs=generateMonsterPacks(824,population);
    expect(population.total-1).toBeGreaterThanOrEqual(400);
    expect(population.total-1).toBeLessThanOrEqual(600);
    expect(population.boss).toBe(1);
    expect(packs.some(pack=>[pack.normal,pack.magic,pack.rare].filter(value=>value>0).length>=2)).toBe(true);
    expect(packs.every(pack=>pack.position<220)).toBe(true);
    expect(packs.reduce((sum,pack)=>sum+pack.normal+pack.magic+pack.rare+pack.special,0)).toBe(population.total-1);
  });

  it('makes higher monster ranks contribute more to rewards', () => {
    const result=simulateMapCompletion(824,1,'full-clear',build);
    expect(result.items.length).toBeGreaterThanOrEqual(4);
    expect(result.monsters.rare).toBeGreaterThan(0);
    expect(Object.values(result.orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThan(0);
  });

  it('passes the 30 minute equivalent play gate with measurable decisions', () => {
    const report = simulateAcceleratedSession(824, 45);
    expect(report.equivalentMinutes).toBeGreaterThanOrEqual(30);
    expect(report.mapsRun).toBe(45);
    expect(report.decisions).toBeGreaterThanOrEqual(14);
    expect(report.gemsFound).toBe(report.successes);
    expect(report.mapExchanges).toBeGreaterThanOrEqual(5);
    expect(report.longestMapsWithoutReward).toBeLessThanOrEqual(5);
    expect(report.lockouts).toBe(0);
    expect(report.orbsSpent).toBeGreaterThan(0);
    expect(report.powerGainPercent).toBeGreaterThanOrEqual(80);
    expect(report.tiersUnlocked).toBeGreaterThanOrEqual(1);
  });

  it('exchanges three maps into one higher tier without locking T1 play', () => {
    expect(exchangeMaps([0,3,0,0,0,0],1)).toEqual([0,0,1,0,0,0]);
  });

  it('uses sourced PoE mana and armour formulas',()=>{
    expect(maximumMana(1)).toBe(40);
    expect(SKILL_MANA_COST.venom).toBe(5);
    expect(SKILL_MANA_COST.arc).toBe(10);
    expect(armourReduction(500,100)).toBe(.5);
  });

  it('advances through visible combat states and spends resources',()=>{
    const packs=generateMonsterPacks(824,generateMonsterPopulation(824));
    const slow={...build,skill:{...SKILLS.ember,baseDamage:1}};
    let state=createCombatState(1,10,slow,packs);
    state=stepCombat(state,{tier:1,level:10,build:slow,packs});
    expect(['search','travel','combat']).toContain(state.phase);
    for(let index=0;index<100&&state.phase!=='combat';index+=1)state=stepCombat(state,{tier:1,level:10,build:slow,packs});
    expect(state.phase).toBe('combat');
    const beforeMana=state.mana;
    while(state.mana>=beforeMana)state=stepCombat(state,{tier:1,level:10,build:slow,packs});
    expect(state.mana).toBeLessThan(beforeMana);
    let sawDamage=false,sawHit=state.events.some(event=>['HIT','BASIC','CRITICAL'].includes(event.kind));
    for(let index=0;index<20&&!sawDamage;index+=1){state=stepCombat(state,{tier:1,level:10,build:slow,packs});sawHit ||= state.events.some(event=>['HIT','BASIC','CRITICAL'].includes(event.kind));sawDamage ||= state.events.some(event=>event.kind==='DAMAGE');}
    expect(sawDamage).toBe(true);
    expect(sawHit).toBe(true);
  });

  it('uses Default Attack while mana is below the skill cost and resumes the skill after recovery',()=>{
    const packs=generateMonsterPacks(824,generateMonsterPopulation(824));
    const slow={...build,skill:{...SKILLS.arc,baseDamage:1,attacksPerSecond:1}};
    let state=createCombatState(1,10,slow,packs);
    for(let index=0;index<100&&state.phase!=='combat';index+=1)state=stepCombat(state,{tier:1,level:10,build:slow,packs});
    state={...state,mana:0,manaFlaskCharges:0,playerClock:1000};
    state=stepCombat(state,{tier:1,level:10,build:slow,packs,tickMs:250});
    expect(state.events.some(event=>event.kind==='BASIC'&&event.text.includes('普通攻擊'))).toBe(true);
    expect(state.events.some(event=>event.kind==='OOM')).toBe(false);
    let skillReturned=false;
    for(let index=0;index<100&&!skillReturned;index+=1){state=stepCombat(state,{tier:1,level:10,build:slow,packs,tickMs:250});skillReturned=state.events.some(event=>event.kind==='HIT'||event.kind==='CRITICAL'&&event.text.includes('電弧'));}
    expect(skillReturned).toBe(true);
  });

  it('never credits a full map without processing its combat timeline',()=>{
    const packs=generateMonsterPacks(824,generateMonsterPopulation(824));
    const tank:Item={id:'test-tank',baseId:'test-tank',name:'test-tank',slot:'armor',rarity:'RARE',itemLevel:1,affixes:[{id:'life',name:'life',stat:'life',value:5000000,tier:1,tags:['life']},{id:'armor',name:'armor',stat:'armor',value:5000000,tier:1,tags:['armor']}]};
    const durable={...build,armor:tank};let state=createCombatState(1,10,durable,packs);let steps=0,hitRows=0,damageRows=0,lastKill='';const damagedTargets=new Set<string>();
    while(state.phase!=='complete'&&state.phase!=='dead'&&steps<100000){state=stepCombat(state,{tier:1,level:10,build:durable,packs});for(const event of state.events){if(['HIT','BASIC','CRITICAL'].includes(event.kind)){hitRows+=1;const target=event.text.match(/→ ([^ ]+)/)?.[1];if(target)damagedTargets.add(target);}if(event.kind==='DAMAGE')damageRows+=1;if(event.kind==='KILL'){lastKill=event.text.split(' ')[0];expect(damagedTargets.has(lastKill)).toBe(true);}}steps+=1;}
    expect(state.phase).toBe('complete');
    expect(state.kills).toBe(state.totalMonsters);
    expect(lastKill).toBe('BOSS-001');
    expect(hitRows).toBeGreaterThan(50);
    expect(damageRows).toBeGreaterThan(0);
    expect(steps).toBeGreaterThan(100);
    expect(steps*250).toBeGreaterThanOrEqual(30*60*1000);
  });
});
