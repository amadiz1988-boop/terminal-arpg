import { randomUUID } from 'node:crypto';
import {
  CombatPolicy,
  CommitType,
  InterruptPolicy,
  MissionStageType,
  QuestStatus,
  QuestStepType,
  RiskLevel,
} from './contracts.mjs';
import { defineJobQuestAdapter } from './job-adapter-contract.mjs';
import { defineMissionInteractionDefinitions } from './mission-interaction-contract.mjs';
import { questPreflightCheck, requestSupply } from './runtime.mjs';

export const KNIGHT_CAREER_JOURNEY_ID = 28003;
export const KNIGHT_JOB_ID = 7;
export const SWORDMAN_JOB_ID = 1;

export const KnightPhase = Object.freeze({
  IDLE: 'IDLE', NAVIGATING: 'NAVIGATING', AT_GUILD: 'AT_GUILD', ACCEPTING: 'ACCEPTING',
  ITEM_ASSIGNING: 'ITEM_ASSIGNING', ITEM_REQUIRED: 'ITEM_REQUIRED', ITEM_SYNC: 'ITEM_SYNC',
  QUIZ: 'QUIZ', QUIZ_SYNC: 'QUIZ_SYNC', WAVE_READY: 'WAVE_READY',
  WAVE_STARTING: 'WAVE_STARTING', WAVE_ACTIVE: 'WAVE_ACTIVE', ETHICS: 'ETHICS',
  ETHICS_SYNC: 'ETHICS_SYNC', NO_KILL_READY: 'NO_KILL_READY',
  NO_KILL_STARTING: 'NO_KILL_STARTING', NO_KILL_ACTIVE: 'NO_KILL_ACTIVE',
  FINAL_DIALOG: 'FINAL_DIALOG', FINAL_DIALOG_SYNC: 'FINAL_DIALOG_SYNC',
  FINAL_READY: 'FINAL_READY', COMPLETED: 'COMPLETED',
});

export const KNIGHT_INTERACTIONS = defineMissionInteractionDefinitions({
  AT_GUILD: {
    interactionKey: 'knight.entry', npcId: 'Chivalry Captain#knt', npcKey: 'knight.captain-herman', npcName: 'Captain Herman', npcVisualKey: 'knight.captain-herman',
    dialogLines: [
      { id: 'knight.entry.welcome', text: '歡迎來到普隆德拉騎士團。我是騎士團長 Captain Herman。', sourceRef: 'npc/jobs/2-1/knight.txt:97-112' },
      { id: 'knight.entry.requirements', text: '騎士團只受理 Job Lv.40 以上且已配置完技能點的劍士。', sourceRef: 'npc/jobs/2-1/knight.txt:113-136' },
      { id: 'knight.entry.confirm', text: '確認申請後，騎士團會依序進行各項轉職考驗。', sourceRef: 'npc/jobs/2-1/knight.txt:118-160' },
    ],
    autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'ACCEPT_QUEST', label: '接受騎士轉職考試', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/knight.txt:97-160',
  },
  ACCEPTING: {
    interactionKey: 'knight.entry.accepted', npcId: 'Chivalry Captain#knt', npcKey: 'knight.captain-herman', npcName: 'Captain Herman', npcVisualKey: 'knight.captain-herman',
    dialogLines: [
      { id: 'knight.entry.accepted-1', text: '你的申請已受理。接下來必須拜訪多位騎士並通過各自的考驗。', sourceRef: 'npc/jobs/2-1/knight.txt:138-150' },
      { id: 'knight.entry.accepted-2', text: '所有負責考驗的騎士都認可後，你才能加入普隆德拉騎士團。', sourceRef: 'npc/jobs/2-1/knight.txt:149-160' },
    ],
    autoAdvanceAllowed: true, requiresPlayerInput: false, availableActions: [],
    sourceRef: 'npc/jobs/2-1/knight.txt:138-160',
  },
  QUIZ: {
    interactionKey: 'knight.quiz', npcId: 'Sir Siracuse#knt', npcKey: 'knight.sir-siracuse', npcName: 'Sir Siracuse', npcVisualKey: 'knight.sir-siracuse',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_QUIZ', label: '提交答案', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/knight.txt:673-1000',
  },
  QUIZ_SYNC: {
    interactionKey: 'knight.quiz.result', npcId: 'Sir Siracuse#knt', npcKey: 'knight.sir-siracuse', npcName: 'Sir Siracuse', npcVisualKey: 'knight.sir-siracuse',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: false, availableActions: [],
    sourceRef: 'npc/jobs/2-1/knight.txt:673-1000',
  },
  ETHICS: {
    interactionKey: 'knight.ethics', npcId: 'Lady Amy#knt', npcKey: 'knight.lady-amy', npcName: 'Lady Amy', npcVisualKey: 'knight.lady-amy',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_ETHICS', label: '提交答案', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/knight.txt:1449-1711',
  },
  FINAL_DIALOG: {
    interactionKey: 'knight.sir-gray', npcId: 'Sir Gray#knt', npcKey: 'knight.sir-gray', npcName: 'Sir Gray', npcVisualKey: 'knight.sir-gray',
    dialogLines: [], autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_FINAL_DIALOG', label: '提交面談回答', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/knight.txt:2006-2466',
  },
  FINAL_READY: {
    interactionKey: 'knight.final', npcId: 'Chivalry Captain#knt', npcKey: 'knight.captain-herman', npcName: 'Captain Herman', npcVisualKey: 'knight.captain-herman',
    dialogLines: [{ id: 'knight.final.ready', text: '所有騎士已完成審查。最後的轉職仍需由你親自確認。', sourceRef: 'npc/jobs/2-1/knight.txt:304-439' }],
    autoAdvanceAllowed: false, requiresPlayerInput: true,
    availableActions: [{ id: 'FINAL_COMMIT', label: '完成轉職', kind: 'SERVER_COMMIT' }],
    sourceRef: 'npc/jobs/2-1/knight.txt:304-439',
  },
});

