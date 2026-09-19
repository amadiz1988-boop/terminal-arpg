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

export const ASSASSIN_CAREER_JOURNEY_ID = 28001;
export const ASSASSIN_JOB_ID = 12;
export const THIEF_JOB_ID = 6;
export const FROZEN_HEART_ITEM_ID = 1008;

export const AssassinPhase = Object.freeze({
  IDLE: 'IDLE',
  NAVIGATING: 'NAVIGATING',
  AT_GUILD: 'AT_GUILD',
  ACCEPTING: 'ACCEPTING',
  QUIZ: 'QUIZ',
  QUIZ_SYNC: 'QUIZ_SYNC',
  PRECISION_READY: 'PRECISION_READY',
  PRECISION_ACTIVE: 'PRECISION_ACTIVE',
  NO_KILL_READY: 'NO_KILL_READY',
  NO_KILL_ACTIVE: 'NO_KILL_ACTIVE',
  MAZE: 'MAZE',
  MAZE_SYNC: 'MAZE_SYNC',
  GUILDMASTER: 'GUILDMASTER',
  GUILDMASTER_SYNC: 'GUILDMASTER_SYNC',
  FINAL_READY: 'FINAL_READY',
  COMPLETED: 'COMPLETED',
});

// NO_KILL_ROUTE sub-phase. The Assassin no-kill trial is a single native
// objective that the Quest Runtime must orchestrate as three ordered phases so
// the Persistent Agent never needs quest-specific sequencing hooks:
//   START_PENDING -> dispatch run_server_command(no_kill_start)
//   NAVIGATING    -> dispatch start_navigation(route)
//   RECONCILING   -> no mutation; wait for native ASSIN_Q>=5 + quest 8005
// The phase is persisted in `state.assassin.noKillPhase` (web_quest_runtime
// state_json) so a restart resumes at the correct phase.
export const AssassinNoKillPhase = Object.freeze({
  START_PENDING: 'START_PENDING',
  NAVIGATING: 'NAVIGATING',
  RECONCILING: 'RECONCILING',
});

