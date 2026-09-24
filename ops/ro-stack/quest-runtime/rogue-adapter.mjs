import { randomUUID } from 'node:crypto';
import {
  CombatPolicy,
  CommitType,
  InterruptPolicy,
  MissionStageType,
  ObjectiveCompletionMode,
  QuestStatus,
  QuestStepType,
  RiskLevel,
} from './contracts.mjs';
import { defineJobQuestAdapter } from './job-adapter-contract.mjs';
import { defineMissionInteractionDefinitions } from './mission-interaction-contract.mjs';
import { questPreflightCheck, requestSupply } from './runtime.mjs';

export const ROGUE_CAREER_JOURNEY_ID = 28002;
export const ROGUE_JOB_ID = 17;
export const ROGUE_THIEF_JOB_ID = 6;

export const RoguePhase = Object.freeze({
  IDLE: 'IDLE',
  NAVIGATING: 'NAVIGATING',
  AT_GUILD: 'AT_GUILD',
  ACCEPTING: 'ACCEPTING',
  QUIZ: 'QUIZ',
  QUIZ_SYNC: 'QUIZ_SYNC',
  RESOURCE_READY: 'RESOURCE_READY',
  RESOURCE_ASSIGNING: 'RESOURCE_ASSIGNING',
  RESOURCE_REQUIRED: 'RESOURCE_REQUIRED',
  RESOURCE_SYNC: 'RESOURCE_SYNC',
  BRANCH_READY: 'BRANCH_READY',
  BRANCH_ASSIGNING: 'BRANCH_ASSIGNING',
  BRANCH: 'BRANCH',
  PASSWORD_SYNC: 'PASSWORD_SYNC',
  ROUTE_DECISION: 'ROUTE_DECISION',
  ROUTE_DECISION_SYNC: 'ROUTE_DECISION_SYNC',
  ROUTE_READY: 'ROUTE_READY',
  ROUTE_STARTING: 'ROUTE_STARTING',
  ROUTE_ACTIVE: 'ROUTE_ACTIVE',
  FINAL_READY: 'FINAL_READY',
  COMPLETED: 'COMPLETED',
});

export const ROGUE_INTERACTIONS = defineMissionInteractionDefinitions({
  AT_GUILD: {
    interactionKey: 'rogue.entry', npcId: 'Rogue Guildsman#rg', npcKey: 'rogue.markie', npcName: 'Markie', npcVisualKey: 'rogue.markie',
    dialogLines: [
      { id: 'rogue.entry.intro', text: '我是 Markie，負責替 Rogue Guild 受理新的申請者。', sourceRef: 'npc/jobs/2-2/rogue.txt:97-108' },
      { id: 'rogue.entry.rule', text: 'Rogue 的第一條規則，是保護自己的真實身分。', sourceRef: 'npc/jobs/2-2/rogue.txt:110-113' },
      { id: 'rogue.entry.confirm', text: '確認後我會正式受理申請，第一項考驗是知識測驗。', sourceRef: 'npc/jobs/2-2/rogue.txt:114-120' },
    ],
    autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'ACCEPT_QUEST', label: '接受 Rogue 轉職考試', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-2/rogue.txt:94-120',
  },
  ACCEPTING: {
    interactionKey: 'rogue.entry.accepted', npcId: 'Rogue Guildsman#rg', npcKey: 'rogue.markie', npcName: 'Markie', npcVisualKey: 'rogue.markie',
    dialogLines: [
      { id: 'rogue.entry.accepted-1', text: '你的申請已正式受理。先放輕鬆，第一項考驗很簡單。', sourceRef: 'npc/jobs/2-2/rogue.txt:114-116' },
      { id: 'rogue.entry.accepted-2', text: '準備完成後，Rogue 知識測驗就會開始。', sourceRef: 'npc/jobs/2-2/rogue.txt:117-120' },
    ],
    autoAdvanceAllowed: true, requiresPlayerInput: false, availableActions: [],
    sourceRef: 'npc/jobs/2-2/rogue.txt:114-120',
  },
  QUIZ: {
    interactionKey: 'rogue.quiz', npcId: 'Rogue Guildsman#rg', npcKey: 'rogue.markie', npcName: 'Markie', npcVisualKey: 'rogue.markie',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_QUIZ', label: '提交答案', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-2/rogue.txt:211-450',
  },
  QUIZ_SYNC: {
    interactionKey: 'rogue.quiz.result', npcId: 'Rogue Guildsman#rg', npcKey: 'rogue.markie', npcName: 'Markie', npcVisualKey: 'rogue.markie',
    dialogLines: [
      { id: 'rogue.quiz.result-1', text: 'Markie 正在核對測驗分數與正式任務狀態。', sourceRef: 'npc/jobs/2-2/rogue.txt:414-450' },
      { id: 'rogue.quiz.result-2', text: '通過後會前往 Mr. Smith 的資源審查；失敗則停留在本測驗。', sourceRef: 'npc/jobs/2-2/rogue.txt:423-449' },
    ],
    autoAdvanceAllowed: true, requiresPlayerInput: false, availableActions: [],
    sourceRef: 'npc/jobs/2-2/rogue.txt:414-450',
  },
  BRANCH: {
    interactionKey: 'rogue.password', npcId: 'Rogue contact branch', npcKey: 'rogue.branch-contact', npcName: 'Rogue Guild 聯絡人', npcVisualKey: 'rogue.branch-contact',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_PASSWORD', label: '提交聯絡暗號', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-2/rogue.txt:1018-1312',
  },
  FINAL_READY: {
    interactionKey: 'rogue.final', npcId: 'Rogue Guildsman#rg', npcKey: 'rogue.markie', npcName: 'Markie', npcVisualKey: 'rogue.markie',
    dialogLines: [{ id: 'rogue.final.ready', text: '所有考驗已完成。最後的轉職仍需由你親自確認。', sourceRef: 'npc/jobs/2-2/rogue.txt:149-191' }],
    autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'FINAL_COMMIT', label: '完成轉職', kind: 'SERVER_COMMIT' }],
    sourceRef: 'npc/jobs/2-2/rogue.txt:149-191',
  },
});

