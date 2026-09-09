import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../game/content/skills';
import { CLASSES } from '../../game/content/classes';
import { DEFAULT_RO_STATS, nextStatCost, repairRoStatsForLevel, RO_STAT_DEFINITIONS, roAspdFromAttacksPerSecond, roAverageMagicAttack, roFlee, roHit, roMagicDefense, roMeleeAttack, roPerfectDodge, roPhysicalDefense, roRangedAttack, roVariableCastMultiplier, spentStatusPoints, statusPointsForLevel } from '../../game/content/ro-stats';
import { isSupportCompatible, SUPPORTS } from '../../game/content/supports';
import { createStarterWeapon } from '../../game/items/items';
import { resolveStats } from '../../game/modifiers/resolve-stats';
import { exchangeMaps } from '../../game/progression/maps';
import { generateMonsterPacks, generateMonsterPopulation, getRunStopReason, simulateMapCompletion } from '../../game/simulation/map';
import { simulateAcceleratedSession } from '../../game/simulation/session';
import { armourReduction, createCombatState, generateMonsterRoster, generateTerrain, MAP_HEIGHT, MAP_WIDTH, maximumMana, SKILL_MANA_COST, stepCombat } from '../../game/simulation/combat';
import { progressMapRewards } from '../../game/simulation/rewards';
import type { Item } from '../../game/core/types';

const build = { skill: SKILLS.ember, weapon: createStarterWeapon() };