export const KNIGHT_SOURCE = Object.freeze({
  file: 'npc/jobs/2-1/knight.txt',
  loadedBy: 'npc/scripts_jobs.conf:14',
  revision: 'e985006171d2eb320ee512a653f4c83aea3d81b6',
  sha256: '721114D49F647583707A309AA2D94D90D8D9B03489D381CA3E44ED7F90509F52',
  eligibility: Object.freeze({ baseJob: SWORDMAN_JOB_ID, minimumJobLevel: 40, skillPoint: 0, lines: '45,54,97-139' }),
  guildMap: 'prt_in',
  guildNpc: Object.freeze({ name: 'Chivalry Captain#knt', displayName: 'Captain Herman', x: 88, y: 101, lines: '45-150' }),
  questIds: Object.freeze([9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 9010, 9011, 9012]),
  variables: Object.freeze([
    'KNIGHT_Q', 'terminal_knight_arrived', 'terminal_knight_formal_started',
    'terminal_knight_item_branch', 'terminal_knight_item_seed', 'terminal_knight_wave',
    'terminal_knight_wave_kills', 'terminal_knight_wave_result', 'terminal_knight_ethics_passed',
    'terminal_knight_nokill_started', 'terminal_knight_no_kill_result',
    'terminal_knight_final_passed',
  ]),
  finalJob: KNIGHT_JOB_ID,
  finalState: Object.freeze({ knightQ: 14, questId: 9012, lines: '304-308,429-439' }),
});

const item = (itemId, amount, name) => Object.freeze({ itemId, amount, name });
export const KNIGHT_ITEM_BRANCHES = Object.freeze({
  2: Object.freeze({ questId: 9001, items: Object.freeze([
    item(1040, 5, "Elder Pixie's Beard"), item(7006, 5, 'Wing of Red Bat'), item(931, 5, 'Orcish Voucher'),
    item(1057, 5, 'Moth Dust'), item(903, 5, 'Reptile Tongue'), item(1028, 5, "Wild Boar's Mane"),
  ]), sourceLines: '576-590,613-631' }),
  3: Object.freeze({ questId: 9002, items: Object.freeze([
    item(1042, 5, 'Short Leg'), item(950, 5, 'Heart of Mermaid'), item(1032, 5, 'Blossom of Maneater'),
    item(966, 5, 'Flesh of Clam'), item(7031, 5, 'Old Frying Pan'), item(946, 5, "Snail's Shell"),
  ]), sourceLines: '576-590,613-631' }),
});

const question = (id, prompt, choices, answer, sourceLines) => Object.freeze({ id, prompt, choices: Object.freeze(choices), answer, sourceLines });
export const KNIGHT_QUIZ = Object.freeze([
  question('q1', '哪一種武器不受 Two Hand Quicken 影響？', ['Katana', 'Slayer', 'Broadsword', 'Flamberge'], 3, '863-876'),
  question('q2', '學習 Bowling Bash 不需要哪項條件？', ['Two Handed Sword Mastery Lv.5', 'Magnum Break Lv.3', 'Provoke Lv.10', 'Bash Lv.10'], 2, '878-886'),
  question('q3', '學習 Brandish Spear 不需要哪項條件？', ['Pierce Lv.5', 'Spear Stab Lv.3', 'Spear Boomerang Lv.3', 'Peco Peco Ride Lv.1'], 2, '888-899'),
  question('q4', '哪一把槍能攻擊 Ghost 屬性的 Nightmare？', ['Zephyrus', 'Lance', 'Bill Guisarme', 'Crescent Scythe'], 0, '901-911'),
  question('q5', 'Cavalier Mastery Lv.3 保留多少一般攻速？', ['70%', '80%', '90%', '100%'], 1, '913-927'),
  question('q6', '城裡遇到求助的 Novice 時應怎麼做？', ['提供合理狩獵地點', '替他承受所有傷害', '直接給大量物資'], 0, '933-951'),
  question('q7', '在隊伍中應採取哪種行動？', ['站在前線保護全隊', '聚集所有怪物一次消滅', '不計代價取得物品'], 0, '953-973'),
  question('q8', '騎士最重要的價值是什麼？', ['榮譽與保護弱者', '只追求個人力量', '財富與名聲'], 0, '977-1000'),
]);

export const KNIGHT_WAVES = Object.freeze([
  Object.freeze({ wave: 1, timeoutSeconds: 180, total: 8, sourceLines: '1257-1273', renewal: true, monsters: Object.freeze([
    Object.freeze({ nameId: 1160, name: 'Piere', amount: 2 }),
    Object.freeze({ nameId: 1095, name: 'Andre', amount: 2 }), Object.freeze({ nameId: 1105, name: 'Deniro', amount: 2 }),
    Object.freeze({ nameId: 1100, name: 'Argos', amount: 2 }),
  ]) }),
  Object.freeze({ wave: 2, timeoutSeconds: 180, total: 6, sourceLines: '1323-1339', renewal: true, monsters: Object.freeze([
    Object.freeze({ nameId: 1119, name: 'Frilldora', amount: 2 }), Object.freeze({ nameId: 1111, name: 'Drainliar', amount: 4 }),
  ]) }),
  Object.freeze({ wave: 3, timeoutSeconds: 180, total: 5, sourceLines: '1388-1399', renewal: true, monsters: Object.freeze([
    Object.freeze({ nameId: 1122, name: 'Goblin', amount: 1 }), Object.freeze({ nameId: 1123, name: 'Goblin', amount: 1 }),
    Object.freeze({ nameId: 1124, name: 'Goblin', amount: 1 }), Object.freeze({ nameId: 1125, name: 'Goblin', amount: 1 }),
    Object.freeze({ nameId: 1126, name: 'Goblin', amount: 1 }),
  ]) }),
]);