export const ROGUE_SOURCE = Object.freeze({
  file: 'npc/jobs/2-2/rogue.txt',
  loadedBy: 'npc/scripts_jobs.conf:32',
  sha256: '39349296BA74391B086699A9C3C2A0E2DE06BDB43E14724725E35F780E526FAC',
  eligibility: Object.freeze({ baseJob: ROGUE_THIEF_JOB_ID, minimumJobLevel: 40, skillPoint: 0, lines: '75-82' }),
  guildMap: 'in_rogue',
  guildNpc: Object.freeze({ name: 'Rogue Guildsman#rg', displayName: 'Markie', x: 363, y: 122, lines: '57-121' }),
  questIds: Object.freeze([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]),
  variables: Object.freeze([
    'ROGUE_Q', 'ROGUE_Q2', 'terminal_rogue_arrived', 'terminal_rogue_formal_started',
    'terminal_rogue_resource_paid', 'terminal_rogue_resource_branch', 'terminal_rogue_branch',
    'terminal_rogue_password_passed', 'terminal_rogue_route_revision', 'terminal_rogue_route_result',
    'terminal_rogue_route_hp_cost', 'terminal_rogue_route_sp_cost', 'terminal_rogue_route_started',
    'terminal_rogue_resource_seed', 'terminal_rogue_branch_seed',
  ]),
  finalJob: ROGUE_JOB_ID,
  finalState: Object.freeze({ rogueQ: [16, 17], questId: 2026, completionQuestId: 2027, lines: '149-191' }),
});

function question(id, prompt, choices, answers, sourceLines) {
  return Object.freeze({ id, prompt, choices: Object.freeze(choices), answers: Object.freeze(answers), sourceLines });
}

export const ROGUE_QUIZ_SETS = Object.freeze([
  Object.freeze([
    question('a1', '學習 Stalk 的必要技能是哪一項？', ['Hiding', 'Steal', 'Improve Dodge', 'Bash'], [0], '214-217'),
    question('a2', 'Rogue Lv.10 Haggle 比 Merchant Lv.10 Discount 多多少折扣？', ['3%', '2%', '1%', '0%'], [2], '220-223'),
    question('a3', 'Mug 的正確說明是哪一項？', ['從玩家偷物品', '從怪物偷物品', '從怪物偷 Zeny', '從玩家偷 Zeny'], [2], '226-229'),
    question('a4', '啟動 Slyness 需要多少名 Rogue？', ['1 Rogue + 2 Assassin', '1 Thief + 2 Rogue', '4 Thieves', '2 Rogues'], [3], '232-235'),
    question('a5', 'Divest Helm Lv.5 後可學習哪項技能？', ['Envenom', 'Strip Tease', 'Venom Splasher', 'Divest Shield'], [3], '238-241'),
    question('a6', '哪項技能允許角色隱匿時移動？', ['Hiding', 'Back Slide', 'Stalk', 'Sand Attack'], [2], '244-247'),
    question('a7', '哪張卡片提高命中率？', ['Andre', 'Familiar', 'Mummy', 'Marina'], [2], '250-253'),
    question('a8', 'Vadon Card 武器對哪隻怪物傷害較高？', ['Vadon', 'Deviruchi', 'Elder Willow', 'Baphomet'], [2], '256-259'),
    question('a9', 'Double Attack 搭配 Dagger 時需要多少 SP？', ['15', '被動技能，0 SP', '被動技能，10 SP', '54'], [1], '262-265'),
    question('a10', 'Byalan Dungeon 最有效率的短劍屬性？', ['Wind Main-Gauche', 'Ice Main-Gauche', 'Earth Main-Gauche', 'Fire Main-Gauche'], [0], '268-271'),
  ]),
  Object.freeze([
    question('b1', '哪隻怪物掉落有洞 Gladius？', ['Thief Bug', 'Peco Peco', 'Desert Wolf', 'Kobold'], [3], '275-278'),
    question('b2', '哪隻怪物掉落有洞 Main-Gauche？', ['Hornet', 'Desert Wolf', 'Marionette', 'Myst'], [0], '281-284'),
    question('b3', '哪個職業可製作特殊藥水？', ['Merchant', 'Alchemist', 'Blacksmith', 'Priest'], [1], '287-290'),
    question('b4', 'Rogue 無法使用哪種武器？', ['Gakkung', 'Crossbow', 'Gladius', 'Katar'], [3], '293-296'),
    question('b5', 'Hode 的屬性？', ['Water', 'Fire', 'Wind', 'Earth'], [3], '299-302'),
    question('b6', '哪隻怪物無法馴養為 Cute Pet？', ['Poporing', 'Creamy', 'Orc', 'Poison Spore'], [1], '305-308'),
    question('b7', '火屬性 Dagger 對哪種 Goblin 傷害較高？', ['Dagger', 'Mace', 'Morning Star', 'Hammer'], [3], '311-314'),
    question('b8', '哪個城鎮沒有公會城堡？', ['Prontera', 'Al De Baran', 'Alberta', 'Payon'], [2], '317-320'),
    question('b9', '哪種植物會掉落 Blue Herb？', ['Green Plant', 'Yellow Plant', 'Blue Plant', 'Shining Plant'], [2, 3], '323-334'),
    question('b10', '哪隻怪物沒有 Undead 屬性？', ['Zombie', 'Megalodon', 'Familiar', 'Khalitzburg'], [2], '336-339'),
  ]),
  Object.freeze([
    question('c1', 'Thief 精通 Improve Dodge 後 Flee 增加多少？', ['30', '40', '160', '20'], [0], '343-346'),
    question('c2', '哪隻怪物能偵測 Hiding 或 Cloaking？', ['Worm Tail', 'Argos', 'Mummy', 'Soldier Skeleton'], [1], '349-352'),
    question('c3', 'Thief 可在哪裡轉職為 Rogue？', ['Comodo', 'Kokomo Beach', 'Paros Lighthouse', 'Morocc'], [2], '355-358'),
    question('c4', 'Novice 可在哪個城鎮轉職為 Thief？', ['Comodo', 'Lutie', 'Alberta', 'Morocc'], [3], '361-364'),
    question('c5', '哪張卡片不影響 DEX？', ['Rocker', 'Mummy', 'Zerom', 'Drops'], [1], '367-370'),
    question('c6', '成為 Rogue 最酷的地方？', ['完全有型', '服裝風格', '可以叫別人 foo', '優秀攻擊力'], [0, 1, 2, 3], '373-376'),
    question('c7', '何時可從 Thief 轉職為 Rogue？', ['Job Lv.30', 'Job Lv.35', 'Job Lv.40', 'Job Lv.50'], [2, 3], '379-390'),
    question('c8', '要把頭髮染藍應前往哪裡？', ['Morocc 7 點鐘', 'Prontera 7 點鐘', 'Morocc 5 點鐘', 'Prontera 1 點鐘'], [1], '392-395'),
    question('c9', 'Thief 轉職任務需要哪種蘑菇？', ['Orange Gooey', 'Red Hairy', 'Orange Net', 'Orange Sticky'], [0, 2], '398-407'),
    question('c10', '哪張卡片對 Rogue 幫助最少？', ['Whisper', 'Elder Willow', 'Zerom', 'Matyr'], [1], '409-412'),
  ]),
]);