export const ASSASSIN_INTERACTIONS = defineMissionInteractionDefinitions({
  AT_GUILD: {
    interactionKey: 'assassin.entry',
    npcId: 'Guildsman#asn',
    npcKey: 'assassin.huey',
    npcName: "Assassin Expert 'Huey'",
    npcVisualKey: 'assassin.huey',
    dialogLines: [
      { id: 'assassin.entry.experienced-thief', text: '嗯，一名經驗豐富的盜賊。看來你已準備好踏出下一步。', sourceRef: 'npc/jobs/2-1/assassin.txt:239-247' },
      { id: 'assassin.entry.requirements', text: '申請者必須是 Job Lv.40 以上的盜賊，並完成刺客公會的考驗。', sourceRef: 'npc/jobs/2-1/assassin.txt:264-269' },
      { id: 'assassin.entry.confirm', text: '確認接受後，我會送你進入刺客公會辦公室。', sourceRef: 'npc/jobs/2-1/assassin.txt:249-261' },
    ],
    autoAdvanceAllowed: false,
    requiresPlayerInput: true,
    availableActions: [{ id: 'ACCEPT_QUEST', label: '接受刺客轉職考試', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/assassin.txt:232-269',
  },
  ACCEPTING: {
    interactionKey: 'assassin.entry.accepted',
    npcId: 'Guildsman#asn',
    npcKey: 'assassin.huey',
    npcName: "Assassin Expert 'Huey'",
    npcVisualKey: 'assassin.huey',
    dialogLines: [
      { id: 'assassin.entry.accepted-1', text: '很久沒有新的訪客了。你的申請已交由刺客公會受理。', sourceRef: 'npc/jobs/2-1/assassin.txt:251-254' },
      { id: 'assassin.entry.accepted-2', text: '接下來前往辦公室，正式考驗會從那裡開始。', sourceRef: 'npc/jobs/2-1/assassin.txt:251-261' },
    ],
    autoAdvanceAllowed: true,
    requiresPlayerInput: false,
    availableActions: [],
    sourceRef: 'npc/jobs/2-1/assassin.txt:251-261',
  },
  QUIZ: {
    interactionKey: 'assassin.quiz',
    npcId: 'Guildsman#asn',
    npcKey: 'assassin.anonymous-one',
    npcName: 'The Anonymous One',
    npcVisualKey: 'assassin.anonymous-one',
    dialogLines: [],
    autoAdvanceAllowed: false,
    requiresPlayerInput: true,
    availableActions: [{ id: 'SUBMIT_QUIZ', label: '提交答案', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/assassin.txt:668-968',
  },
  QUIZ_SYNC: {
    interactionKey: 'assassin.quiz.result',
    npcId: 'Guildsman#asn',
    npcKey: 'assassin.anonymous-one',
    npcName: 'The Anonymous One',
    npcVisualKey: 'assassin.anonymous-one',
    dialogLines: [],
    autoAdvanceAllowed: false,
    requiresPlayerInput: false,
    availableActions: [],
    sourceRef: 'npc/jobs/2-1/assassin.txt:668-968',
  },
  GUILDMASTER: {
    interactionKey: 'assassin.guildmaster',
    npcId: 'Guildmaster#ASN2',
    npcKey: 'assassin.guildmaster',
    npcName: 'Guildmaster',
    npcVisualKey: 'assassin.guildmaster',
    dialogLines: [
      { id: 'assassin.guildmaster.welcome', text: '歡迎來到公會最深處。你已經通過迷宮。', sourceRef: 'npc/jobs/2-1/assassin.txt:1648-1655' },
      { id: 'assassin.guildmaster.warning', text: '接下來我會詢問你的信念。請誠實回答。', sourceRef: 'npc/jobs/2-1/assassin.txt:1657-1663' },
    ],
    autoAdvanceAllowed: false,
    requiresPlayerInput: true,
    availableActions: [{ id: 'ANSWER_GUILDMASTER', label: '回答公會長', kind: 'SERVER_ACTION' }],
    sourceRef: 'npc/jobs/2-1/assassin.txt:1639-1663',
  },
  GUILDMASTER_SYNC: {
    interactionKey: 'assassin.guildmaster.result',
    npcId: 'Guildmaster#ASN2',
    npcKey: 'assassin.guildmaster',
    npcName: 'Guildmaster',
    npcVisualKey: 'assassin.guildmaster',
    dialogLines: [],
    autoAdvanceAllowed: false,
    requiresPlayerInput: false,
    availableActions: [],
    sourceRef: 'npc/jobs/2-1/assassin.txt:1639-1818',
  },
  FINAL_READY: {
    interactionKey: 'assassin.final',
    npcId: 'Guildsman#asn',
    npcKey: 'assassin.huey',
    npcName: "Assassin Expert 'Huey'",
    npcVisualKey: 'assassin.huey',
    dialogLines: [
      { id: 'assassin.final.approved', text: '所有考驗已確認完成。最後的轉職仍需由你親自確認。', sourceRef: 'npc/jobs/2-1/assassin.txt:112-136' },
    ],
    autoAdvanceAllowed: false,
    requiresPlayerInput: true,
    availableActions: [{ id: 'FINAL_COMMIT', label: '完成轉職', kind: 'SERVER_COMMIT' }],
    sourceRef: 'npc/jobs/2-1/assassin.txt:112-136',
  },
});

export const ASSASSIN_SOURCE = Object.freeze({
  file: 'npc/jobs/2-1/assassin.txt',
  eligibility: { baseJob: THIEF_JOB_ID, minimumJobLevel: 40, skillPoint: 0 },
  questIds: [8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008],
  variables: [
    'ASSIN_Q',
    'ASSIN_Q2',
    'ASSIN_Q3',
    'terminal_assassin_arrived',
    'terminal_assassin_precision',
    'terminal_assassin_guild_rewarded',
  ],
  guildMap: 'in_moc_16',
  guildNpc: { name: 'Guildsman#asn', x: 19, y: 33 },
  precisionTargetName: 'Job change target',
  precisionTargetCount: 6,
  frozenHeartItemId: FROZEN_HEART_ITEM_ID,
  finalJob: ASSASSIN_JOB_ID,
});

export function assassinServerCommand(action) {
  const [name, value] = String(action).split(':', 2);
  const argumentsList = value == null ? [name] : [name, value];
  return { name: 'terminal_assassin_sync', arguments: argumentsList };
}

const q = (id, prompt, choices, answers) =>
  Object.freeze({ id, prompt, choices: Object.freeze(choices), answers: Object.freeze(answers) });

const publicQuizQuestions = (set) =>
  set.map(({ id, prompt, choices }) => ({ id, prompt, choices: [...choices] }));

export const ASSASSIN_QUIZ_SETS = Object.freeze([
  Object.freeze([
    q('a1', '哪一項技能不是學習無影之牙的前置條件？', ['偽裝 Lv.2', '音速投擲 Lv.5', '拳刃修練 Lv.4', '右手修練 Lv.2'], [3]),
    q('a2', '施毒具有哪一種屬性？', ['毒', '地', '火', '風'], [0]),
    q('a3', '右手修練 Lv.4 的效果為何？', ['恢復 80% 減少傷害', '恢復 90% 減少傷害', '增加 90% 傷害', '增加 108% 傷害'], [1]),
    q('a4', '使用毒性散發需要哪一項物品？', ['火靈礦石', '藍色魔力礦石', '黃色魔力礦石', '紅色魔力礦石'], [3]),
    q('a5', '施毒 Lv.5 後可以學習哪一項技能？', ['施毒', '音速投擲', '病毒散播', '毒性散發'], [3]),
    q('a6', '哪一項技能可在隱形狀態下移動？', ['隱匿', '後退迴避', '偽裝', '噴砂'], [2]),
    q('a7', '哪一項條件與病毒散播無關？', ['目標中毒', '紅色魔力礦石', '目標剩餘 HP'], [1]),
    q('a8', '插有海葵卡片的武器最適合攻擊哪隻怪物？', ['鋼鐵蒼蠅', '小巴風特', '長老樹精', '巴風特'], [2]),
    q('a9', '二刀連擊需要多少 SP？', ['15', '被動技能，消耗 0 SP', '被動技能，消耗 10 SP', '54'], [1]),
    q('a10', '在伊斯魯得海底洞窟狩獵最適合哪種屬性笨拙短劍？', ['風', '水', '地', '火'], [0]),
  ]),
  Object.freeze([
    q('b1', '哪隻怪物會掉落有洞拳刃？', ['盜蟲', '大嘴鳥', '沙漠之狼', '榔頭哥布靈'], [2]),
    q('b2', '哪隻怪物會掉落有洞巨毒短劍？', ['馬丁', '沙漠之狼', '傀儡娃娃', '迷幻之王'], [0]),
    q('b3', '哪個職業可以製作屬性武器？', ['商人', '鐵匠', '盜賊', '祭司'], [1]),
    q('b4', '哪把武器不屬於拳刃類？', ['秘刃闇嘯', '巨毒短劍', '拳刃', '大駒短劍'], [3]),
    q('b5', '伊斯魯得海底洞窟的怪物主要是哪種屬性？', ['水', '火', '風', '地'], [0]),
    q('b6', '哪隻怪物無法成為寵物？', ['波波利', '羅達蛙', '狸貓', '毒魔菇'], [1]),
    q('b7', '火屬性短劍最適合攻擊哪種哥布靈？', ['短劍', '錘矛', '晨星', '榔頭'], [3]),
    q('b8', '哪一把拳刃沒有屬性？', ['火靈拳刃', '刺藤拳刃', '尖銳的枯樹枝', '刺殺拳刃'], [3]),
    q('b9', '哪隻屬於罕見怪物？', ['波利', '波利之王', '幽靈波利', '蘑菇'], [2]),
    q('b10', '哪隻怪物不屬於不死系？', ['德古拉伯爵', '邪骸海盜', '蘑菇', '卡利斯格'], [2]),
  ]),
  Object.freeze([
    q('c1', '殘影 Lv.10 最大增加多少迴避率？', ['30', '40', '160', '20'], [0]),
    q('c2', '哪隻怪物能偵測隱匿或偽裝？', ['森靈', '螞蟻', '木乃伊', '邪骸戰士'], [1]),
    q('c3', '哪組武器無法同時使用？', ['笨拙短劍加大駒短劍', '雙刃短劍加笨拙短劍', '拳刃加笨拙短劍', '鐵鎚加雙刃短劍'], [2]),
    q('c4', '盜賊在哪個城市轉職？', ['普隆德拉', '薑餅城', '艾爾貝塔', '夢羅克'], [3]),
    q('c5', '哪張卡片不影響 AGI？', ['小巴風特卡片', '白幽靈卡片', '雌盜蟲卡片', '雄盜蟲卡片'], [1]),
    q('c6', '刺客最具代表性的專長為何？', ['歌唱', '閱讀', '舞蹈', '迴避'], [3]),
    q('c7', '刺客 Job Lv.50 最多取得多少 AGI 職業加成？', ['7', '8', '9', '10'], [3]),
    q('c8', '刺客無法裝備哪一項？', ['短劍', '頭盔', '長靴', '髮夾'], [1]),
    q('c9', '盜賊轉職採集任務可接受哪種蘑菇？', ['橙色黏稠蘑菇', '紅色黏稠蘑菇', '橙色網狀蘑菇', '橙色毛髮蘑菇'], [0, 2]),
    q('c10', '哪張卡片通常對刺客幫助最小？', ['白幽靈卡片', '長老樹精卡片', '邪骸士兵卡片', '犬妖卡片'], [1]),
  ]),
]);

export const ASSASSIN_MAZE = Object.freeze({
  entrance: Object.freeze({
    id: 'entrance',
    clue: '牆上的腳印在左側陰影中延續，右側有新近折返痕跡。',
    choices: Object.freeze([
      { id: 'shadow_path', label: '沿左側陰影前進', next: 'crossing' },
      { id: 'bright_hall', label: '走向右側明亮通道', next: 'entrance', deadEnd: true, cost: { hp: 5 } },
    ]),
  }),
  crossing: Object.freeze({
    id: 'crossing',
    clue: '北側傳來守衛腳步聲，南側牆面刻著刺客公會的折刃標記。',
    choices: Object.freeze([
      { id: 'marked_wall', label: '沿折刃標記轉入南側', next: 'sealed_door' },
      { id: 'guard_steps', label: '朝腳步聲前進', next: 'crossing', backtrack: true, cost: { sp: 4 } },
    ]),
  }),
  sealed_door: Object.freeze({
    id: 'sealed_door',
    clue: '石門有兩個凹槽，暗色凹槽沒有灰塵，日輪凹槽積滿沙粒。',
    choices: Object.freeze([
      { id: 'dark_seal', label: '按下暗色凹槽', next: 'guildmaster' },
      { id: 'sun_seal', label: '按下日輪凹槽', next: 'crossing', deadEnd: true, cost: { hp: 8 } },
    ]),
  }),
  guildmaster: Object.freeze({ id: 'guildmaster', clue: '你已抵達公會長房間。', choices: Object.freeze([]) }),
});

export const ASSASSIN_GUILDMASTER = Object.freeze([
  Object.freeze({ id: 'priority', prompt: '你認為刺客最重要的是什麼？', choices: ['更強大的力量', '刺客的尊嚴', '無止境的修練'] }),
  Object.freeze({ id: 'motive', prompt: '你為何追求這條道路？', choices: ['完成心中的執念', '賺取金錢', '探索世界'] }),
  Object.freeze({ id: 'future', prompt: '成為刺客後，你首先會做什麼？', choices: ['立刻狩獵', '與等待我的人會合', '確認我能如何履行刺客責任'] }),
]);

function evolve(state, patch) {
  return { ...state, ...patch, revision: Number(state.revision) + 1, updatedAt: new Date().toISOString() };
}

function step(id, type, interruptPolicy, missionStage) {
  return { id, type, interruptPolicy, missionStage };
}

function objectiveState(state, currentStep, currentObjective, missionStage, patch = {}) {
  return evolve(state, {
    ...patch,
    currentStep,
    currentObjective,
    objectiveId: currentStep.id,
    objectiveGeneration: Number(state.objectiveGeneration ?? 0) + 1,
    agentLease: null,
    interruptPolicy: currentStep.interruptPolicy,
    missionStage,
  });
}

function checkpoint(state, stepId, data = null) {
  const completedSteps = state.completedSteps.includes(stepId)
    ? [...state.completedSteps]
    : [...state.completedSteps, stepId];
  return {
    completedSteps,
    checkpoint: { stepId, completedSteps, data: structuredClone(data), createdAt: new Date().toISOString() },
  };
}

function authorityQuestState(authority, questId) {
  return Number(authority?.questStates?.[questId] ?? -1);
}

export function assassinEligibility(authority) {
  const failures = [];
  if (Number(authority?.currentJob) !== THIEF_JOB_ID) failures.push('JOB_MUST_BE_THIEF');
  if (Number(authority?.jobLevel) < 40) failures.push('JOB_LEVEL_40_REQUIRED');
  if (Number(authority?.skillPoint) !== 0) failures.push('UNUSED_FIRST_JOB_SKILL_POINTS');
  if (authorityQuestState(authority, 8008) === 2 || Number(authority?.currentJob) === ASSASSIN_JOB_ID)
    failures.push('ASSASSIN_QUEST_ALREADY_COMPLETED');
  return { eligible: failures.length === 0, failures };
}

export function initializeAssassinState(state) {
  if (state.assassin) return state;
  return {
    ...state,
    assassin: {
      phase: AssassinPhase.IDLE,
      formalQuestStarted: false,
      sourceState: null,
      quiz: null,
      precision: null,
      maze: null,
      guildmaster: null,
      noKillPhase: null,
      results: { quiz: false, precision: false, noKill: false, maze: false, guildmaster: false, jobChange: false },
    },
  };
}

export function selectAssassinCareer(state, careerTarget) {
  state = initializeAssassinState(state);
  const target = String(careerTarget ?? '').toUpperCase();
  if (!['ASSASSIN', 'ROGUE'].includes(target)) throw new Error('CAREER_TARGET_INVALID');
  if ((state.assassin.formalQuestStarted || state.formalQuestStarted) && target !== 'ASSASSIN') throw new Error('ASSASSIN_QUEST_ALREADY_STARTED');
  return evolve(state, {
    careerTarget: target,
    assassin: target === 'ASSASSIN' ? state.assassin : { ...state.assassin, phase: AssassinPhase.IDLE },
  });
}

export function beginAssassinNavigation(state, authority) {
  state = initializeAssassinState(state);
  const eligibility = assassinEligibility(authority);
  if (state.careerTarget !== 'ASSASSIN') throw new Error('ASSASSIN_CAREER_TARGET_REQUIRED');
  if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
  const missionStage = {
    type: MissionStageType.NAVIGATION,
    title: '前往刺客公會',
    currentMap: authority.map ?? null,
    nextMap: ASSASSIN_SOURCE.guildMap,
    objective: '尋找刺客公會入口並前往 Huey',
    routeProgress: 0,
    formalQuestStarted: false,
  };
  const currentStep = step('assassin.navigate_guild', QuestStepType.OBJECTIVE, InterruptPolicy.DEFERRED, missionStage);
  return objectiveState(state, currentStep, {
    type: 'SERVER_COMMAND',
    action: 'navigate_guild',
    serverCommand: assassinServerCommand('navigate_guild'),
    after: 'COMBAT_HOLD',
  }, missionStage, {
    questId: ASSASSIN_CAREER_JOURNEY_ID,
    questSessionId: state.questSessionId ?? randomUUID(),
    questStatus: QuestStatus.RUNNING,
    completedSteps: [],
    checkpoint: null,
    assassin: { ...state.assassin, phase: AssassinPhase.NAVIGATING, formalQuestStarted: false },
  });
}

function serverCommand(state, phase, action, title, after = null, patch = {}) {
  const missionStage = { type: MissionStageType.DIALOG, title, status: 'SERVER_PENDING', action };
  const currentStep = step(`assassin.server.${action}`, QuestStepType.OBJECTIVE, InterruptPolicy.LOCKED, missionStage);
  const assassin = patch.assassin ?? state.assassin;
  return objectiveState(state, currentStep, {
    type: 'SERVER_COMMAND',
    action,
    serverCommand: assassinServerCommand(action),
    after,
  }, missionStage, {
    ...patch,
    questStatus: QuestStatus.RUNNING,
    assassin: { ...assassin, phase },
  });
}

export function applyAssassinAction(state, action, payload, authority, { preflight = null } = {}) {
  state = initializeAssassinState(state);
  const phase = state.assassin.phase;
  if (action === 'NAVIGATE_GUILD') return beginAssassinNavigation(state, authority);
  if (action === 'ACCEPT_QUEST') {
    if (phase !== AssassinPhase.AT_GUILD) throw new Error('ASSASSIN_GUILD_NOT_REACHED');
    const eligibility = assassinEligibility(authority);
    if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
    if (
      authority.map !== ASSASSIN_SOURCE.guildMap &&
      Number(authority?.variables?.terminal_assassin_arrived) !== 1
    ) throw new Error('ASSASSIN_GUILD_NOT_REACHED');
    return serverCommand(state, AssassinPhase.ACCEPTING, 'accept', '接受刺客轉職考試');
  }
  if (action === 'SUBMIT_QUIZ') {
    if (phase !== AssassinPhase.QUIZ) throw new Error('QUIZ_NOT_ACTIVE');
    const answers = Array.isArray(payload?.answers) ? payload.answers.map(Number) : [];
    const set = ASSASSIN_QUIZ_SETS[state.assassin.quiz.setId];
    if (answers.length !== set.length || answers.some((answer) => !Number.isInteger(answer))) throw new Error('QUIZ_ANSWERS_INVALID');
    const score = set.reduce((sum, question, index) => sum + (question.answers.includes(answers[index]) ? 1 : 0), 0);
    const quiz = { ...state.assassin.quiz, answers, score, passed: score >= 9, attempts: Number(state.assassin.quiz.attempts) + 1 };
    if (score < 9) {
      return evolve(state, {
        questStatus: QuestStatus.RUNNING,
        missionStage: { type: MissionStageType.QUIZ, title: '刺客知識測驗', status: 'FAILED', score, required: 9, questions: publicQuizQuestions(set) },
        assassin: { ...state.assassin, phase: AssassinPhase.QUIZ, quiz },
      });
    }
    return serverCommand(state, AssassinPhase.QUIZ_SYNC, 'quiz_pass', '知識測驗通過，正在寫入正式任務狀態', null, {
      assassin: { ...state.assassin, phase: AssassinPhase.QUIZ_SYNC, quiz, results: { ...state.assassin.results, quiz: true } },
    });
  }
  if (action === 'START_PRECISION') {
    if (phase !== AssassinPhase.PRECISION_READY) throw new Error('PRECISION_NOT_READY');
    if (payload?.targetName !== ASSASSIN_SOURCE.precisionTargetName) throw new Error('PRECISION_TARGET_INVALID');
    const missionStage = {
      type: MissionStageType.TRIAL,
      title: '精準目標試煉',
      status: 'ACTIVE',
      targetName: ASSASSIN_SOURCE.precisionTargetName,
      targetCount: ASSASSIN_SOURCE.precisionTargetCount,
      wrongTargetFails: true,
    };
    const currentStep = step('assassin.precision_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED, missionStage);
    return objectiveState(state, currentStep, {
      type: 'SERVER_COMMAND',
      action: 'precision_start',
      serverCommand: assassinServerCommand('precision_start'),
      after: 'COMBAT_HOLD',
      completionMode: ObjectiveCompletionMode.SERVER_AUTHORITY,
    }, missionStage, {
      questStatus: QuestStatus.TRIAL_ACTIVE,
      activeTrial: { id: 'assassin.precision', startedAt: new Date().toISOString() },
      trialInventoryLock: true,
      previousCombatPolicy: structuredClone(state.combatPolicy),
      combatPolicy: { mode: CombatPolicy.TARGET_WHITELIST, targets: [], names: [ASSASSIN_SOURCE.precisionTargetName] },
      assassin: { ...state.assassin, phase: AssassinPhase.PRECISION_ACTIVE, precision: { targetName: payload.targetName, startedAt: new Date().toISOString() } },
    });
  }
  if (action === 'START_NO_KILL') {
    if (phase !== AssassinPhase.NO_KILL_READY) throw new Error('NO_KILL_NOT_READY');
    if (!['PASS', 'WARNING'].includes(preflight?.status)) throw new Error('NO_KILL_PREFLIGHT_BLOCKED');
    const missionStage = { type: MissionStageType.TRIAL, title: '潛行生存試煉', status: 'ACTIVE', rule: 'NO_KILL', destination: 'Barcardi' };
    const currentStep = step('assassin.no_kill_trial', QuestStepType.TRIAL, InterruptPolicy.LOCKED, missionStage);
    return objectiveState(state, currentStep, {
      type: 'NO_KILL_ROUTE',
      action: 'no_kill_start',
      serverCommand: assassinServerCommand('no_kill_start'),
      completionMode: ObjectiveCompletionMode.SERVER_AUTHORITY,
      map: 'in_moc_16',
      x: 87,
      y: 48,
      range: 3,
      completionQuestId: 8005,
      noKillPhase: AssassinNoKillPhase.START_PENDING,
    }, missionStage, {
      questStatus: QuestStatus.TRIAL_ACTIVE,
      activeTrial: { id: 'assassin.no_kill', startedAt: new Date().toISOString() },
      trialInventoryLock: true,
      previousCombatPolicy: structuredClone(state.combatPolicy),
      combatPolicy: { mode: CombatPolicy.NO_ATTACK, targets: [] },
      assassin: { ...state.assassin, phase: AssassinPhase.NO_KILL_ACTIVE, noKillPhase: AssassinNoKillPhase.START_PENDING },
    });
  }
  if (action === 'MAZE_CHOICE') {
    if (phase !== AssassinPhase.MAZE) throw new Error('MAZE_NOT_ACTIVE');
    const node = ASSASSIN_MAZE[state.assassin.maze.nodeId];
    const choice = node?.choices.find((candidate) => candidate.id === payload?.choiceId);
    if (!choice) throw new Error('MAZE_CHOICE_INVALID');
    const history = [...state.assassin.maze.history, { nodeId: node.id, choiceId: choice.id, result: choice.deadEnd ? 'DEAD_END' : choice.backtrack ? 'BACKTRACK' : 'ADVANCE' }];
    const maze = { nodeId: choice.next, history, cost: { hp: Number(state.assassin.maze.cost.hp) + Number(choice.cost?.hp ?? 0), sp: Number(state.assassin.maze.cost.sp) + Number(choice.cost?.sp ?? 0) } };
    if (choice.next === 'guildmaster') {
      return serverCommand(state, AssassinPhase.MAZE_SYNC, 'maze_pass', '迷宮出口已確認，正在進入公會長房間', null, {
        assassin: { ...state.assassin, phase: AssassinPhase.MAZE_SYNC, maze, results: { ...state.assassin.results, maze: true } },
      });
    }
    const next = ASSASSIN_MAZE[choice.next];
    return evolve(state, {
      routeEvent: { nodeId: next.id, availableChoices: next.choices.map((item) => item.id), selectedRoute: null, result: history.at(-1).result, nextNode: next.id, checkpoint: state.checkpoint, encounterTrigger: null, failed: false, deadEnd: choice.deadEnd === true, backtrack: choice.backtrack === true },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: '刺客公會隱藏迷宮', node: next, result: history.at(-1).result, cost: maze.cost },
      assassin: { ...state.assassin, maze },
    });
  }
  if (action === 'GUILDMASTER_CHOICE') {
    if (phase !== AssassinPhase.GUILDMASTER) throw new Error('GUILDMASTER_NOT_ACTIVE');
    const index = state.assassin.guildmaster.answers.length;
    const question = ASSASSIN_GUILDMASTER[index];
    const choice = Number(payload?.choice);
    if (!question || !Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) throw new Error('GUILDMASTER_CHOICE_INVALID');
    const answers = [...state.assassin.guildmaster.answers, choice];
    if (answers.length < ASSASSIN_GUILDMASTER.length) {
      return evolve(state, {
        missionStage: { type: MissionStageType.CHOICE, title: '公會長面談', question: ASSASSIN_GUILDMASTER[answers.length], progress: answers.length, total: ASSASSIN_GUILDMASTER.length },
        assassin: { ...state.assassin, guildmaster: { answers } },
      });
    }
    const evaluation = 8 + Math.min(8, answers[0] * 3 + answers[1]);
    return serverCommand(state, AssassinPhase.GUILDMASTER_SYNC, `guildmaster_pass:${evaluation}`, '公會長完成評價，正在核發 Frozen Heart', null, {
      assassin: { ...state.assassin, phase: AssassinPhase.GUILDMASTER_SYNC, guildmaster: { answers, evaluation }, results: { ...state.assassin.results, guildmaster: true } },
    });
  }
  throw new Error('ASSASSIN_ACTION_INVALID');
}

export function reconcileAssassinState(state, authority) {
  state = initializeAssassinState(state);
  const phase = state.assassin.phase;
  const assinQ = Number(authority?.variables?.ASSIN_Q ?? 0);
  const assinQ2 = Number(authority?.variables?.ASSIN_Q2 ?? 0);
  const frozenHeart = Number(authority?.items?.[FROZEN_HEART_ITEM_ID] ?? 0);
  const sourceState = { assinQ, assinQ2, assinQ3: Number(authority?.variables?.ASSIN_Q3 ?? 0), quests: authority?.questStates ?? {}, frozenHeart };
  if (
    phase === AssassinPhase.PRECISION_ACTIVE &&
    state.questStatus === QuestStatus.TRIAL_FAILED
  ) {
    return evolve(state, {
      questStatus: QuestStatus.READY,
      currentStep: step('assassin.precision_ready', QuestStepType.TRIAL, InterruptPolicy.SAFE, { type: MissionStageType.TRIAL }),
      currentObjective: null,
      objectiveId: 'assassin.precision_ready',
      agentLease: null,
      activeTrial: null,
      trialInventoryLock: false,
      interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '精準目標試煉中斷', result: 'TRIAL_FAILED', checkpoint: state.checkpoint, actionLabel: '重新挑戰本試煉' },
      assassin: { ...state.assassin, phase: AssassinPhase.PRECISION_READY, sourceState },
    });
  }
  if (
    phase === AssassinPhase.NO_KILL_ACTIVE &&
    state.questStatus === QuestStatus.TRIAL_FAILED
  ) {
    return evolve(state, {
      questStatus: QuestStatus.READY,
      currentStep: step('assassin.no_kill_ready', QuestStepType.TRIAL, InterruptPolicy.SAFE, { type: MissionStageType.TRIAL }),
      currentObjective: null,
      objectiveId: 'assassin.no_kill_ready',
      agentLease: null,
      activeTrial: null,
      trialInventoryLock: false,
      interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      missionStage: { type: MissionStageType.RESULT, title: '潛行生存試煉中斷', result: 'TRIAL_FAILED', checkpoint: state.checkpoint, actionLabel: '重新挑戰本試煉' },
      assassin: { ...state.assassin, phase: AssassinPhase.NO_KILL_READY, sourceState },
    });
  }
  if (
    phase === AssassinPhase.MAZE &&
    state.questStatus === QuestStatus.READY &&
    state.missionStage?.result === 'READY_TO_RESUME'
  ) {
    const node = ASSASSIN_MAZE[state.assassin.maze.nodeId];
    return evolve(state, {
      currentStep: step('assassin.maze', QuestStepType.ROUTE_EVENT, InterruptPolicy.DEFERRED, { type: MissionStageType.ROUTE_EVENT }),
      objectiveId: 'assassin.maze',
      interruptPolicy: InterruptPolicy.DEFERRED,
      routeEvent: { nodeId: node.id, availableChoices: node.choices.map((item) => item.id), selectedRoute: null, result: 'RESTORED', nextNode: node.id, checkpoint: state.checkpoint, encounterTrigger: null, failed: false, deadEnd: false, backtrack: false },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: '刺客公會隱藏迷宮', node, result: 'RESTORED', cost: state.assassin.maze.cost },
      assassin: { ...state.assassin, sourceState },
    });
  }
  if (
    phase === AssassinPhase.NAVIGATING &&
    (authority?.map === ASSASSIN_SOURCE.guildMap ||
      Number(authority?.variables?.terminal_assassin_arrived) === 1)
  ) {
    return evolve(state, {
      questStatus: QuestStatus.READY,
      agentLease: null,
      currentObjective: null,
      missionStage: { type: MissionStageType.DIALOG, title: '刺客公會入口', status: 'READY', npc: "Assassin Expert 'Huey'", actionLabel: '接受刺客轉職考試', formalQuestStarted: false },
      assassin: { ...state.assassin, phase: AssassinPhase.AT_GUILD, sourceState },
    });
  }
  if (phase === AssassinPhase.ACCEPTING && authorityQuestState(authority, 8001) >= 0) {
    const setId = Number(state.charId) % ASSASSIN_QUIZ_SETS.length;
    const set = ASSASSIN_QUIZ_SETS[setId];
    return evolve(state, {
      formalQuestStarted: true,
      questId: 8001,
      questStatus: QuestStatus.RUNNING,
      agentLease: null,
      currentStep: step('assassin.quiz', QuestStepType.CHOICE, InterruptPolicy.SAFE, { type: MissionStageType.QUIZ }),
      currentObjective: null,
      objectiveId: 'assassin.quiz',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.QUIZ, title: '刺客知識測驗', status: 'ACTIVE', required: 9, questions: publicQuizQuestions(set) },
      formalQuestStarted: true,
      assassin: { ...state.assassin, phase: AssassinPhase.QUIZ, formalQuestStarted: true, sourceState, quiz: { setId, answers: [], score: null, passed: false, attempts: 0 } },
    });
  }
  if (phase === AssassinPhase.QUIZ_SYNC && assinQ === 1 && assinQ2 === 5 && authorityQuestState(authority, 8003) >= 0) {
    const done = checkpoint(state, 'assassin.quiz', { score: state.assassin.quiz.score });
    return evolve(state, {
      ...done,
      questId: 8003,
      questStatus: QuestStatus.READY,
      agentLease: null,
      currentStep: step('assassin.precision_ready', QuestStepType.TRIAL, InterruptPolicy.SAFE, { type: MissionStageType.TRIAL }),
      currentObjective: null,
      objectiveId: 'assassin.precision_ready',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      missionStage: { type: MissionStageType.TRIAL, title: '精準目標試煉', status: 'READY', targetName: ASSASSIN_SOURCE.precisionTargetName, targetCount: 6, actionLabel: '確認目標並開始' },
      assassin: { ...state.assassin, phase: AssassinPhase.PRECISION_READY, sourceState },
    });
  }
  if (phase === AssassinPhase.PRECISION_ACTIVE && assinQ === 2) {
    return evolve(state, {
      questStatus: QuestStatus.TRIAL_FAILED,
      activeTrial: null,
      trialInventoryLock: false,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      agentLease: null,
      missionStage: { type: MissionStageType.RESULT, title: '精準目標試煉失敗', result: 'TRIAL_FAILED', checkpoint: state.checkpoint, actionLabel: '重新挑戰本試煉' },
      assassin: { ...state.assassin, phase: AssassinPhase.PRECISION_READY, sourceState },
    });
  }
  if (phase === AssassinPhase.PRECISION_ACTIVE && assinQ >= 3 && authorityQuestState(authority, 8004) >= 0) {
    const done = checkpoint(state, 'assassin.precision_trial', { officialState: assinQ });
    return evolve(state, {
      ...done,
      questId: 8004,
      questStatus: QuestStatus.READY,
      activeTrial: null,
      trialInventoryLock: false,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      agentLease: null,
      currentStep: step('assassin.no_kill_ready', QuestStepType.TRIAL, InterruptPolicy.SAFE, { type: MissionStageType.TRIAL }),
      currentObjective: null,
      objectiveId: 'assassin.no_kill_ready',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.TRIAL, title: '潛行生存試煉', status: 'READY', rule: 'NO_KILL', actionLabel: '執行補給檢查並開始' },
      assassin: { ...state.assassin, phase: AssassinPhase.NO_KILL_READY, sourceState, results: { ...state.assassin.results, precision: true } },
    });
  }
  if (
    phase === AssassinPhase.NO_KILL_ACTIVE &&
    state.assassin.noKillPhase === AssassinNoKillPhase.START_PENDING &&
    assinQ >= 4
  ) {
    return evolve(state, {
      currentObjective: { ...state.currentObjective, noKillPhase: AssassinNoKillPhase.NAVIGATING },
      assassin: { ...state.assassin, noKillPhase: AssassinNoKillPhase.NAVIGATING, sourceState },
    });
  }
  if (
    phase === AssassinPhase.NO_KILL_ACTIVE &&
    state.assassin.noKillPhase === AssassinNoKillPhase.NAVIGATING &&
    (authority?.map === state.currentObjective?.map ||
      (assinQ >= 5 && authorityQuestState(authority, 8005) >= 0))
  ) {
    return evolve(state, {
      currentObjective: { ...state.currentObjective, noKillPhase: AssassinNoKillPhase.RECONCILING },
      assassin: { ...state.assassin, noKillPhase: AssassinNoKillPhase.RECONCILING, sourceState },
    });
  }
  if (
    phase === AssassinPhase.NO_KILL_ACTIVE &&
    (!state.assassin.noKillPhase ||
      state.assassin.noKillPhase === AssassinNoKillPhase.RECONCILING) &&
    assinQ >= 5 &&
    authorityQuestState(authority, 8005) >= 0
  ) {
    const done = checkpoint(state, 'assassin.no_kill_trial', { officialState: assinQ });
    const node = ASSASSIN_MAZE.entrance;
    return evolve(state, {
      ...done,
      questId: 8005,
      questStatus: QuestStatus.RUNNING,
      activeTrial: null,
      trialInventoryLock: false,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      agentLease: null,
      currentStep: step('assassin.maze', QuestStepType.ROUTE_EVENT, InterruptPolicy.DEFERRED, { type: MissionStageType.ROUTE_EVENT }),
      currentObjective: null,
      objectiveId: 'assassin.maze',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      interruptPolicy: InterruptPolicy.DEFERRED,
      routeEvent: { nodeId: node.id, availableChoices: node.choices.map((item) => item.id), selectedRoute: null, result: null, nextNode: null, checkpoint: done.checkpoint, encounterTrigger: null, failed: false, deadEnd: false, backtrack: false },
      missionStage: { type: MissionStageType.ROUTE_EVENT, title: '刺客公會隱藏迷宮', node, cost: { hp: 0, sp: 0 } },
      assassin: { ...state.assassin, phase: AssassinPhase.MAZE, sourceState, maze: { nodeId: node.id, history: [], cost: { hp: 0, sp: 0 } }, results: { ...state.assassin.results, noKill: true } },
    });
  }
  if (phase === AssassinPhase.MAZE_SYNC && assinQ >= 7 && authorityQuestState(authority, 8006) >= 0) {
    const done = checkpoint(state, 'assassin.maze', state.assassin.maze);
    return evolve(state, {
      ...done,
      questId: 8006,
      questStatus: QuestStatus.RUNNING,
      agentLease: null,
      currentStep: step('assassin.guildmaster', QuestStepType.CHOICE, InterruptPolicy.SAFE, { type: MissionStageType.CHOICE }),
      currentObjective: null,
      objectiveId: 'assassin.guildmaster',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      interruptPolicy: InterruptPolicy.SAFE,
      missionStage: { type: MissionStageType.CHOICE, title: '公會長面談', question: ASSASSIN_GUILDMASTER[0], progress: 0, total: ASSASSIN_GUILDMASTER.length },
      assassin: { ...state.assassin, phase: AssassinPhase.GUILDMASTER, sourceState, guildmaster: { answers: [] } },
    });
  }
  if (phase === AssassinPhase.GUILDMASTER_SYNC && assinQ === 17 && frozenHeart > 0 && authorityQuestState(authority, 8007) >= 0) {
    const done = checkpoint(state, 'assassin.guildmaster', { evaluation: state.assassin.guildmaster.evaluation });
    return evolve(state, {
      ...done,
      questId: 8007,
      questStatus: QuestStatus.READY,
      agentLease: null,
      currentStep: step('assassin.final_commit', QuestStepType.COMMIT, InterruptPolicy.LOCKED, { type: MissionStageType.RESULT }),
      currentObjective: null,
      objectiveId: 'assassin.final_commit',
      objectiveGeneration: Number(state.objectiveGeneration) + 1,
      interruptPolicy: InterruptPolicy.LOCKED,
      missionStage: { type: MissionStageType.RESULT, title: '刺客轉職考驗完成', status: 'READY_TO_COMMIT', results: { ...state.assassin.results, maze: true, guildmaster: true }, actionLabel: '完成轉職' },
      assassin: { ...state.assassin, phase: AssassinPhase.FINAL_READY, sourceState },
    });
  }
  if (phase !== AssassinPhase.COMPLETED && Number(authority?.currentJob) === ASSASSIN_JOB_ID && authorityQuestState(authority, 8008) === 2) {
    const done = checkpoint(state, 'assassin.final_commit', { classId: ASSASSIN_JOB_ID });
    return evolve(state, {
      ...done,
      careerTarget: null,
      formalQuestStarted: false,
      formalQuestStarted: false,
      questId: 8008,
      questStatus: QuestStatus.COMPLETED,
      currentStep: null,
      currentObjective: null,
      objectiveId: null,
      agentLease: null,
      activeTrial: null,
      trialInventoryLock: false,
      supplyPending: false,
      originalObjective: null,
      temporaryObjective: null,
      interruptPolicy: InterruptPolicy.SAFE,
      combatPolicy: state.previousCombatPolicy ?? { mode: CombatPolicy.NORMAL, targets: [] },
      previousCombatPolicy: null,
      routeEvent: null,
      missionStage: { type: MissionStageType.RESULT, title: '正式轉職完成', status: 'COMPLETED', job: 'Assassin' },
      assassin: { ...state.assassin, phase: AssassinPhase.COMPLETED, formalQuestStarted: true, sourceState, results: { ...state.assassin.results, jobChange: true } },
    });
  }
  return state;
}