export const KNIGHT_ETHICS = Object.freeze([
  question('e1', '在 Morocc 尋找隊伍時怎麼做？', ['大聲徵求隊伍', '開聊天室等待', '找正在徵騎士的人'], null, '1616-1620'),
  question('e2', '隊伍到達金字塔四樓後怎麼做？', ['先勘查並規劃', '替隊伍聚怪', '在前方慢慢帶隊'], null, '1622-1634'),
  question('e3', '有人引來怪群後消失時怎麼做？', ['阻止怪物接近隊伍', '掩護隊伍撤退', '騎 Peco Peco 逃跑'], null, '1635-1639'),
  question('e4', '倒地路人禮貌求助時怎麼做？', ['請隊伍 Priest 幫忙', '收費後幫忙', '忽略離開'], null, '1641-1647'),
  question('e5', '離隊前取得稀有物品時怎麼做？', ['交給最有功勞者', '假裝沒發生並留下', '與隊伍決定歸屬'], null, '1649-1658'),
  question('e6', '在 Prontera 出售物品時怎麼做？', ['大聲叫賣', '開聊天室等待', '逐一詢問'], null, '1660-1667'),
  question('e7', '有人乞討物品與 Zeny 時怎麼做？', ['給予物資', '忽略', '建議狩獵地點'], null, '1669-1675'),
  question('e8', '在 Hidden Temple 遇到迷路者時怎麼做？', ['告知出口方向', '帶到出口', '給 Butterfly Wing'], null, '1677-1685'),
  question('e9', '低 HP 時向 Priest 求 Heal 怎麼說？', ['禮貌詢問能否治療', '直接問能不能 Heal', '命令對方 Heal'], null, '1687-1697'),
  question('e10', '路上發現稀有物品時怎麼做？', ['撿起留下', '詢問失主', '直接走過'], null, '1699-1711'),
]);

export const KNIGHT_FINAL_DIALOG = Object.freeze({
  reasons: Object.freeze([
    Object.freeze({ prompt: '想變得更強', followups: Object.freeze(['取得財富與名聲', '保護自己', '保護他人']), penalties: Object.freeze([10, 0, 0]) }),
    Object.freeze({ prompt: '幫助公會', followups: Object.freeze(['公會需要我', '替公會籌款', '保護公會成員']), penalties: Object.freeze([0, 10, 0]) }),
    Object.freeze({ prompt: '對目前的自己不滿意', followups: Object.freeze(['技能', '目標', '外表']), penalties: Object.freeze([10, 0, 10]) }),
  ]),
  plans: Object.freeze([
    Object.freeze({ prompt: '立刻投入戰鬥', followups: Object.freeze(['快速成長', '測試騎士能力', '前往更困難區域']), penalties: Object.freeze([10, 0, 0]) }),
    Object.freeze({ prompt: '去見等待我的人', followups: Object.freeze(['朋友', '公會成員', '愛人']), penalties: Object.freeze([0, 0, 0]) }),
    Object.freeze({ prompt: '繼續了解騎士', followups: Object.freeze(['舒適地點', '騎士道路', '賺錢方式']), penalties: Object.freeze([5, 0, 15]) }),
  ]),
  acceptedTotals: Object.freeze([0, 5, 10]), sourceLines: '2120-2466',
});

const questState = (authority, id) => Number(authority?.questStates?.[id] ?? -1);
const evolve = (state, patch) => ({ ...state, ...patch, revision: Number(state.revision) + 1, updatedAt: new Date().toISOString() });
const step = (id, type, interruptPolicy) => ({ id, type, interruptPolicy, missionStage: { type: type === QuestStepType.TRIAL ? MissionStageType.TRIAL : MissionStageType.DIALOG } });
const checkpoint = (state, stepId, data) => {
  const completedSteps = state.completedSteps.includes(stepId) ? [...state.completedSteps] : [...state.completedSteps, stepId];
  return { completedSteps, checkpoint: { stepId, completedSteps, data: structuredClone(data ?? null), createdAt: new Date().toISOString() } };
};
const publicQuestions = (questions) => questions.map(({ id, prompt, choices, sourceLines }) => ({ id, prompt, choices: [...choices], sourceLines }));