export const ROGUE_RESOURCE_BRANCHES = Object.freeze({
  3: Object.freeze({ questId: 2018, zeny: 10000, items: Object.freeze([{ itemId: 510, amount: 6, name: 'Blue Herb' }, { itemId: 932, amount: 10, name: 'Skel-Bone' }, { itemId: 957, amount: 10, name: 'Decayed Nail' }, { itemId: 958, amount: 10, name: 'Horrendous Mouth' }]), sourceLines: '512,655,976-999' }),
  4: Object.freeze({ questId: 2019, zeny: 10000, items: Object.freeze([{ itemId: 511, amount: 10, name: 'Green Herb' }, { itemId: 910, amount: 10, name: 'Garlet' }, { itemId: 926, amount: 10, name: 'Snake Scale' }, { itemId: 964, amount: 10, name: 'Crab Shell' }]), sourceLines: '513,656,976-999' }),
  5: Object.freeze({ questId: 2020, zeny: 10000, items: Object.freeze([{ itemId: 508, amount: 10, name: 'Yellow Herb' }, { itemId: 948, amount: 10, name: 'Bear Footskin' }, { itemId: 935, amount: 10, name: 'Shell' }, { itemId: 940, amount: 10, name: 'Grasshopper Leg' }]), sourceLines: '514,657,976-999' }),
  6: Object.freeze({ questId: 2021, zeny: 25000, items: Object.freeze([]), webAdaptation: '原腳本 10,000 Zeny 加 17 種材料各 5 個，改為 25,000 Zeny 債務結算；保留稀有分支與較高資源成本。', sourceLines: '515-627,658-699' }),
});

export const ROGUE_BRANCHES = Object.freeze({
  9: Object.freeze({ questId: 2022, contact: 'Aragham Junior', requirement: '前往 Sandarman Fortress 南方住宅', password: 'Aragham never hoarded upgrade items', passwordCode: 'aragham', sourceLines: '759-796,1018-1077,1399-1433' }),
  10: Object.freeze({ questId: 2023, contact: 'Antonio Junior', requirement: '前往 Kokomo Beach 空屋', password: "Antonio doesn't enjoy destroying upgrade items", passwordCode: 'antonio', sourceLines: '797-832,1158-1218,1571-1601' }),
  11: Object.freeze({ questId: 2024, contact: 'Hollgrehenn Junior', requirement: '前往 Sandarman Fortress 南方地區', password: 'My father never hoarded upgrade items', passwordCode: 'hollgrehenn', sourceLines: '833-864,1088-1147,1485-1514' }),
  12: Object.freeze({ questId: 2025, contact: 'Hermanthorn Junior', requirement: '前往 Paros Lighthouse 關卡', password: '3019', passwordCode: '3019', sourceLines: '867-876,1228-1312' }),
});

const ROGUE_CONTACT_VISUAL_KEYS = Object.freeze({
  'Aragham Junior': 'rogue.aragham-junior',
  'Antonio Junior': 'rogue.antonio-junior',
  'Hollgrehenn Junior': 'rogue.hollgrehenn-junior',
  'Hermanthorn Junior': 'rogue.hermanthorn-junior',
});

export const ROGUE_ROUTE_EVENTS = Object.freeze({
  entrance: Object.freeze({
    id: 'entrance',
    clue: '左側有較輕的腳印；火把通道有折返痕跡；金屬刮聲來自視線外。',
    choices: Object.freeze([
      { id: 'quiet_tracks', label: '沿輕腳印前進', serverCode: 'quiet_tracks', next: 'junction', result: 'ADVANCE' },
      { id: 'torch_dead_end', label: '進入火把通道', serverCode: 'torch_dead_end', next: 'entrance', result: 'DEAD_END', cost: { hp: 10 } },
      { id: 'metal_scrape', label: '朝金屬刮聲前進', serverCode: 'metal_scrape', next: 'entrance', result: 'ENCOUNTER', cost: { hp: 5, sp: 5 } },
    ]),
  }),
  junction: Object.freeze({
    id: 'junction',
    clue: '厚重鎧甲腳步在北側逼近；牆邊折刃標記與柔和腳步都指向出口。',
    choices: Object.freeze([
      { id: 'soft_footsteps', label: '跟隨柔和腳步', serverCode: 'soft_footsteps', next: 'ready', result: 'ADVANCE' },
      { id: 'armored_steps', label: '迎向厚重鎧甲聲', serverCode: 'armored_steps', next: 'junction', result: 'THREAT', cost: { hp: 15, sp: 5 } },
      { id: 'wall_marks', label: '沿折刃標記走捷徑', serverCode: 'wall_marks', next: 'ready', result: 'SHORTCUT' },
    ]),
  }),
  ready: Object.freeze({ id: 'ready', clue: '路線已判定，設定威脅策略後進入地下通道。', choices: Object.freeze([]) }),
});

export const ROGUE_THREATS = Object.freeze([
  Object.freeze({ nameId: 1219, name: 'Abysmal Knight', sourceLines: '1373-1385,1746-1760' }),
  Object.freeze({ nameId: 1132, name: 'Khalitzburg', sourceLines: '1889-1904' }),
]);