describe('simulation contracts', () => {
  it('starts the three classes with verified popular Allflame skill shapes', () => {
    expect(CLASSES.thief.starterSkill).toBe('cycloneTumult');
    expect(CLASSES.mage.starterSkill).toBe('winterOrb');
    expect(CLASSES.acolyte.starterSkill).toBe('penanceBrand');
    expect(SKILLS.cycloneTumult.mechanic).toBe('cyclone');
    expect(SKILLS.winterOrb.mechanic).toBe('winter-orb');
    expect(SKILLS.penanceBrand.mechanic).toBe('penance-brand');
    expect(SKILL_MANA_COST.cycloneTumult).toBe(4);
    expect(SKILL_MANA_COST.winterOrb).toBe(2);
    expect(SKILL_MANA_COST.penanceBrand).toBe(15);
  });

  it('replays map rewards from a seed', () => {
    expect(simulateMapCompletion(824, 1, 'full-clear', build)).toEqual(simulateMapCompletion(824, 1, 'full-clear', build));
  });

  it('uses sourced level-one skill damage instead of one-shot demo values', () => {
    const stats=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief'});
    expect(stats.hitDamage).toBe(11);
    expect(stats.attacksPerSecond).toBeLessThan(2.1);
  });

  it('uses formal T1 monster life immediately after character creation', () => {
    const roster=generateMonsterRoster(824,1,[{position:1,normal:1,magic:1,rare:1,special:0}]).targets;
    expect(roster.find(target=>target.rank==='normal')?.maxLife).toBe(62);
    expect(roster.find(target=>target.rank==='magic')?.maxLife).toBe(269);
    expect(roster.find(target=>target.rank==='rare')?.maxLife).toBe(608);
    expect(roster.find(target=>target.rank==='boss')?.maxLife).toBe(9742);
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

  it('uses the sourced RO status point schedule and escalating costs', () => {
    expect(statusPointsForLevel(1)).toBe(0);
    expect(statusPointsForLevel(2)).toBe(3);
    expect(statusPointsForLevel(6)).toBe(16);
    expect(statusPointsForLevel(99)).toBe(1225);
    expect(nextStatCost(1)).toBe(2);
    expect(nextStatCost(11)).toBe(3);
    expect(spentStatusPoints({...DEFAULT_RO_STATS,str:99})).toBe(628);
  });

  it('keeps unverified job bonuses outside the stat resolver', () => {
    const plain=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief')});
    const pendingJob=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief',secondJobId:'assassin',ascendancyNodes:['assassin-katar']});
    expect(pendingJob).toEqual(plain);
  });

  it('makes every RO stat change a combat-relevant value', () => {
    const attackBase=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:DEFAULT_RO_STATS});
    const strength=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:{...DEFAULT_RO_STATS,str:21}});
    const agility=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:{...DEFAULT_RO_STATS,agi:21}});
    const vitality=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:{...DEFAULT_RO_STATS,vit:21}});
    const spellBase=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage'),roStats:DEFAULT_RO_STATS});
    const intelligence=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage'),roStats:{...DEFAULT_RO_STATS,int:21}});
    const dexterity=resolveStats({skill:SKILLS.firebolt,weapon:createStarterWeapon('mage'),roStats:{...DEFAULT_RO_STATS,dex:21}});
    const luck=resolveStats({skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:{...DEFAULT_RO_STATS,luk:21}});
    expect(strength.hitDamage).toBeGreaterThan(attackBase.hitDamage);
    expect(agility.attacksPerSecond).toBeGreaterThan(attackBase.attacksPerSecond);
    expect(vitality.life).toBeGreaterThan(attackBase.life);
    expect(intelligence.hitDamage).toBeGreaterThan(spellBase.hitDamage);
    expect(maximumMana(1,intelligence.manaPercent)).toBeGreaterThan(maximumMana(1,spellBase.manaPercent));
    expect(dexterity.attacksPerSecond).toBeGreaterThan(spellBase.attacksPerSecond);
    expect(luck.critChance).toBeGreaterThan(attackBase.critChance);
    expect(roMeleeAttack({...DEFAULT_RO_STATS,str:20})).toBe(20);
  });

  it('stores source provenance for every active RO status entry', () => {
    expect(RO_STAT_DEFINITIONS.every(stat=>stat.sourceStatus==='verified'&&stat.sourceUrl==='https://ro.ntome.com/stat/attr'&&stat.verifiedAt==='2026-09-06')).toBe(true);
  });

  it('calculates the displayed Renewal derived stats from the live six stats', () => {
    const stats={str:20,agi:10,vit:10,int:10,dex:10,luk:10};
    expect(roMeleeAttack(stats,20)).toBe(30);
    expect(roRangedAttack(stats,20)).toBe(22);
    expect(roAverageMagicAttack(stats,20)).toBe(25);
    expect(roPhysicalDefense(stats,20)).toBe(17);
    expect(roMagicDefense(stats,20)).toBe(19);
    expect(roHit(20,stats)).toBe(33);
    expect(roFlee(20,stats)).toBe(32);
    expect(roPerfectDodge(stats)).toBe(2);
    expect(roVariableCastMultiplier(stats)).toBeCloseTo(1-Math.sqrt(30/530));
    expect(roAspdFromAttacksPerSecond(5)).toBe(190);
  });

  it('migrates old level-one 48-point saves back to the zero-point start', () => {
    expect(repairRoStatsForLevel({...DEFAULT_RO_STATS,str:2},1)).toEqual(DEFAULT_RO_STATS);
    expect(repairRoStatsForLevel({...DEFAULT_RO_STATS,str:2},2).str).toBe(2);
  });

  it('recalculates life and mana during an active combat state', () => {
    const packs=[{position:1,normal:1,magic:0,rare:0,special:0}];
    const baseBuild={skill:SKILLS.venom,weapon:createStarterWeapon('thief'),roStats:DEFAULT_RO_STATS};
    const state=createCombatState(1,2,baseBuild,packs,824);
    state.life=state.maxLife/2;
    state.mana=state.maxMana/2;
    const next=stepCombat(state,{tier:1,level:2,build:{...baseBuild,roStats:{...DEFAULT_RO_STATS,vit:21,int:21}},packs,seed:824,tickMs:1});
    expect(next.maxLife).toBeGreaterThan(state.maxLife);
    expect(next.maxMana).toBeGreaterThan(state.maxMana);
    expect(next.life/next.maxLife).toBeCloseTo(.5,2);
    expect(next.mana/next.maxMana).toBeCloseTo(.5,2);
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

  it('gives every generated monster its own minimap point and a real pack identity', () => {
    const population=generateMonsterPopulation(824);
    const packs=generateMonsterPacks(824,population);
    const roster=generateMonsterRoster(824,1,packs);
    const field=roster.targets.filter(target=>target.rank!=='boss');
    expect(field).toHaveLength(population.total-1);
    expect(new Set(field.map(target=>target.id)).size).toBe(field.length);
    expect(new Set(field.map(target=>target.position)).size).toBe(field.length);
    expect(field.every(target=>target.packId!==undefined)).toBe(true);
  });


  it('makes higher monster ranks contribute more to rewards', () => {
    const result=simulateMapCompletion(824,1,'full-clear',build);
    expect(result.items.length).toBeGreaterThanOrEqual(4);
    expect(result.monsters.rare).toBeGreaterThan(0);
    expect(Object.values(result.orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThan(0);
  });

  it('credits experience immediately and conserves every planned map reward', () => {
    const plan=simulateMapCompletion(825,1,'full-clear',build,'scout','arsenal',true);
    const first=progressMapRewards(plan,undefined,1,plan.monsters.total,'normal');
    expect(first.delta.xp).toBeGreaterThan(0);
    expect(first.delta.itemEnd-first.delta.itemStart).toBe(0);
    const magic=progressMapRewards(plan,first.progress,2,plan.monsters.total,'magic');
    expect(magic.delta.itemEnd-magic.delta.itemStart).toBeGreaterThan(0);
    expect(Object.values(magic.delta.orbs).reduce((sum,value)=>sum+value,0)).toBeGreaterThan(0);
    const boss=progressMapRewards(plan,magic.progress,plan.monsters.total,plan.monsters.total,'boss');
    expect(boss.progress.xp).toBe(plan.xp);
    expect(boss.progress.items).toBe(plan.items.length);
    expect(boss.progress.orbs).toBe(Object.values(plan.orbs).reduce((sum,value)=>sum+value,0));
    expect(boss.progress.gem).toBe(true);
  });

  it('passes the 30 minute equivalent play gate with measurable decisions', () => {
    const report = simulateAcceleratedSession(824, 45);
    console.log('PLAYTEST_REPORT', JSON.stringify(report));
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

  it('resolves sourced chain hits against living monsters in the encountered pack',()=>{
    const chainBuild={skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief' as const};
    const packs=[{position:1,normal:4,magic:0,rare:0,special:0}];
    let state=createCombatState(1,1,chainBuild,packs,824);
    const targets=Array.from({length:4},(_,index)=>({id:`chain-${index}`,rank:'normal' as const,position:state.playerPosition,maxLife:11,life:11}));
    state={...state,phase:'combat',targets,target:targets[0],targetLife:11,totalMonsters:4,playerClock:1000};
    state=stepCombat(state,{tier:1,level:1,build:chainBuild,packs,seed:824,tickMs:1});
    expect(state.kills).toBe(4);
    expect(state.killRanks).toHaveLength(4);
    expect(state.killPositions).toHaveLength(4);
    expect(state.events.some(event=>event.kind==='CHAIN'&&event.text.includes('額外命中 3'))).toBe(true);
  });

  it('keeps single-target and pack-clearing skills mechanically distinct',()=>{
    expect(SKILLS.ember.targeting.mode).toBe('single');
    expect(SKILLS.venom.targeting).toEqual({mode:'chain',additionalTargets:3});
    expect(SKILLS.arc.targeting).toEqual({mode:'chain',additionalTargets:8});
    expect(SKILLS.firebolt.targeting.mode).toBe('area');
    expect(SKILLS.smite.targeting.mode).toBe('area');
  });

  it('moves by actual movement speed and lets projectiles engage before contact',()=>{
    const ranged={skill:SKILLS.venom,weapon:createStarterWeapon('thief'),classId:'thief' as const};
    const packs=[{position:1,normal:1,magic:0,rare:0,special:0}];
    let state=createCombatState(1,1,ranged,packs,824);
    const target={id:'range-target',rank:'normal' as const,position:3,maxLife:22,life:22};
    state={...state,phase:'travel',targets:[target],target,targetLife:22,playerPosition:0,path:[1,2,3],travelMode:'target'};
    state=stepCombat(state,{tier:1,level:1,build:ranged,packs,seed:824,tickMs:1});
    expect(state.phase).toBe('combat');
    expect(state.playerPosition).toBe(0);
    state={...state,playerClock:1000};
    state=stepCombat(state,{tier:1,level:1,build:ranged,packs,seed:824,tickMs:1});
    expect(state.attackFrom).toBe(0);
    expect(state.attackTo).toBe(3);

    const melee={skill:SKILLS.smite,weapon:createStarterWeapon('acolyte'),classId:'acolyte' as const};
    let meleeState=createCombatState(1,1,melee,packs,824);
    meleeState={...meleeState,phase:'travel',targets:[target],target,targetLife:22,playerPosition:0,path:[1,2,3],travelMode:'target',travel:0};
    meleeState=stepCombat(meleeState,{tier:1,level:1,build:melee,packs,seed:824,tickMs:125});
    expect(meleeState.playerPosition).toBe(0);
    meleeState=stepCombat(meleeState,{tier:1,level:1,build:melee,packs,seed:824,tickMs:125});
    expect(meleeState.playerPosition).toBe(1);
    const fastBoots:Item={id:'fast-boots',baseId:'treads',name:'boots',slot:'boots',rarity:'MAGIC',itemLevel:1,affixes:[{id:'move',name:'move',stat:'move',value:100,tier:1,tags:['move']}]};
    const fast={...melee,boots:fastBoots};let fastState=createCombatState(1,1,fast,packs,824);
    fastState={...fastState,phase:'travel',targets:[target],target,targetLife:22,playerPosition:0,path:[1,2,3],travelMode:'target',travel:0};
    fastState=stepCombat(fastState,{tier:1,level:1,build:fast,packs,seed:824,tickMs:125});
    expect(fastState.playerPosition).toBe(1);
  });

  it('moves every living monster in the engaged pack toward the player',()=>{
    const packs=generateMonsterPacks(824,generateMonsterPopulation(824));
    const slow={...build,skill:{...SKILLS.ember,baseDamage:1,attacksPerSecond:.1}};
    let state=createCombatState(1,10,slow,packs,824);
    for(let index=0;index<200&&state.phase!=='combat';index+=1)state=stepCombat(state,{tier:1,level:10,build:slow,packs,seed:824,tickMs:125});
    expect(state.phase).toBe('combat');
    const packId=state.target?.packId;
    expect(packId).toBeTypeOf('number');
    const before=new Map(state.targets.filter(target=>target.packId===packId).map(target=>[target.id,target.position]));
    for(let index=0;index<4;index+=1)state=stepCombat(state,{tier:1,level:10,build:slow,packs,seed:824,tickMs:125});
    const moved=state.targets.filter(target=>target.packId===packId&&before.get(target.id)!==target.position);
    expect(moved.length).toBeGreaterThan(0);
    expect(state.aggroIds?.length).toBe(before.size);
    expect(state.events.some(event=>event.kind==='PRESSURE')).toBe(true);
  });

  it('lets multiple adjacent pack monsters attack on their own clocks',()=>{
    const packs=[{position:1,normal:2,magic:0,rare:0,special:0}];
    const terrain=generateTerrain(824),start=terrain.start,
      neighbors=[start-1,start+1,start-MAP_WIDTH,start+MAP_WIDTH].filter(cell=>cell>=0&&cell<MAP_WIDTH*MAP_HEIGHT&&terrain.walkable.includes(cell));
    expect(neighbors.length).toBeGreaterThanOrEqual(2);
    const targets=neighbors.slice(0,2).map((position,index)=>({id:`attacker-${index}`,rank:'normal' as const,packId:7,position,maxLife:620,life:620,attackClock:1000}));
    let state=createCombatState(1,10,build,packs,824);
    state={...state,phase:'combat',targets,target:targets[0],targetLife:620,totalMonsters:2,playerPosition:start,playerClock:0};
    state=stepCombat(state,{tier:1,level:10,build,packs,seed:824,tickMs:1});
    expect(state.events.filter(event=>event.kind==='DAMAGE')).toHaveLength(2);
    expect(state.attackers).toBe(2);
    expect(state.enemyAttackFrom).toBeTypeOf('number');
    expect(state.enemyAttackTo).toBe(start);
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
  },10000);
});