export function knightServerCommand(action, values = []) {
  return { name: 'terminal_knight_sync', arguments: [action, ...values.map(String)] };
}
export function knightEligibility(authority) {
  const failures = [];
  if (Number(authority?.currentJob) !== SWORDMAN_JOB_ID) failures.push('JOB_MUST_BE_SWORDMAN');
  if (Number(authority?.jobLevel) < 40) failures.push('JOB_LEVEL_40_REQUIRED');
  if (Number(authority?.skillPoint) !== 0) failures.push('UNUSED_FIRST_JOB_SKILL_POINTS');
  if (Number(authority?.currentJob) === KNIGHT_JOB_ID || questState(authority, 9012) === 2) failures.push('KNIGHT_QUEST_ALREADY_COMPLETED');
  return { eligible: failures.length === 0, failures };
}
export function initializeKnightState(state) {
  if (state.knight) return state;
  return { ...state, knight: {
    phase: KnightPhase.IDLE, formalQuestStarted: false, sourceState: null, itemBranch: null,
    quiz: { answers: [], attempts: 0, passed: false }, ethics: { answers: [], attempts: 0, score: null, passed: false },
    wave: { current: 0, kills: 0, startedAt: null }, noKill: { startedAt: null, durationSeconds: 300 },
    finalDialog: { answers: null, attempts: 0, score: null, passed: false },
    results: { items: false, quiz: false, waves: false, ethics: false, noKill: false, finalDialog: false, jobChange: false },
  } };
}
export function selectKnightCareer(state, careerTarget) {
  state = initializeKnightState(state);
  const target = String(careerTarget ?? '').toUpperCase();
  if (target !== 'KNIGHT') throw new Error('CAREER_TARGET_INVALID');
  if ((state.knight.formalQuestStarted || state.formalQuestStarted) && target !== 'KNIGHT') throw new Error('KNIGHT_QUEST_ALREADY_STARTED');
  return evolve(state, { careerTarget: target });
}
function objective(state, phase, id, type, interruptPolicy, missionStage, currentObjective, knightPatch = {}, rootPatch = {}) {
  return evolve(state, { ...rootPatch, questStatus: rootPatch.questStatus ?? QuestStatus.RUNNING,
    currentStep: step(id, type, interruptPolicy), currentObjective, objectiveId: id,
    objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1, agentLease: null, interruptPolicy, missionStage,
    knight: { ...state.knight, ...knightPatch, phase } });
}
function serverObjective(state, phase, action, title, values = [], knightPatch = {}, rootPatch = {}) {
  return objective(state, phase, `knight.server.${action}`, QuestStepType.OBJECTIVE, InterruptPolicy.LOCKED,
    { type: MissionStageType.DIALOG, title, status: 'SERVER_PENDING' },
    { type: 'SERVER_COMMAND', action, serverCommand: knightServerCommand(action, values), preserveNavigationHold: true }, knightPatch, rootPatch);
}
export function beginKnightNavigation(state, authority) {
  state = initializeKnightState(state);
  if (state.careerTarget !== 'KNIGHT') throw new Error('KNIGHT_CAREER_TARGET_REQUIRED');
  const eligibility = knightEligibility(authority); if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
  return objective(state, KnightPhase.NAVIGATING, 'knight.navigate_guild', QuestStepType.OBJECTIVE, InterruptPolicy.DEFERRED,
    { type: MissionStageType.NAVIGATION, title: '前往普隆德拉騎士團', currentMap: authority.map ?? null, nextMap: 'prt_in', npc: 'Captain Herman', formalQuestStarted: false },
    { type: 'SERVER_COMMAND', action: 'navigate_guild', serverCommand: knightServerCommand('navigate_guild'), preserveNavigationHold: true }, {},
    { questId: KNIGHT_CAREER_JOURNEY_ID, questSessionId: state.questSessionId ?? randomUUID(), completedSteps: [], checkpoint: null });
}
function itemStatus(authority, branchId) {
  const branch = KNIGHT_ITEM_BRANCHES[branchId];
  const missingItems = (branch?.items ?? []).map((entry) => ({ ...entry, current: Number(authority?.items?.[entry.itemId] ?? 0), missing: Math.max(0, entry.amount - Number(authority?.items?.[entry.itemId] ?? 0)) })).filter((entry) => entry.missing > 0);
  return { ready: Boolean(branch) && missingItems.length === 0, missingItems };
}
function ethicsScore(answers) {
  const penalties = [answers[0] !== 0, answers[1] !== 1, answers[2] !== 2, answers[3] === 0, answers[4] !== 1,
    answers[5] !== 0, answers[6] === 2, answers[7] !== 2, answers[8] === 0, answers[9] !== 0];
  return penalties.filter(Boolean).length * 10;
}
function validateAnswers(answers, size) {
  return Array.isArray(answers) && answers.length === size && answers.every((answer) => Number.isInteger(Number(answer)) && Number(answer) >= 0);
}
export function applyKnightAction(state, action, payload, authority, { preflight = null } = {}) {
  state = initializeKnightState(state); const phase = state.knight.phase;
  if (action === 'NAVIGATE_GUILD') return beginKnightNavigation(state, authority);
  if (action === 'ACCEPT_QUEST') {
    if (phase !== KnightPhase.AT_GUILD) throw new Error('KNIGHT_GUILD_NOT_REACHED');
    const eligibility = knightEligibility(authority); if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
    if (authority?.map !== 'prt_in' && Number(authority?.variables?.terminal_knight_arrived) !== 1) throw new Error('KNIGHT_GUILD_NOT_REACHED');
    return serverObjective(state, KnightPhase.ACCEPTING, 'accept', 'Captain Herman 正式受理騎士轉職考試');
  }
  if (action === 'ASSIGN_ITEMS') {
    if (phase !== KnightPhase.ITEM_ASSIGNING) throw new Error('ITEM_STAGE_NOT_READY');
    return serverObjective(state, KnightPhase.ITEM_ASSIGNING, 'assign_items', 'Sir Andrew 決定材料組');
  }
  if (action === 'SUBMIT_ITEMS') {
    if (phase !== KnightPhase.ITEM_REQUIRED) throw new Error('ITEM_STAGE_NOT_ACTIVE');
    const status = itemStatus(authority, state.knight.itemBranch?.id);
    if (!status.ready) return evolve(state, { missionStage: { ...state.missionStage, type: MissionStageType.RESULT, status: 'INSUFFICIENT', missingItems: status.missingItems } });
    return serverObjective(state, KnightPhase.ITEM_SYNC, 'submit_items', 'Sir Andrew 驗證並收取材料');
  }
  if (action === 'SUBMIT_QUIZ') {
    if (phase !== KnightPhase.QUIZ) throw new Error('QUIZ_NOT_ACTIVE');
    const answers = payload?.answers?.map(Number); if (!validateAnswers(answers, KNIGHT_QUIZ.length)) throw new Error('QUIZ_ANSWERS_INVALID');
    const passed = KNIGHT_QUIZ.every((entry, index) => answers[index] === entry.answer);
    const quiz = { answers, attempts: Number(state.knight.quiz.attempts) + 1, passed };
    if (!passed) return evolve(state, { missionStage: { type: MissionStageType.QUIZ, title: '騎士知識測驗', status: 'FAILED', questions: publicQuestions(KNIGHT_QUIZ) }, knight: { ...state.knight, quiz } });
    return serverObjective(state, KnightPhase.QUIZ_SYNC, 'quiz_pass', 'Sir Siracuse 寫入測驗結果', [], { quiz });
  }
  if (action === 'START_WAVES') {
    if (phase !== KnightPhase.WAVE_READY) throw new Error('WAVE_TRIAL_NOT_READY');
    if (!['PASS', 'WARNING'].includes(preflight?.status)) throw new Error('WAVE_PREFLIGHT_BLOCKED');
    return objective(state, KnightPhase.WAVE_STARTING, 'knight.wave_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED,
      { type: MissionStageType.TRIAL, title: 'Windsor 三波戰鬥試煉', status: 'STARTING', rule: 'WAVE_BATTLE', buildCheck: 'PASS' },
      { type: 'SERVER_COMMAND', action: 'wave_start', after: 'COMBAT_HOLD', serverCommand: knightServerCommand('wave_start'), completionQuestId: 9007, preserveNavigationHold: true },
      { wave: { current: 1, kills: 0, startedAt: new Date().toISOString() } },
      { questStatus: QuestStatus.TRIAL_ACTIVE, activeTrial: { id: 'knight.wave', startedAt: new Date().toISOString() }, trialInventoryLock: true, previousCombatPolicy: structuredClone(state.combatPolicy), combatPolicy: { mode: CombatPolicy.NORMAL, targets: [] } });
  }
  if (action === 'SUBMIT_ETHICS') {
    if (phase !== KnightPhase.ETHICS) throw new Error('ETHICS_NOT_ACTIVE');
    const answers = payload?.answers?.map(Number); if (!validateAnswers(answers, KNIGHT_ETHICS.length)) throw new Error('ETHICS_ANSWERS_INVALID');
    const score = ethicsScore(answers); const passed = [90, 100].includes(score);
    const ethics = { answers, attempts: Number(state.knight.ethics.attempts) + 1, score, passed };
    if (!passed) return evolve(state, { missionStage: { type: MissionStageType.CHOICE, title: 'Lady Amy 騎士倫理測驗', status: 'FAILED', score, acceptedScores: [90, 100], questions: publicQuestions(KNIGHT_ETHICS) }, knight: { ...state.knight, ethics } });
    return serverObjective(state, KnightPhase.ETHICS_SYNC, 'ethics_pass', 'Lady Amy 驗證答案', answers, { ethics });
  }
  if (action === 'START_NO_KILL') {
    if (phase !== KnightPhase.NO_KILL_READY) throw new Error('NO_KILL_NOT_READY');
    if (!['PASS', 'WARNING'].includes(preflight?.status)) throw new Error('NO_KILL_PREFLIGHT_BLOCKED');
    return objective(state, KnightPhase.NO_KILL_STARTING, 'knight.no_kill_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED,
      { type: MissionStageType.TRIAL, title: 'Sir Edmond 禁殺試煉', status: 'STARTING', rule: 'NO_KILL', durationSeconds: 300 },
      { type: 'SERVER_COMMAND', action: 'no_kill_start', after: 'COMBAT_HOLD', serverCommand: knightServerCommand('no_kill_start'), completionQuestId: 9011, preserveNavigationHold: true, trialBoundary: { map: 'job_knt', minX: 30, maxX: 60, minY: 130, maxY: 160 } },
      { noKill: { startedAt: new Date().toISOString(), durationSeconds: 300 } },
      { questStatus: QuestStatus.TRIAL_ACTIVE, activeTrial: { id: 'knight.no_kill', startedAt: new Date().toISOString() }, trialInventoryLock: true, previousCombatPolicy: structuredClone(state.combatPolicy), combatPolicy: { mode: CombatPolicy.NO_ATTACK, targets: [], avoidHostiles: true, avoidHostilesRange: 10 } });
  }
  if (action === 'SUBMIT_FINAL_DIALOG') {
    if (phase !== KnightPhase.FINAL_DIALOG) throw new Error('FINAL_DIALOG_NOT_ACTIVE');
    const values = [payload?.reason, payload?.reasonFollowup, payload?.plan, payload?.planFollowup].map(Number);
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 2)) throw new Error('FINAL_DIALOG_ANSWERS_INVALID');
    const score = KNIGHT_FINAL_DIALOG.reasons[values[0]].penalties[values[1]] + KNIGHT_FINAL_DIALOG.plans[values[2]].penalties[values[3]];
    const passed = KNIGHT_FINAL_DIALOG.acceptedTotals.includes(score);
    const finalDialog = { answers: values, attempts: Number(state.knight.finalDialog.attempts) + 1, score, passed };
    if (!passed) return evolve(state, { missionStage: { ...state.missionStage, status: 'FAILED', score }, knight: { ...state.knight, finalDialog } });
    return serverObjective(state, KnightPhase.FINAL_DIALOG_SYNC, 'final_dialog_pass', 'Sir Gray 驗證最終面談', values, { finalDialog });
  }
  throw new Error('KNIGHT_ACTION_INVALID');
}