// Walkable turns from the pinned in_rogue field, kept in Rogue content so the
// generic Navigation executor remains map and career agnostic. The path keeps
// at least five cells from every normal-route Abysmal Knight/Khalitzburg spawn.
export const ROGUE_LONG_ROUTE_WAYPOINTS = Object.freeze([
  [15, 320], [23, 320], [23, 334], [54, 334], [54, 320], [61, 320],
  [61, 305], [74, 305], [74, 269], [61, 269], [61, 241], [98, 241],
  [98, 242], [200, 242], [200, 225], [112, 225], [112, 213], [75, 213],
  [75, 195], [226, 195], [226, 320], [370, 320],
].map(([x, y]) => Object.freeze({ x, y })));

export const ROGUE_SHORTCUT_WAYPOINTS = Object.freeze([
  Object.freeze({ x: 334, y: 320 }),
  Object.freeze({ x: 370, y: 320 }),
]);

const publicQuiz = (set) => set.map(({ id, prompt, choices, sourceLines }) => ({ id, prompt, choices: [...choices], sourceLines }));
const questState = (authority, id) => Number(authority?.questStates?.[id] ?? -1);
const evolve = (state, patch) => ({ ...state, ...patch, revision: Number(state.revision) + 1, updatedAt: new Date().toISOString() });
const step = (id, type, interruptPolicy) => ({ id, type, interruptPolicy, missionStage: { type: type === QuestStepType.ROUTE_EVENT ? MissionStageType.ROUTE_EVENT : MissionStageType.DIALOG } });
const checkpoint = (state, stepId, data) => ({
  completedSteps: state.completedSteps.includes(stepId) ? [...state.completedSteps] : [...state.completedSteps, stepId],
  checkpoint: { stepId, completedSteps: state.completedSteps.includes(stepId) ? [...state.completedSteps] : [...state.completedSteps, stepId], data: structuredClone(data ?? null), createdAt: new Date().toISOString() },
});

export function rogueServerCommand(action) {
  const [name, value] = String(action).split(':', 2);
  return { name: 'terminal_rogue_sync', arguments: value == null ? [name] : [name, value] };
}

export function rogueEligibility(authority) {
  const failures = [];
  if (Number(authority?.currentJob) !== ROGUE_THIEF_JOB_ID) failures.push('JOB_MUST_BE_THIEF');
  if (Number(authority?.jobLevel) < 40) failures.push('JOB_LEVEL_40_REQUIRED');
  if (Number(authority?.skillPoint) !== 0) failures.push('UNUSED_FIRST_JOB_SKILL_POINTS');
  if (Number(authority?.currentJob) === ROGUE_JOB_ID || questState(authority, 2027) === 2) failures.push('ROGUE_QUEST_ALREADY_COMPLETED');
  return { eligible: failures.length === 0, failures };
}

export function initializeRogueState(state) {
  if (state.rogue) return state;
  return {
    ...state,
    rogue: {
      phase: RoguePhase.IDLE,
      formalQuestStarted: false,
      sourceState: null,
      quiz: null,
      resource: null,
      branch: null,
      route: { nodeId: null, history: [], cost: { hp: 0, sp: 0 }, handledAuthorityRevision: 0, strategy: null },
      results: { quiz: false, resource: false, branch: false, password: false, route: false, jobChange: false },
    },
  };
}

export function selectRogueCareer(state, careerTarget) {
  state = initializeRogueState(state);
  const target = String(careerTarget ?? '').toUpperCase();
  if (!['ASSASSIN', 'ROGUE'].includes(target)) throw new Error('CAREER_TARGET_INVALID');
  if ((state.rogue.formalQuestStarted || state.formalQuestStarted) && target !== 'ROGUE') throw new Error('ROGUE_QUEST_ALREADY_STARTED');
  return evolve(state, { careerTarget: target, rogue: target === 'ROGUE' ? state.rogue : { ...state.rogue, phase: RoguePhase.IDLE } });
}

function objective(state, phase, id, type, interruptPolicy, missionStage, currentObjective, roguePatch = {}, rootPatch = {}) {
  return evolve(state, {
    ...rootPatch,
    questStatus: rootPatch.questStatus ?? QuestStatus.RUNNING,
    currentStep: step(id, type, interruptPolicy),
    currentObjective,
    objectiveId: id,
    objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
    agentLease: null,
    interruptPolicy,
    missionStage,
    rogue: { ...state.rogue, ...roguePatch, phase },
  });
}

function serverObjective(state, phase, action, title, roguePatch = {}, rootPatch = {}) {
  return objective(state, phase, `rogue.server.${String(action).split(':')[0]}`, QuestStepType.OBJECTIVE, InterruptPolicy.LOCKED,
    { type: MissionStageType.DIALOG, title, status: 'SERVER_PENDING' },
    { type: 'SERVER_COMMAND', action: String(action).split(':')[0], serverCommand: rogueServerCommand(action) }, roguePatch, rootPatch);
}

export function beginRogueNavigation(state, authority) {
  state = initializeRogueState(state);
  const eligibility = rogueEligibility(authority);
  if (state.careerTarget !== 'ROGUE') throw new Error('ROGUE_CAREER_TARGET_REQUIRED');
  if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
  return objective(state, RoguePhase.NAVIGATING, 'rogue.navigate_guild', QuestStepType.OBJECTIVE, InterruptPolicy.DEFERRED,
    { type: MissionStageType.NAVIGATION, title: '前往 Rogue Guild', currentMap: authority.map ?? null, nextMap: ROGUE_SOURCE.guildMap, objective: '前往 Markie 所在的 Rogue Guild', formalQuestStarted: false },
    { type: 'SERVER_COMMAND', action: 'navigate_guild', serverCommand: rogueServerCommand('navigate_guild') }, {}, {
      questId: ROGUE_CAREER_JOURNEY_ID, questSessionId: state.questSessionId ?? randomUUID(), completedSteps: [], checkpoint: null,
    });
}

function resourceStatus(authority, branch) {
  const definition = ROGUE_RESOURCE_BRANCHES[branch];
  if (!definition) return { ready: false, missingZeny: 0, missingItems: [] };
  const zeny = Number(authority?.zeny ?? 0);
  const missingItems = definition.items
    .map((item) => ({ ...item, current: Number(authority?.items?.[item.itemId] ?? 0), missing: Math.max(0, item.amount - Number(authority?.items?.[item.itemId] ?? 0)) }))
    .filter((item) => item.missing > 0);
  return { ready: zeny >= definition.zeny && missingItems.length === 0, missingZeny: Math.max(0, definition.zeny - zeny), missingItems };
}