export function publicAssassinSource() {
  return structuredClone({ source: ASSASSIN_SOURCE, phases: AssassinPhase });
}

function noKillPreflight(authority) {
  const redPotions = Number(authority?.items?.[501] ?? 0);
  return questPreflightCheck({
    character: {
      hp: Number(authority?.hp ?? 0),
      maxHp: Number(authority?.maxHp ?? 1),
      sp: Number(authority?.sp ?? 0),
      maxSp: Number(authority?.maxSp ?? 0),
    },
    recoveryItems: [{ itemId: 501, amount: redPotions, hpRecovery: 1, spRecovery: 0 }],
    riskLevel: RiskLevel.TRIAL,
    requirement: { reservedHpRecovery: 10 },
  });
}

function prepareAssassinAction({ state, action, payload, authority }) {
  if (action !== 'START_NO_KILL') {
    return applyAssassinAction(state, action, payload, authority);
  }
  const preflight = noKillPreflight(authority);
  if (['PASS', 'WARNING'].includes(preflight.status)) {
    return applyAssassinAction(state, action, payload, authority, { preflight });
  }
  const pendingNoKill = applyAssassinAction(
    state,
    action,
    payload,
    authority,
    { preflight: { ...preflight, status: 'PASS' } },
  );
  return requestSupply({
    ...pendingNoKill,
    activeTrial: null,
    trialInventoryLock: false,
    interruptPolicy: InterruptPolicy.SAFE,
  }, {
    reservation: preflight.reservation,
    temporaryObjective: {
      type: 'SUPPLY',
      reason: 'ASSASSIN_NO_KILL_RESERVE',
      prepareCommand: assassinServerCommand('supply_exit'),
      prepareFromMap: ASSASSIN_SOURCE.guildMap,
      requirements: { items: [{ itemId: 501, minimumAmount: 10 }] },
    },
  });
}