function sourceSnapshot(authority) {
  return { q: Number(authority?.variables?.KNIGHT_Q ?? 0), branch: Number(authority?.variables?.terminal_knight_item_branch ?? 0),
    wave: Number(authority?.variables?.terminal_knight_wave ?? 0), waveKills: Number(authority?.variables?.terminal_knight_wave_kills ?? 0), waveResult: Number(authority?.variables?.terminal_knight_wave_result ?? 0),
    ethicsPassed: Number(authority?.variables?.terminal_knight_ethics_passed ?? 0), noKillStartedAt: Number(authority?.variables?.terminal_knight_nokill_started ?? 0),
    noKillResult: Number(authority?.variables?.terminal_knight_no_kill_result ?? 0), finalPassed: Number(authority?.variables?.terminal_knight_final_passed ?? 0), quests: authority?.questStates ?? {} };
}
export function reconcileKnightState(state, authority) {
  state = initializeKnightState(state); const phase = state.knight.phase; const source = sourceSnapshot(authority);
  if ([KnightPhase.WAVE_STARTING, KnightPhase.WAVE_ACTIVE].includes(phase) && state.questStatus === QuestStatus.TRIAL_FAILED) {
    return evolve(state, { questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, activeTrial: null, trialInventoryLock: false, interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '三波戰鬥中斷', status: 'READY_TO_RETRY', checkpoint: state.checkpoint }, knight: { ...state.knight, phase: KnightPhase.WAVE_READY, sourceState: source } });
  }
  if ([KnightPhase.NO_KILL_STARTING, KnightPhase.NO_KILL_ACTIVE].includes(phase) && state.questStatus === QuestStatus.TRIAL_FAILED) {
    return evolve(state, { questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, activeTrial: null, trialInventoryLock: false, interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '禁殺試煉中斷', status: 'READY_TO_RETRY', checkpoint: state.checkpoint }, knight: { ...state.knight, phase: KnightPhase.NO_KILL_READY, sourceState: source } });
  }
  if (phase === KnightPhase.NAVIGATING && (authority?.map === 'prt_in' || Number(authority?.variables?.terminal_knight_arrived) === 1))
    return evolve(state, { questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, missionStage: { type: MissionStageType.DIALOG, title: 'Captain Herman', status: 'READY', actionLabel: '接受騎士轉職考試' }, knight: { ...state.knight, phase: KnightPhase.AT_GUILD, sourceState: source } });
  if (phase === KnightPhase.ACCEPTING && source.q === 1 && questState(authority, 9000) >= 0)
    return evolve(state, { formalQuestStarted: true, questId: 9000, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, currentStep: step('knight.items', QuestStepType.REQUIREMENT, InterruptPolicy.SAFE), interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.DIALOG, title: 'Sir Andrew 材料試煉', status: 'READY', jobLevel50Skip: Number(authority?.jobLevel) === 50, actionLabel: '取得正式材料要求' }, knight: { ...state.knight, phase: KnightPhase.ITEM_ASSIGNING, formalQuestStarted: true, sourceState: source } });
  if (phase === KnightPhase.ITEM_ASSIGNING && Number(authority?.jobLevel) === 50 && source.q === 4) {
    const done = checkpoint(state, 'knight.items', { skippedByJobLevel50: true });
    return evolve(state, { ...done, questId: 9003, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null, currentStep: step('knight.quiz', QuestStepType.CHOICE, InterruptPolicy.SAFE), interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.QUIZ, title: '騎士知識測驗', status: 'ACTIVE', questions: publicQuestions(KNIGHT_QUIZ) }, knight: { ...state.knight, phase: KnightPhase.QUIZ, sourceState: source, results: { ...state.knight.results, items: true } } });
  }
  if (phase === KnightPhase.ITEM_ASSIGNING && [2, 3].includes(source.q) && KNIGHT_ITEM_BRANCHES[source.q]) {
    const branch = KNIGHT_ITEM_BRANCHES[source.q];
    return evolve(state, { questId: branch.questId, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null,
      missionStage: { type: MissionStageType.RESULT, title: 'Sir Andrew 材料要求', status: 'REQUIRED', branch: source.q, items: branch.items, sourceLines: branch.sourceLines },
      knight: { ...state.knight, phase: KnightPhase.ITEM_REQUIRED, sourceState: source, itemBranch: { id: source.q, ...branch } } });
  }
  if (phase === KnightPhase.ITEM_SYNC && source.q === 4 && questState(authority, 9003) >= 0) {
    const done = checkpoint(state, 'knight.items', { branch: state.knight.itemBranch?.id });
    return evolve(state, { ...done, questId: 9003, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null, currentStep: step('knight.quiz', QuestStepType.CHOICE, InterruptPolicy.SAFE), interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.QUIZ, title: '騎士知識測驗', status: 'ACTIVE', questions: publicQuestions(KNIGHT_QUIZ) }, knight: { ...state.knight, phase: KnightPhase.QUIZ, sourceState: source, results: { ...state.knight.results, items: true } } });
  }
  if (phase === KnightPhase.QUIZ_SYNC && source.q === 6 && questState(authority, 9004) >= 0) {
    const done = checkpoint(state, 'knight.quiz', { answers: state.knight.quiz.answers });
    return evolve(state, { ...done, questId: 9004, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.TRIAL, title: 'Windsor 三波戰鬥試煉', status: 'READY', waves: KNIGHT_WAVES, actionLabel: '檢查配置與補給後開始' }, knight: { ...state.knight, phase: KnightPhase.WAVE_READY, sourceState: source, results: { ...state.knight.results, quiz: true } } });
  }
  if (phase === KnightPhase.WAVE_STARTING && source.q === 7 && source.wave >= 1)
    return evolve(state, { questStatus: QuestStatus.TRIAL_ACTIVE, currentStep: step('knight.wave_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED), interruptPolicy: InterruptPolicy.LOCKED,
      missionStage: { type: MissionStageType.TRIAL, title: 'Windsor 三波戰鬥試煉', status: 'ACTIVE', rule: 'WAVE_BATTLE', wave: source.wave, kills: source.waveKills, total: KNIGHT_WAVES[source.wave - 1]?.total ?? 0, timeoutSeconds: 180 },
      knight: { ...state.knight, phase: KnightPhase.WAVE_ACTIVE, sourceState: source, wave: { current: source.wave, kills: source.waveKills, startedAt: state.knight.wave.startedAt } } });
  if (phase === KnightPhase.WAVE_ACTIVE && source.q === 8 && source.waveResult === 1 && questState(authority, 9007) >= 0) {
    const done = checkpoint(state, 'knight.wave_trial', { waves: 3, officialMonsters: 19, ruleset: 'Renewal' });
    return evolve(state, { ...done, questId: 9007, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null, activeTrial: null, trialInventoryLock: false,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null, currentStep: step('knight.ethics', QuestStepType.CHOICE, InterruptPolicy.SAFE), interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.CHOICE, title: 'Lady Amy 騎士倫理測驗', status: 'ACTIVE', questions: publicQuestions(KNIGHT_ETHICS), acceptedScores: [90, 100] }, knight: { ...state.knight, phase: KnightPhase.ETHICS, sourceState: source, results: { ...state.knight.results, waves: true } } });
  }
  if (phase === KnightPhase.ETHICS_SYNC && source.q === 10 && source.ethicsPassed === 1 && questState(authority, 9009) >= 0) {
    const done = checkpoint(state, 'knight.ethics', { score: state.knight.ethics.score });
    return evolve(state, { ...done, questId: 9009, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.TRIAL, title: 'Sir Edmond 禁殺試煉', status: 'READY', rule: 'NO_KILL', durationSeconds: 300, actionLabel: '檢查補給後開始' }, knight: { ...state.knight, phase: KnightPhase.NO_KILL_READY, sourceState: source, results: { ...state.knight.results, ethics: true } } });
  }
  if (phase === KnightPhase.NO_KILL_STARTING && questState(authority, 9010) >= 0 && (source.q === 11 || authority?.map === 'job_knt'))
    return evolve(state, { questStatus: QuestStatus.TRIAL_ACTIVE, currentStep: step('knight.no_kill_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED), interruptPolicy: InterruptPolicy.LOCKED,
      missionStage: { type: MissionStageType.TRIAL, title: 'Sir Edmond 禁殺試煉', status: 'ACTIVE', rule: 'NO_KILL', durationSeconds: 300, startedAtUnix: source.noKillStartedAt || null, hp: authority?.hp, maxHp: authority?.maxHp, supply: Number(authority?.items?.[501] ?? 0) },
      knight: { ...state.knight, phase: KnightPhase.NO_KILL_ACTIVE, sourceState: source, noKill: { startedAt: source.noKillStartedAt > 0 ? new Date(source.noKillStartedAt * 1000).toISOString() : state.knight.noKill.startedAt, durationSeconds: 300 } } });
  if (phase === KnightPhase.NO_KILL_ACTIVE && questState(authority, 9011) >= 0 && (source.q === 12 || authority?.map === 'prt_in')) {
    const done = checkpoint(state, 'knight.no_kill_trial', { durationSeconds: 300, killed: 0 });
    return evolve(state, { ...done, questId: 9011, questStatus: QuestStatus.RUNNING, currentObjective: null, agentLease: null, activeTrial: null, trialInventoryLock: false,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null, currentStep: step('knight.final_dialog', QuestStepType.CHOICE, InterruptPolicy.SAFE), interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.CHOICE, title: 'Sir Gray 最終面談', status: 'ACTIVE', dialog: KNIGHT_FINAL_DIALOG }, knight: { ...state.knight, phase: KnightPhase.FINAL_DIALOG, sourceState: source, results: { ...state.knight.results, noKill: true } } });
  }
  if (phase === KnightPhase.FINAL_DIALOG_SYNC && source.q === 14 && source.finalPassed === 1 && questState(authority, 9012) >= 0) {
    const done = checkpoint(state, 'knight.final_dialog', { score: state.knight.finalDialog.score });
    return evolve(state, { ...done, questId: 9012, questStatus: QuestStatus.READY, currentObjective: null, agentLease: null, currentStep: step('knight.final_commit', QuestStepType.COMMIT, InterruptPolicy.LOCKED), interruptPolicy: InterruptPolicy.LOCKED,
      missionStage: { type: MissionStageType.RESULT, title: '騎士轉職考驗完成', status: 'READY_TO_COMMIT', finalNpc: 'Captain Herman', reward: [{ itemId: 656, amount: 7, name: 'Awakening Potion' }] }, knight: { ...state.knight, phase: KnightPhase.FINAL_READY, sourceState: source, results: { ...state.knight.results, finalDialog: true } } });
  }
  if (phase !== KnightPhase.COMPLETED && Number(authority?.currentJob) === KNIGHT_JOB_ID && questState(authority, 9012) === 2) {
    const done = checkpoint(state, 'knight.final_commit', { classId: KNIGHT_JOB_ID, rewardItemId: 656, rewardAmount: 7 });
    return evolve(state, { ...done, careerTarget: null, formalQuestStarted: false, questId: 9012, questStatus: QuestStatus.COMPLETED, currentStep: null, currentObjective: null, objectiveId: null, agentLease: null,
      activeTrial: null, trialInventoryLock: false, supplyPending: false, originalObjective: null, temporaryObjective: null, interruptPolicy: InterruptPolicy.SAFE, combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] }, previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '正式轉職完成', status: 'COMPLETED', job: '騎士' }, knight: { ...state.knight, phase: KnightPhase.COMPLETED, sourceState: source, results: { ...state.knight.results, jobChange: true } } });
  }
  if (phase === KnightPhase.WAVE_ACTIVE && (source.waveResult < 0 || source.q === 7 && source.wave === 0)) return reconcileKnightState({ ...state, questStatus: QuestStatus.TRIAL_FAILED }, authority);
  if (phase === KnightPhase.NO_KILL_ACTIVE && source.noKillResult < 0) return reconcileKnightState({ ...state, questStatus: QuestStatus.TRIAL_FAILED }, authority);
  if (phase === KnightPhase.WAVE_ACTIVE && (source.wave !== state.knight.wave.current || source.waveKills !== state.knight.wave.kills))
    return evolve(state, { missionStage: { ...state.missionStage, wave: source.wave, kills: source.waveKills, total: KNIGHT_WAVES[source.wave - 1]?.total ?? 0 }, knight: { ...state.knight, sourceState: source, wave: { ...state.knight.wave, current: source.wave, kills: source.waveKills } } });
  return state;
}