function normalizePassword(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function applyRogueAction(state, action, payload, authority, { preflight = null } = {}) {
  state = initializeRogueState(state);
  const phase = state.rogue.phase;
  if (action === 'NAVIGATE_GUILD') return beginRogueNavigation(state, authority);
  if (action === 'ACCEPT_QUEST') {
    if (phase !== RoguePhase.AT_GUILD) throw new Error('ROGUE_GUILD_NOT_REACHED');
    const eligibility = rogueEligibility(authority);
    if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
    if (authority?.map !== ROGUE_SOURCE.guildMap && Number(authority?.variables?.terminal_rogue_arrived) !== 1) throw new Error('ROGUE_GUILD_NOT_REACHED');
    return serverObjective(state, RoguePhase.ACCEPTING, 'accept', '由 Markie 正式受理 Rogue 轉職考試');
  }
  if (action === 'SUBMIT_QUIZ') {
    if (phase !== RoguePhase.QUIZ) throw new Error('QUIZ_NOT_ACTIVE');
    const set = ROGUE_QUIZ_SETS[state.rogue.quiz.setId];
    const answers = Array.isArray(payload?.answers) ? payload.answers.map(Number) : [];
    if (answers.length !== set.length || answers.some((answer) => !Number.isInteger(answer))) throw new Error('QUIZ_ANSWERS_INVALID');
    const score = set.reduce((sum, entry, index) => sum + (entry.answers.includes(answers[index]) ? 10 : 0), 0);
    const quiz = { ...state.rogue.quiz, answers, score, passed: score > 80, attempts: Number(state.rogue.quiz.attempts) + 1 };
    if (score <= 80) return evolve(state, {
      missionStage: { type: MissionStageType.QUIZ, title: 'Rogue 知識測驗', status: 'FAILED', score, required: 90, questions: publicQuiz(set) },
      rogue: { ...state.rogue, quiz },
    });
    return serverObjective(state, RoguePhase.QUIZ_SYNC, 'quiz_pass', '測驗通過，寫入 rAthena 任務狀態', { quiz, results: { ...state.rogue.results, quiz: true } });
  }
  if (action === 'ASSIGN_RESOURCE') {
    if (phase !== RoguePhase.RESOURCE_READY) throw new Error('RESOURCE_STAGE_NOT_READY');
    return serverObjective(state, RoguePhase.RESOURCE_ASSIGNING, 'assign_resource', '由 Mr. Smith 決定資源分支');
  }
  if (action === 'SUBMIT_RESOURCE') {
    if (phase !== RoguePhase.RESOURCE_REQUIRED) throw new Error('RESOURCE_STAGE_NOT_ACTIVE');
    const status = resourceStatus(authority, state.rogue.resource.branch);
    if (!status.ready) return evolve(state, {
      missionStage: { ...state.missionStage, type: MissionStageType.RESULT, status: 'INSUFFICIENT', missingZeny: status.missingZeny, missingItems: status.missingItems },
    });
    return serverObjective(state, RoguePhase.RESOURCE_SYNC, 'submit_resource', 'Mr. Smith 正在驗證並扣除資源');
  }
  if (action === 'ASSIGN_BRANCH') {
    if (phase !== RoguePhase.BRANCH_READY) throw new Error('BRANCH_STAGE_NOT_READY');
    return serverObjective(state, RoguePhase.BRANCH_ASSIGNING, 'assign_branch', '由伺服器固定聯絡人與路線');
  }
  if (action === 'SUBMIT_PASSWORD') {
    if (phase !== RoguePhase.BRANCH) throw new Error('PASSWORD_NOT_ACTIVE');
    const branch = ROGUE_BRANCHES[state.rogue.branch.id];
    if (!branch) throw new Error('ROGUE_BRANCH_INVALID');
    if (normalizePassword(payload?.input) !== normalizePassword(branch.password)) {
      return evolve(state, { missionStage: { ...state.missionStage, type: MissionStageType.CHOICE, status: 'INVALID_INPUT', retry: true } });
    }
    return serverObjective(state, RoguePhase.PASSWORD_SYNC, `password:${branch.passwordCode}`, '密碼由伺服器驗證', { branch: { ...state.rogue.branch, passwordAccepted: true } });
  }
  if (action === 'ROUTE_CHOICE') {
    if (phase !== RoguePhase.ROUTE_DECISION) throw new Error('ROUTE_DECISION_NOT_ACTIVE');
    const node = ROGUE_ROUTE_EVENTS[state.rogue.route.nodeId];
    const choice = node?.choices.find((entry) => entry.id === payload?.choiceId);
    if (!choice) throw new Error('ROUTE_CHOICE_INVALID');
    return serverObjective(state, RoguePhase.ROUTE_DECISION_SYNC, `route_choice:${choice.serverCode}`, '套用路線判斷的實際成本', {
      route: { ...state.rogue.route, pendingChoice: choice },
    });
  }
  if (action === 'START_ROUTE') {
    if (phase !== RoguePhase.ROUTE_READY) throw new Error('ROUTE_NOT_READY');
    const avoidTargets = [...new Set((payload?.avoidTargets ?? []).map(Number))];
    const allowedThreats = new Set(ROGUE_THREATS.map((entry) => entry.nameId));
    if (!avoidTargets.length || avoidTargets.some((id) => !allowedThreats.has(id))) throw new Error('THREAT_POLICY_INVALID');
    if (!['CAUTIOUS', 'SHADOW', 'BALANCED'].includes(payload?.routePreference)) throw new Error('ROUTE_PREFERENCE_INVALID');
    if (!['PASS', 'WARNING'].includes(preflight?.status)) throw new Error('ROUTE_PREFLIGHT_BLOCKED');
    const strategy = { routePreference: payload.routePreference, avoidTargets, fightNecessary: payload?.fightNecessary === true };
    return serverObjective(state, RoguePhase.ROUTE_STARTING, 'route_start', '進入 Rogue 地下通道', { route: { ...state.rogue.route, strategy } }, {
      questStatus: QuestStatus.TRIAL_ACTIVE,
      activeTrial: { id: 'rogue.route', startedAt: new Date().toISOString() },
      trialInventoryLock: true,
      previousCombatPolicy: structuredClone(state.combatPolicy),
      combatPolicy: {
        mode: CombatPolicy.THREAT_AVOID,
        targets: avoidTargets,
        names: ROGUE_THREATS.filter((entry) => avoidTargets.includes(entry.nameId)).map((entry) => entry.name),
        engageAllowedTargets: strategy.fightNecessary,
      },
    });
  }
  throw new Error('ROGUE_ACTION_INVALID');
}

function sourceSnapshot(authority) {
  return {
    rogueQ: Number(authority?.variables?.ROGUE_Q ?? 0),
    resourceBranch: Number(authority?.variables?.terminal_rogue_resource_branch ?? 0),
    branch: Number(authority?.variables?.terminal_rogue_branch ?? 0),
    resourcePaid: Number(authority?.variables?.terminal_rogue_resource_paid ?? 0),
    passwordPassed: Number(authority?.variables?.terminal_rogue_password_passed ?? 0),
    routeRevision: Number(authority?.variables?.terminal_rogue_route_revision ?? 0),
    routeResult: Number(authority?.variables?.terminal_rogue_route_result ?? 0),
    routeStarted: Number(authority?.variables?.terminal_rogue_route_started ?? 0),
    quests: authority?.questStates ?? {},
  };
}

export function reconcileRogueState(state, authority) {
  state = initializeRogueState(state);
  const phase = state.rogue.phase;
  const sourceState = sourceSnapshot(authority);
  const q = sourceState.rogueQ;
  if (phase === RoguePhase.ROUTE_ACTIVE && state.questStatus === QuestStatus.TRIAL_FAILED) {
    return evolve(state, {
      questStatus: QuestStatus.READY, currentObjective: null, objectiveId: 'rogue.route_ready', agentLease: null,
      activeTrial: null, trialInventoryLock: false, interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '地下路線中斷', status: 'READY_TO_RETRY', checkpoint: state.checkpoint, actionLabel: '從路線 checkpoint 重試' },
      rogue: { ...state.rogue, phase: RoguePhase.ROUTE_READY, sourceState },
    });
  }
  if (phase === RoguePhase.NAVIGATING && (authority?.map === ROGUE_SOURCE.guildMap || Number(authority?.variables?.terminal_rogue_arrived) === 1)) {
    return evolve(state, { questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      missionStage: { type: MissionStageType.DIALOG, title: 'Rogue Guild 入口', status: 'READY', npc: 'Markie', formalQuestStarted: false, actionLabel: '接受 Rogue 轉職考試' },
      rogue: { ...state.rogue, phase: RoguePhase.AT_GUILD, sourceState } });
  }
  if (phase === RoguePhase.ACCEPTING && Number(authority?.variables?.terminal_rogue_formal_started) === 1) {
    const setId = Number(state.charId) % ROGUE_QUIZ_SETS.length;
    const set = ROGUE_QUIZ_SETS[setId];
    return evolve(state, { formalQuestStarted: true, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null,
      currentStep: step('rogue.quiz', QuestStepType.CHOICE, InterruptPolicy.SAFE), objectiveId: 'rogue.quiz', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.QUIZ, title: 'Rogue 知識測驗', status: 'ACTIVE', required: 90, questions: publicQuiz(set) },
      rogue: { ...state.rogue, phase: RoguePhase.QUIZ, formalQuestStarted: true, sourceState, quiz: { setId, answers: [], score: null, passed: false, attempts: 0 } } });
  }
  if (phase === RoguePhase.QUIZ_SYNC && q === 2 && questState(authority, 2017) >= 0) {
    const done = checkpoint(state, 'rogue.quiz', { score: state.rogue.quiz.score });
    return evolve(state, { ...done, questId: 2017, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      currentStep: step('rogue.resource', QuestStepType.REQUIREMENT, InterruptPolicy.SAFE), objectiveId: 'rogue.resource', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.DIALOG, title: 'Mr. Smith 資源審查', status: 'READY', actionLabel: '取得正式資源要求' },
      rogue: { ...state.rogue, phase: RoguePhase.RESOURCE_READY, sourceState } });
  }
  if (phase === RoguePhase.RESOURCE_ASSIGNING && q >= 3 && q <= 6 && ROGUE_RESOURCE_BRANCHES[q]) {
    const definition = ROGUE_RESOURCE_BRANCHES[q];
    return evolve(state, { questId: definition.questId, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      missionStage: { type: MissionStageType.RESULT, title: 'Rogue Guild 資源要求', status: 'REQUIRED', branch: q, zeny: definition.zeny, items: definition.items, webAdaptation: definition.webAdaptation ?? null, sourceLines: definition.sourceLines, actionLabel: '提交資源' },
      rogue: { ...state.rogue, phase: RoguePhase.RESOURCE_REQUIRED, sourceState, resource: { branch: q, ...definition } } });
  }
  if (phase === RoguePhase.RESOURCE_SYNC && [7, 8].includes(q) && sourceState.resourcePaid === 1) {
    const done = checkpoint(state, 'rogue.resource', { branch: state.rogue.resource.branch, zeny: state.rogue.resource.zeny });
    return evolve(state, { ...done, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      currentStep: step('rogue.branch', QuestStepType.CHOICE, InterruptPolicy.SAFE), objectiveId: 'rogue.branch', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.CHOICE, title: '取得 Rogue Guild 聯絡人', status: 'READY', actionLabel: '確認隨機分支' },
      rogue: { ...state.rogue, phase: RoguePhase.BRANCH_READY, sourceState, results: { ...state.rogue.results, resource: true } } });
  }
  if (phase === RoguePhase.BRANCH_ASSIGNING && q >= 9 && q <= 12 && ROGUE_BRANCHES[q]) {
    const branch = ROGUE_BRANCHES[q];
    return evolve(state, { questId: branch.questId, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null,
      missionStage: { type: MissionStageType.CHOICE, title: `聯絡 ${branch.contact}`, status: 'INPUT_REQUIRED', contact: branch.contact, npcName: branch.contact, npcKey: ROGUE_CONTACT_VISUAL_KEYS[branch.contact], npcVisualKey: ROGUE_CONTACT_VISUAL_KEYS[branch.contact], requirement: branch.requirement, passwordHint: branch.password, sourceLines: branch.sourceLines },
      rogue: { ...state.rogue, phase: RoguePhase.BRANCH, sourceState, branch: { id: q, ...branch, passwordAccepted: false }, results: { ...state.rogue.results, branch: true } } });
  }
  if (phase === RoguePhase.PASSWORD_SYNC && sourceState.passwordPassed === 1) {
    const done = checkpoint(state, 'rogue.password', { branch: state.rogue.branch.id });
    const node = ROGUE_ROUTE_EVENTS.entrance;
    return evolve(state, { ...done, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null,
      currentStep: step('rogue.route_decision', QuestStepType.ROUTE_EVENT, InterruptPolicy.DEFERRED), objectiveId: 'rogue.route_decision', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.DEFERRED,
      routeEvent: { nodeId: node.id, availableChoices: node.choices.map((entry) => entry.id), selectedRoute: null, result: null, nextNode: null, checkpoint: done.checkpoint, encounterTrigger: null, failed: false, deadEnd: false, backtrack: false },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: 'Rogue 地下路線判斷', node, cost: state.rogue.route.cost },
      rogue: { ...state.rogue, phase: RoguePhase.ROUTE_DECISION, sourceState, route: { ...state.rogue.route, nodeId: 'entrance', handledAuthorityRevision: sourceState.routeRevision }, results: { ...state.rogue.results, password: true } } });
  }
  if (phase === RoguePhase.ROUTE_DECISION_SYNC && sourceState.routeRevision > Number(state.rogue.route.handledAuthorityRevision ?? 0)) {
    const choice = state.rogue.route.pendingChoice;
    const nextNode = ROGUE_ROUTE_EVENTS[choice.next];
    const route = { ...state.rogue.route, nodeId: choice.next, pendingChoice: null, handledAuthorityRevision: sourceState.routeRevision,
      history: [...state.rogue.route.history, { nodeId: state.rogue.route.nodeId, choiceId: choice.id, result: choice.result }],
      cost: { hp: Number(authority?.variables?.terminal_rogue_route_hp_cost ?? state.rogue.route.cost.hp), sp: Number(authority?.variables?.terminal_rogue_route_sp_cost ?? state.rogue.route.cost.sp) } };
    if (choice.next === 'ready') return evolve(state, { questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, interruptPolicy: InterruptPolicy.SAFE,
      routeEvent: { nodeId: 'ready', availableChoices: [], selectedRoute: choice.id, result: choice.result, nextNode: 'ready', checkpoint: state.checkpoint, encounterTrigger: null, failed: false, deadEnd: false, backtrack: false },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: '威脅策略', status: 'READY', node: nextNode, threats: ROGUE_THREATS, cost: route.cost, actionLabel: '設定策略並進入地下通道' },
      rogue: { ...state.rogue, phase: RoguePhase.ROUTE_READY, sourceState, route } });
    return evolve(state, { questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null, interruptPolicy: InterruptPolicy.DEFERRED,
      routeEvent: { nodeId: nextNode.id, availableChoices: nextNode.choices.map((entry) => entry.id), selectedRoute: choice.id, result: choice.result, nextNode: nextNode.id, checkpoint: state.checkpoint, encounterTrigger: choice.result === 'ENCOUNTER' ? 'WEAK_MONSTER' : choice.result === 'THREAT' ? 'HIGH_THREAT' : null, failed: false, deadEnd: choice.result === 'DEAD_END', backtrack: choice.next === state.rogue.route.nodeId },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: 'Rogue 地下路線判斷', node: nextNode, result: choice.result, cost: route.cost },
      rogue: { ...state.rogue, phase: RoguePhase.ROUTE_DECISION, sourceState, route } });
  }
  if (phase === RoguePhase.ROUTE_STARTING && sourceState.routeStarted === 1 && q >= 12 && q <= 15) {
    const special = sourceState.branch === 12;
    const discoveredShortcut = sourceState.routeResult === 23;
    return evolve(state, { questId: 2026, questStatus: QuestStatus.TRIAL_ACTIVE, agentLease: null,
      currentStep: step('rogue.route_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED), objectiveId: 'rogue.route_trial', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.LOCKED,
      currentObjective: {
        type: 'GO_MAP', map: 'in_rogue', x: special ? 9 : 370, y: special ? 389 : 320, range: 2,
        completionMode: ObjectiveCompletionMode.SERVER_AUTHORITY,
        unavoidableThreatPolicy: 'REROUTE', blockedThreatRange: 2,
        preserveNavigationHold: true,
        timeoutSeconds: 300,
        waypoints: special
          ? (discoveredShortcut ? [{ x: 9, y: 389 }] : [])
          : (discoveredShortcut ? ROGUE_SHORTCUT_WAYPOINTS : ROGUE_LONG_ROUTE_WAYPOINTS),
        waypointRange: 1,
      },
      missionStage: { type: MissionStageType.TRIAL, title: 'Rogue 地下通道路線', status: 'ACTIVE', rule: 'AVOID_STRONG_FIGHT_WEAK', destination: special ? 'oneway_to_gu' : 'quest_out', strategy: state.rogue.route.strategy, threats: ROGUE_THREATS },
      rogue: { ...state.rogue, phase: RoguePhase.ROUTE_ACTIVE, sourceState } });
  }
  if (phase === RoguePhase.ROUTE_ACTIVE && [16, 17].includes(q) && questState(authority, 2026) >= 0) {
    const done = checkpoint(state, 'rogue.route_trial', { branch: sourceState.branch, officialState: q });
    return evolve(state, { ...done, questId: 2026, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      activeTrial: null, trialInventoryLock: false, combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null,
      currentStep: step('rogue.final_commit', QuestStepType.COMMIT, InterruptPolicy.LOCKED), objectiveId: 'rogue.final_commit', objectiveGeneration: Number(state.objectiveGeneration) + 1, interruptPolicy: InterruptPolicy.LOCKED,
      routeEvent: null, missionStage: { type: MissionStageType.RESULT, title: 'Rogue 轉職考驗完成', status: 'READY_TO_COMMIT', finalNpc: 'Markie', actionLabel: '完成轉職' },
      rogue: { ...state.rogue, phase: RoguePhase.FINAL_READY, sourceState, results: { ...state.rogue.results, route: true } } });
  }
  if (phase !== RoguePhase.COMPLETED && Number(authority?.currentJob) === ROGUE_JOB_ID && questState(authority, 2027) === 2) {
    const done = checkpoint(state, 'rogue.final_commit', { classId: ROGUE_JOB_ID });
    return evolve(state, { ...done, careerTarget: null, formalQuestStarted: false, questId: 2027, questStatus: QuestStatus.COMPLETED,
      currentStep: null, currentObjective: null, objectiveId: null, agentLease: null, activeTrial: null, trialInventoryLock: false,
      supplyPending: false, originalObjective: null, temporaryObjective: null, interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null, routeEvent: null,
      missionStage: { type: MissionStageType.RESULT, title: '正式轉職完成', status: 'COMPLETED', job: 'Rogue' },
      rogue: { ...state.rogue, phase: RoguePhase.COMPLETED, formalQuestStarted: true, sourceState, results: { ...state.rogue.results, jobChange: true } } });
  }
  return state;
}