export const ASSASSIN_JOB_ADAPTER = defineJobQuestAdapter({
  id: 'ASSASSIN',
  displayName: '刺客',
  version: 1,
  jobId: ASSASSIN_JOB_ID,
  eligibility: {
    sourceJobId: THIEF_JOB_ID,
    minimumJobLevel: ASSASSIN_SOURCE.eligibility.minimumJobLevel,
    skillPoint: ASSASSIN_SOURCE.eligibility.skillPoint,
    evaluate: assassinEligibility,
  },
  questStateMapping: ASSASSIN_SOURCE,
  steps: Object.freeze([
    'navigate_guild',
    'accept',
    'quiz',
    'precision_trial',
    'no_kill_trial',
    'maze',
    'guildmaster',
    'final_commit',
  ]),
  interactionDefinitions: ASSASSIN_INTERACTIONS,
  quizDefinitions: ASSASSIN_QUIZ_SETS,
  trialDefinitions: Object.freeze([
    Object.freeze({ id: 'precision', combatPolicy: CombatPolicy.TARGET_WHITELIST }),
    Object.freeze({ id: 'no_kill', combatPolicy: CombatPolicy.NO_ATTACK }),
  ]),
  routeEvents: ASSASSIN_MAZE,
  requiredItems: Object.freeze([
    Object.freeze({ itemId: 501, purpose: 'NO_KILL_PREFLIGHT', minimumAmount: 10 }),
    Object.freeze({ itemId: FROZEN_HEART_ITEM_ID, purpose: 'FINAL_COMMIT', minimumAmount: 1 }),
  ]),
  checkpointRules: Object.freeze({
    quizFailure: 'RETRY_QUIZ',
    precisionFailure: 'PRECISION_READY',
    noKillFailure: 'NO_KILL_READY',
    mazeFailure: 'MAZE',
  }),
  initializeState: initializeAssassinState,
  selectCareerTarget: selectAssassinCareer,
  applyAction: applyAssassinAction,
  prepareAction: prepareAssassinAction,
  reconcileState: reconcileAssassinState,
  publicState: (state) => structuredClone(state.assassin ?? null),
  publicStatus: (state) => {
    const phase = state.assassin?.phase ?? AssassinPhase.IDLE;
    return {
      phase,
      active: ![AssassinPhase.IDLE, AssassinPhase.COMPLETED].includes(phase),
      formalQuestStarted: state.assassin?.formalQuestStarted === true,
    };
  },
  shouldAutoDispatch: (state) =>
    state.assassin?.phase === AssassinPhase.NO_KILL_ACTIVE &&
    state.currentObjective?.type === 'NO_KILL_ROUTE' &&
    state.questStatus === QuestStatus.RUNNING &&
    !state.agentLease,
  finalCommit: {
    commitType: CommitType.JOB_CHANGE,
    payload: Object.freeze({ adapterId: 'ASSASSIN', targetJobId: ASSASSIN_JOB_ID }),
    completionQuestId: 8008,
    command: assassinServerCommand('commit'),
    validate: ({ authority, payload }) => {
      if (payload?.adapterId !== 'ASSASSIN' || Number(payload?.targetJobId) !== ASSASSIN_JOB_ID) {
        throw new Error('JOB_ADAPTER_COMMIT_PAYLOAD_INVALID');
      }
      const eligibility = assassinEligibility(authority);
      if (!eligibility.eligible) throw new Error(eligibility.failures[0]);
      if (
        Number(authority?.variables?.ASSIN_Q) !== 17 ||
        Number(authority?.items?.[FROZEN_HEART_ITEM_ID] ?? 0) < 1 ||
        authorityQuestState(authority, 8007) < 0
      ) {
        throw new Error('ASSASSIN_FINAL_STATE_INVALID');
      }
    },
    isComplete: (authority) =>
      Number(authority?.currentJob) === ASSASSIN_JOB_ID &&
      authorityQuestState(authority, 8008) === 2,
    result: (authority) => ({
      verified: true,
      currentJob: Number(authority.currentJob),
      questId: 8008,
      questState: authorityQuestState(authority, 8008),
      authority: 'rAthena/MariaDB',
      adapterId: 'ASSASSIN',
    }),
  },
});