function trialPreflight(authority) {
  return questPreflightCheck({ character: { hp: Number(authority?.hp ?? 0), maxHp: Number(authority?.maxHp ?? 1), sp: Number(authority?.sp ?? 0), maxSp: Number(authority?.maxSp ?? 0) },
    recoveryItems: [{ itemId: 501, amount: Number(authority?.items?.[501] ?? 0), hpRecovery: 1, spRecovery: 0 }], riskLevel: RiskLevel.TRIAL,
    requirement: { minimumEntryHp: 1, reservedHpRecovery: 50 } });
}
function prepareKnightAction({ state, action, payload, authority }) {
  if (!['START_WAVES', 'START_NO_KILL'].includes(action)) return applyKnightAction(state, action, payload, authority);
  const preflight = trialPreflight(authority);
  if (['PASS', 'WARNING'].includes(preflight.status)) return applyKnightAction(state, action, payload, authority, { preflight });
  const pending = applyKnightAction(state, action, payload, authority, { preflight: { ...preflight, status: 'PASS' } });
  return requestSupply({ ...pending, activeTrial: null, trialInventoryLock: false, interruptPolicy: InterruptPolicy.SAFE }, { reservation: preflight.reservation,
    temporaryObjective: { type: 'SUPPLY', reason: action === 'START_WAVES' ? 'KNIGHT_WAVE_RESERVE' : 'KNIGHT_NO_KILL_RESERVE', requirements: { items: [{ itemId: 501, minimumAmount: 10 }] } } });
}