function routePreflight(authority) {
  const redPotions = Number(authority?.items?.[501] ?? 0);
  return questPreflightCheck({
    character: { hp: Number(authority?.hp ?? 0), maxHp: Number(authority?.maxHp ?? 1), sp: Number(authority?.sp ?? 0), maxSp: Number(authority?.maxSp ?? 0) },
    recoveryItems: [{ itemId: 501, amount: redPotions, hpRecovery: 1, spRecovery: 0 }],
    riskLevel: RiskLevel.TRIAL,
    requirement: { minimumEntryHp: 1, reservedHpRecovery: 50 },
  });
}

function prepareRogueAction({ state, action, payload, authority }) {
  if (action !== 'START_ROUTE') return applyRogueAction(state, action, payload, authority);
  const preflight = routePreflight(authority);
  if (['PASS', 'WARNING'].includes(preflight.status)) return applyRogueAction(state, action, payload, authority, { preflight });
  const pending = applyRogueAction(state, action, payload, authority, { preflight: { ...preflight, status: 'PASS' } });
  return requestSupply({ ...pending, activeTrial: null, trialInventoryLock: false, interruptPolicy: InterruptPolicy.SAFE }, {
    reservation: preflight.reservation,
    temporaryObjective: { type: 'SUPPLY', reason: 'ROGUE_ROUTE_RESERVE', requirements: { items: [{ itemId: 501, minimumAmount: 10 }] } },
  });
}