const requiredItems = new Map([[501, 10], [656, 0]]);
for (const branch of Object.values(KNIGHT_ITEM_BRANCHES)) for (const entry of branch.items) requiredItems.set(entry.itemId, entry.amount);

export const KNIGHT_JOB_ADAPTER = defineJobQuestAdapter({
  id: 'KNIGHT', displayName: '騎士', version: 1, jobId: KNIGHT_JOB_ID,
  eligibility: { sourceJobId: SWORDMAN_JOB_ID, minimumJobLevel: 40, skillPoint: 0, evaluate: knightEligibility },
  questStateMapping: KNIGHT_SOURCE,
  steps: Object.freeze(['navigate_guild', 'accept', 'items', 'quiz', 'wave_trial', 'ethics', 'no_kill_trial', 'final_dialog', 'final_commit']),
  interactionDefinitions: KNIGHT_INTERACTIONS,
  quizDefinitions: Object.freeze([KNIGHT_QUIZ, KNIGHT_ETHICS]),
  trialDefinitions: Object.freeze([
    Object.freeze({ id: 'waves', kind: 'WAVE_BATTLE', waves: KNIGHT_WAVES, combatPolicy: CombatPolicy.NORMAL, sourceLines: '1058-1441' }),
    Object.freeze({ id: 'no_kill', durationSeconds: 300, combatPolicy: CombatPolicy.NO_ATTACK, movementPolicy: 'AVOID_HOSTILES', sourceLines: '1791-2000' }),
  ]), routeEvents: {}, requiredItems: Object.freeze([...requiredItems].map(([itemId, minimumAmount]) => Object.freeze({ itemId, minimumAmount, purpose: itemId === 501 ? 'TRIAL_PREFLIGHT' : itemId === 656 ? 'REWARD_AUDIT' : 'ITEM_GATE' }))),
  checkpointRules: Object.freeze({ itemFailure: 'REMAIN_ITEM_OBJECTIVE', quizFailure: 'RETRY_QUIZ', waveFailure: 'WAVE_READY', ethicsFailure: 'RETRY_ETHICS', noKillFailure: 'NO_KILL_READY', finalDialogFailure: 'RETRY_FINAL_DIALOG', death: 'CURRENT_TRIAL_READY' }),
  initializeState: initializeKnightState, selectCareerTarget: selectKnightCareer, applyAction: applyKnightAction, prepareAction: prepareKnightAction, reconcileState: reconcileKnightState,
  publicState: (state) => structuredClone(state.knight ?? null),
  publicStatus: (state) => { const phase = state.knight?.phase ?? KnightPhase.IDLE; return { phase, active: ![KnightPhase.IDLE, KnightPhase.COMPLETED].includes(phase), formalQuestStarted: state.knight?.formalQuestStarted === true }; },
  finalCommit: { commitType: CommitType.JOB_CHANGE, payload: Object.freeze({ adapterId: 'KNIGHT', targetJobId: KNIGHT_JOB_ID }), completionQuestId: 9012,
    command: knightServerCommand('commit'), validate: ({ authority, payload }) => { if (payload?.adapterId !== 'KNIGHT' || Number(payload?.targetJobId) !== KNIGHT_JOB_ID) throw new Error('JOB_ADAPTER_COMMIT_PAYLOAD_INVALID'); const eligibility = knightEligibility(authority); if (!eligibility.eligible) throw new Error(eligibility.failures[0]); if (Number(authority?.variables?.KNIGHT_Q ?? 0) !== 14 || Number(authority?.variables?.terminal_knight_final_passed ?? 0) !== 1 || questState(authority, 9012) < 0) throw new Error('KNIGHT_FINAL_STATE_INVALID'); },
    isComplete: (authority) => Number(authority?.currentJob) === KNIGHT_JOB_ID && questState(authority, 9012) === 2,
    result: (authority) => ({ verified: true, source: 'rAthena/MariaDB', currentJob: Number(authority.currentJob), jobLevel: Number(authority.jobLevel), questId: 9012, questState: questState(authority, 9012), reward: { itemId: 656, amount: Number(authority?.items?.[656] ?? 0) } }), },
});