const requiredItemMap = new Map([[501, 50]]);
for (const branch of Object.values(ROGUE_RESOURCE_BRANCHES)) {
  for (const item of branch.items) requiredItemMap.set(item.itemId, Math.max(requiredItemMap.get(item.itemId) ?? 0, item.amount));
}

export const ROGUE_JOB_ADAPTER = defineJobQuestAdapter({
  id: 'ROGUE', displayName: '流氓', version: 1, jobId: ROGUE_JOB_ID,
  eligibility: { sourceJobId: ROGUE_THIEF_JOB_ID, minimumJobLevel: 40, skillPoint: 0, evaluate: rogueEligibility },
  questStateMapping: ROGUE_SOURCE,
  steps: Object.freeze(['navigate_guild', 'accept', 'quiz', 'resource', 'branch', 'password', 'route_decision', 'route_trial', 'final_commit']),
  interactionDefinitions: ROGUE_INTERACTIONS,
  quizDefinitions: ROGUE_QUIZ_SETS,
  trialDefinitions: Object.freeze([{ id: 'route', combatPolicy: CombatPolicy.THREAT_AVOID, sourceLines: '1315-1395,1413-1424,1496-1506,1581-1590,1656-1967' }]),
  routeEvents: ROGUE_ROUTE_EVENTS,
  requiredItems: Object.freeze([...requiredItemMap].map(([itemId, minimumAmount]) => Object.freeze({ itemId, minimumAmount, purpose: itemId === 501 ? 'ROUTE_PREFLIGHT' : 'RESOURCE_GATE' }))),
  checkpointRules: Object.freeze({ quizFailure: 'RETRY_QUIZ', resourceFailure: 'REMAIN_RESOURCE', inputFailure: 'RETRY_INPUT', routeFailure: 'ROUTE_READY', death: 'ROUTE_READY' }),
  initializeState: initializeRogueState,
  selectCareerTarget: selectRogueCareer,
  applyAction: applyRogueAction,
  prepareAction: prepareRogueAction,
  reconcileState: reconcileRogueState,
  publicState: (state) => structuredClone(state.rogue ?? null),
  publicStatus: (state) => ({ phase: state.rogue?.phase ?? RoguePhase.IDLE, active: ![RoguePhase.IDLE, RoguePhase.COMPLETED].includes(state.rogue?.phase ?? RoguePhase.IDLE), formalQuestStarted: state.rogue?.formalQuestStarted === true }),
  shouldAutoDispatch: (state) => state.rogue?.phase === RoguePhase.ROUTE_ACTIVE && state.currentObjective?.type === 'GO_MAP' && state.questStatus === QuestStatus.TRIAL_ACTIVE && !state.agentLease,
  finalCommit: {
    commitType: CommitType.JOB_CHANGE,
    payload: Object.freeze({ adapterId: 'ROGUE', targetJobId: ROGUE_JOB_ID }),
    completionQuestId: 2027,
    command: rogueServerCommand('commit'),
    validate: ({ authority, payload }) => {
      if (payload?.adapterId !== 'ROGUE' || Number(payload?.targetJobId) !== ROGUE_JOB_ID) throw new Error('JOB_ADAPTER_COMMIT_PAYLOAD_INVALID');
      const eligibility = rogueEligibility(authority);
      if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
      const q = Number(authority?.variables?.ROGUE_Q ?? 0);
      if (![16, 17].includes(q) || questState(authority, 2026) < 0 || Number(authority?.variables?.terminal_rogue_resource_paid) !== 1 || Number(authority?.variables?.terminal_rogue_password_passed) !== 1 || Number(authority?.variables?.terminal_rogue_route_started) !== 1 || authority?.map !== 'in_rogue') throw new Error('ROGUE_FINAL_STATE_INVALID');
    },
    isComplete: (authority) => Number(authority?.currentJob) === ROGUE_JOB_ID && questState(authority, 2027) === 2,
    result: (authority) => ({ verified: true, currentJob: Number(authority.currentJob), questId: 2027, questState: questState(authority, 2027), authority: 'rAthena/MariaDB', adapterId: 'ROGUE' }),
  },
});