const unavailable = () => ({ eligible: false, failures: ['CAREER_NOT_RELEASED'] });
export const CRUSADER_CAREER_PLACEHOLDER = defineJobQuestAdapter({
  id: 'CRUSADER', displayName: '十字軍', available: false, unavailableReason: '尚未開放', version: 0, jobId: 14,
  eligibility: { sourceJobId: SWORDMAN_JOB_ID, minimumJobLevel: 40, skillPoint: 0, evaluate: unavailable },
  questStateMapping: { questIds: [9100], variables: [] }, steps: ['unavailable'], quizDefinitions: [], trialDefinitions: [], routeEvents: {}, requiredItems: [], checkpointRules: { unavailable: true },
  initializeState: (state) => state, selectCareerTarget: () => { throw new Error('CAREER_NOT_RELEASED'); }, applyAction: () => { throw new Error('CAREER_NOT_RELEASED'); }, reconcileState: (state) => state,
  publicState: () => null, publicStatus: () => ({ phase: 'UNAVAILABLE', active: false, formalQuestStarted: false }),
  finalCommit: { commitType: CommitType.JOB_CHANGE, payload: { adapterId: 'CRUSADER', targetJobId: 14 }, completionQuestId: 9100, command: { name: 'terminal_crusader_sync', arguments: ['commit'] }, validate: () => { throw new Error('CAREER_NOT_RELEASED'); }, isComplete: () => false, result: () => null },
});
