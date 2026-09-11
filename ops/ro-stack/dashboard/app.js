const $ = (s) => document.querySelector(s);
const mapNames = {
  prontera: '普隆德拉',
  prt_in: '普隆德拉室內商店',
  prt_fild08: '普隆德拉原野 08',
  morocc: '夢羅克',
  moc_fild19: '夢羅克原野 19',
  moc_ruins: '夢羅克遺跡',
  moc_pryd01: '金字塔迷宮 1F',
  moc_prydb1: '盜賊公會',
  moc_para01: '伊甸園總部',
  iz_int: '沉船船艙',
  iz_int01: '沉船船艙',
  iz_int02: '沉船船艙',
  iz_int03: '沉船船艙',
  iz_int04: '沉船船艙',
  int_land: '漂流島',
  int_land01: '漂流島',
  int_land02: '漂流島',
  int_land03: '漂流島',
  int_land04: '漂流島',
  izlude: '伊斯魯得島',
  iz_ac01: '克里圖拉學院 1F',
  iz_ac01_a: '克里圖拉學院 1F',
  iz_ac01_b: '克里圖拉學院 1F',
  iz_ac01_c: '克里圖拉學院 1F',
  iz_ac01_d: '克里圖拉學院 1F',
  'new_1-3': '新生訓練場',
};
const names = {
  Poring: '波利',
  Lunatic: '瘋兔',
  Fabre: '綠棉蟲',
  Pupa: '蛹',
  Drops: '小波利',
  'Little Poring': '小波利',
  Jellopy: '傑勒比結晶',
  'Sticky Mucus': '黏稠液體',
  Apple: '蘋果',
  Feather: '羽毛',
  Fluff: '柔毛',
  'Powder of Butterfly': '蝴蝶粉末',
  'Lunatic Card': '瘋兔卡片',
  Carrot: '紅蘿蔔',
  Clover: '三葉幸運草',
  'Fly Wing': '蒼蠅翅膀',
  'Green Herb': '綠色藥草',
  'Red Herb': '紅色藥草',
  'Sword [4]': '長劍 [4]',
  'Knife [4]': '短劍 [4]',
  'Novice Poring Card': '初心者波利卡片',
};
const jobNames = {
    0: '初心者',
    1: '劍士',
    2: '魔法師',
    3: '弓箭手',
    4: '服事',
    5: '商人',
    6: '盜賊',
  },
  firstJobs = {
    swordman: {
      name: '劍士',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    mage: {
      name: '魔法師',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    archer: {
      name: '弓箭手',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    acolyte: {
      name: '服事',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    merchant: {
      name: '商人',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    thief: {
      name: '盜賊',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
  },
  defaultAudio = {
    musicEnabled: true,
    soundEnabled: true,
    musicVolume: 20,
    soundVolume: 35,
    damageFloatsEnabled: true,
    damageFloatSize: 14,
    damageFloatScale: 50,
    damageFloatOpacity: 100,
    damageFloatWeight: 800,
    damageFloatFont: 'classic',
    damageFloatPositionX: 72,
    damageFloatPositionY: 72,
    damageFloatArc: 100,
  };
const damageFloatFontFamilies = Object.freeze({
  classic: 'Tahoma, Arial, sans-serif',
  traditional: '"Microsoft JhengHei", "Noto Sans TC", sans-serif',
  arial: 'Arial, sans-serif',
  consolas: 'Consolas, monospace',
  system: 'system-ui, sans-serif',
});
const musicSources = {
  title: '/ro/client/bgm/01-title.mp3',
  prontera: '/ro/client/bgm/08-prontera.mp3',
  prt_fild08: '/ro/client/bgm/12-streamside.mp3',
};
const officialCombatSoundRoot = '/ro/client/sfx/official';
const combatSounds = {
  daggerAttack: `${officialCombatSoundRoot}/_attack_dagger.wav`,
  daggerHit: `${officialCombatSoundRoot}/_hit_dagger.wav`,
  swordAttack: `${officialCombatSoundRoot}/_attack_sword.wav`,
  swordHit: `${officialCombatSoundRoot}/_hit_sword.wav`,
  maceAttack: `${officialCombatSoundRoot}/_attack_mace.wav`,
  maceHit: `${officialCombatSoundRoot}/_hit_mace.wav`,
  rodAttack: `${officialCombatSoundRoot}/_attack_rod.wav`,
  rodHit: `${officialCombatSoundRoot}/_hit_rod.wav`,
  bowAttack: `${officialCombatSoundRoot}/_attack_bow.wav`,
  arrowHit: `${officialCombatSoundRoot}/_hit_arrow.wav`,
  axeAttack: `${officialCombatSoundRoot}/_attack_axe.wav`,
  axeHit: `${officialCombatSoundRoot}/_hit_axe.wav`,
  fistHit1: `${officialCombatSoundRoot}/_hit_fist1.wav`,
  fistHit2: `${officialCombatSoundRoot}/_hit_fist2.wav`,
  fistHit3: `${officialCombatSoundRoot}/_hit_fist3.wav`,
  fistHit4: `${officialCombatSoundRoot}/_hit_fist4.wav`,
  poringAttack: `${officialCombatSoundRoot}/poring_attack.wav`,
  poringDamage: `${officialCombatSoundRoot}/poring_damage.wav`,
  poringDie: `${officialCombatSoundRoot}/poring_die.wav`,
  lunaticAttack: `${officialCombatSoundRoot}/lunatic_attack.wav`,
  lunaticDie: `${officialCombatSoundRoot}/lunatic_die.wav`,
  fabreAttack: `${officialCombatSoundRoot}/fabre_attack.wav`,
  fabreDamage: `${officialCombatSoundRoot}/fabre_damage.wav`,
  fabreDie: `${officialCombatSoundRoot}/fabre_die.wav`,
  monsterInsect: `${officialCombatSoundRoot}/monster_insect.wav`,
  monsterShell: `${officialCombatSoundRoot}/monster_shell.wav`,
  pecoEggHeartbeat: `${officialCombatSoundRoot}/peco_egg_heartbeat.wav`,
  pupaDie: `${officialCombatSoundRoot}/pupa_die.wav`,
  playerDamageMale: `${officialCombatSoundRoot}/damage_male.wav`,
  playerDieMale: `${officialCombatSoundRoot}/die_male.wav`,
  playerDamageNoviceFemale: `${officialCombatSoundRoot}/damage_novice_female.wav`,
  playerDieNoviceFemale: `${officialCombatSoundRoot}/die_novice_female.wav`,
  playerDamageSwordmanFemale: `${officialCombatSoundRoot}/damage_swordman_female.wav`,
  playerDieSwordmanFemale: `${officialCombatSoundRoot}/die_swordman_female.wav`,
  playerDamageMagicianFemale: `${officialCombatSoundRoot}/damage_magician_female.wav`,
  playerDieMagicianFemale: `${officialCombatSoundRoot}/die_magician_female.wav`,
  playerDamageArcherFemale: `${officialCombatSoundRoot}/damage_archer_female.wav`,
  playerDieArcherFemale: `${officialCombatSoundRoot}/die_archer_female.wav`,
  playerDamageAcolyteFemale: `${officialCombatSoundRoot}/damage_acolyte_female.wav`,
  playerDieAcolyteFemale: `${officialCombatSoundRoot}/die_acolyte_female.wav`,
  playerDamageMerchantFemale: `${officialCombatSoundRoot}/damage_merchant_female.wav`,
  playerDieMerchantFemale: `${officialCombatSoundRoot}/die_merchant_female.wav`,
  playerDamageThiefFemale: `${officialCombatSoundRoot}/damage_thief_female.wav`,
  playerDieThiefFemale: `${officialCombatSoundRoot}/die_thief_female.wav`,
  uiConfirm: `${officialCombatSoundRoot}/ui_confirm.wav`,
  uiCancel: `${officialCombatSoundRoot}/ui_cancel.wav`,
  uiTab: `${officialCombatSoundRoot}/ui_tab.wav`,
  uiOpen: `${officialCombatSoundRoot}/ui_open.wav`,
  uiClose: `${officialCombatSoundRoot}/ui_close.wav`,
  itemPickup: `${officialCombatSoundRoot}/item_pickup.wav`,
  itemDrop: `${officialCombatSoundRoot}/item_drop.wav`,
  equipItem01: `${officialCombatSoundRoot}/equip_item_01.wav`,
  equipItem02: `${officialCombatSoundRoot}/equip_item_02.wav`,
  equipItem03: `${officialCombatSoundRoot}/equip_item_03.wav`,
  equipItem04: `${officialCombatSoundRoot}/equip_item_04.wav`,
  equipItem05: `${officialCombatSoundRoot}/equip_item_05.wav`,
  equipItem06: `${officialCombatSoundRoot}/equip_item_06.wav`,
  equipItem07: `${officialCombatSoundRoot}/equip_item_07.wav`,
  itemDrinkPotion: `${officialCombatSoundRoot}/item_drink_potion.wav`,
  flyWing: `${officialCombatSoundRoot}/fly_wing.wav`,
  warp: `${officialCombatSoundRoot}/warp.wav`,
  portal: `${officialCombatSoundRoot}/portal.wav`,
  heal: `${officialCombatSoundRoot}/heal.wav`,
  levelUp: `${officialCombatSoundRoot}/level_up.wav`,
  jobLevelUp: `${officialCombatSoundRoot}/job_level_up.wav`,
  success: `${officialCombatSoundRoot}/success.wav`,
  failure: `${officialCombatSoundRoot}/failure.wav`,
  getCoin: `${officialCombatSoundRoot}/get_coin.wav`,
};
const weaponSoundProfiles = Object.freeze({
  dagger: { attack: 'daggerAttack', hits: ['daggerHit'] },
  sword: { attack: 'swordAttack', hits: ['swordHit'] },
  mace: { attack: 'maceAttack', hits: ['maceHit'] },
  rod: { attack: 'rodAttack', hits: ['rodHit'] },
  bow: { attack: 'bowAttack', hits: ['arrowHit'] },
  axe: { attack: 'axeAttack', hits: ['axeHit'] },
  fist: {
    attack: null,
    hits: ['fistHit1', 'fistHit2', 'fistHit3', 'fistHit4'],
  },
});
const monsterSoundProfiles = Object.freeze({
  Poring: {
    attack: [['poringAttack', 0]],
    damage: [['poringDamage', 100]],
    death: [['poringDie', 25]],
  },
  Lunatic: {
    attack: [['lunaticAttack', 0]],
    damage: [],
    death: [['lunaticDie', 75]],
  },
  Fabre: {
    attack: [['fabreAttack', 0]],
    damage: [
      ['monsterInsect', 0],
      ['fabreDamage', 100],
    ],
    death: [['fabreDie', 100]],
  },
  Pupa: {
    attack: [],
    damage: [
      ['monsterShell', 100],
      ['pecoEggHeartbeat', 400],
    ],
    death: [['pupaDie', 0]],
  },
  Drops: {
    attack: [['poringAttack', 0]],
    damage: [['poringDamage', 100]],
    death: [['poringDie', 25]],
  },
  'Little Poring': {
    attack: [['poringAttack', 0]],
    damage: [['poringDamage', 100]],
    death: [],
  },
});
const combatAudio = Object.fromEntries(
  Object.entries(combatSounds).map(([key, source]) => [
    key,
    Array.from({ length: 4 }, () => {
      const audio = new Audio(source);
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      return audio;
    }),
  ]),
);
const combatAudioCursor = Object.fromEntries(
  Object.keys(combatSounds).map((key) => [key, 0]),
);
let combatAudioContext = null,
  combatAudioLoading = null;
const combatAudioBuffers = new Map();
const emotions = [
  { id: 0, symbol: '❗', label: '驚嘆', source: '*!*' },
  { id: 1, symbol: '❓', label: '疑問', source: '*?*' },
  { id: 2, symbol: '♪', label: '開心', source: '*Whistling*' },
  { id: 3, symbol: '♥', label: '愛心', source: '*Heart*' },
  { id: 4, symbol: '💧', label: '流汗', source: '*Sweat*' },
  { id: 5, symbol: '💡', label: '靈感', source: '*Idea*' },
  { id: 7, symbol: '💢', label: '碎念', source: '*Grumble*' },
  { id: 9, symbol: '…', label: '無言', source: '*...*' },
  { id: 10, symbol: '✌', label: '勝利', source: '*Peace*' },
  { id: 12, symbol: '👋', label: '揮手', source: '*Wave*' },
  { id: 14, symbol: '💕', label: '喜愛', source: '*Love*' },
  { id: 15, symbol: '🙏', label: '感謝', source: '*Thanks*' },
  { id: 16, symbol: '😭', label: '大哭', source: '*Wah*' },
  { id: 17, symbol: '🙇', label: '抱歉', source: '*Sorry*' },
  { id: 20, symbol: '🤔', label: '思考', source: '*Hmm*' },
  { id: 21, symbol: '👍', label: '稱讚', source: '*Nice One*' },
  { id: 23, symbol: '😲', label: '驚訝', source: '*Omg*' },
  { id: 26, symbol: '🆘', label: '求救', source: '*Help*' },
  { id: 28, symbol: '😢', label: '哭泣', source: '*Sob*' },
  { id: 29, symbol: 'GG', label: '好遊戲', source: '*Good Game*' },
  { id: 30, symbol: '💋', label: '親吻', source: '*Kiss*' },
  { id: 33, symbol: '👌', label: '確定', source: '*Ok*' },
  { id: 36, symbol: '😠', label: '生氣', source: '*Angry*' },
  { id: 45, symbol: '🥱', label: '打哈欠', source: '*Yawn*' },
  { id: 46, symbol: '🎉', label: '恭喜', source: '*Congratulations*' },
];
const emotionBySource = new Map(emotions.map((entry) => [entry.source, entry]));
const chatChannelDefs = Object.freeze({
  all: { label: '全部訊息', send: 'public' },
  public: { label: '一般頻道' },
  private: { label: '密語頻道', target: true },
  party: { label: '隊伍頻道' },
  guild: { label: '公會頻道' },
  clan: { label: '家族頻道' },
  battleground: { label: '戰場頻道' },
  map: { label: '地圖頻道' },
  global: { label: '全服頻道' },
  trade: { label: '交易頻道' },
  support: { label: '支援頻道' },
  ally: { label: '同盟頻道' },
  system: { label: '系統訊息', readonly: true },
});
let authenticated = false,
  audioSaveTimer = null,
  sessionStartedAt = null,
  statePoll = null,
  eventTimer = null,
  eventCursor = null,
  eventLines = [],
  socialTimer = null,
  socialCursor = null,
  socialEvents = [],
  currentChatChannel = 'all',
  chatReady = false,
  pendingChatRows = new Map(),
  mediaRecorder = null,
  voiceStream = null,
  voiceChunks = [],
  voiceStartedAt = 0,
  voiceStopTimer = null,
  currentCharacterName = '',
  lastState = null,
  selectedCardBinId = null,
  selectedCardItemKey = null,
  inventoryItems = [],
  inventoryCategory = 'consumable',
  lastEventAt = 0,
  currentRunning = false,
  mapField = null,
  mapFieldName = '',
  mapFieldError = '',
  mapInfoData = null,
  skillTreeData = null,
  lastSkillTreeSignature = '',
  supplyCycleSettings = null,
  supplyRuleSignature = '',
  openSkillDescriptions = new Set(),
  openMapMonsters = new Set(),
  openMapDrops = new Set(),
  minimapLive = null,
  minimapFrame = null,
  minimapTerrain = null,
  minimapTerrainKey = '',
  minimapTracks = new Map(),
  minimapLastPaint = 0,
  lastLiveHp = null,
  damageFlashUntil = 0,
  damageFloatSequence = 0,
  damageAccumulation = new Map(),
  currentMusic = 'title',
  currentCreateSex = 'M';
let audioPrefs = (() => {
  try {
    return {
      ...defaultAudio,
      ...JSON.parse(localStorage.getItem('ro-audio') || '{}'),
    };
  } catch {
    return { ...defaultAudio };
  }
})();
const show = (el, on = true) => el.classList.toggle('hidden', !on);
function setupFoldableWindows() {
  document.querySelectorAll('#game .window > .titlebar').forEach((titlebar) => {
    const windowElement = titlebar.parentElement;
    if (!windowElement || titlebar.querySelector('.window-fold-button')) return;
    const title = titlebar.querySelector('span')?.textContent?.trim() || '視窗';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'window-fold-button';
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', `縮小${title}`);
    button.title = `縮小${title}`;
    const setCollapsed = (collapsed) => {
      windowElement.classList.toggle('window-collapsed', collapsed);
      button.classList.toggle('is-collapsed', collapsed);
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute(
        'aria-label',
        `${collapsed ? '展開' : '縮小'}${title}`,
      );
      button.title = `${collapsed ? '展開' : '縮小'}${title}`;
    };
    button.addEventListener('click', () =>
      setCollapsed(!windowElement.classList.contains('window-collapsed')),
    );
    titlebar.append(button);
  });
}
function setupTaskSections() {
  document.querySelectorAll('.task-section-title').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const section = button.closest('.task-section');
      if (!section) return;
      const collapsed = section.classList.toggle('is-collapsed');
      button.setAttribute('aria-expanded', String(!collapsed));
    });
  });
}
function setRandomLoginBackground() {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  $('#auth').classList.add(
    bytes[0] % 2 === 0 ? 'login-background-01' : 'login-background-02',
  );
}
const api = async (url, options) => {
  const r = await fetch(url, { cache: 'no-store', ...options });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '操作失敗');
  return data;
};
const bodyAsset = (c) =>
  `/ro/client/paperdoll/novice-${c.sex === 'F' ? 'female' : 'male'}.png`;
const paperdollAsset = (sex, hair = 1) => {
  const style = Math.max(1, Math.min(42, Number(hair) || 1));
  return `/ro/client/paperdoll/novice-${sex === 'F' ? 'female' : 'male'}-hair-${style}.png`;
};
const duration = (s) => {
  if (!s) return '00:00:00';
  const n = Math.max(0, Math.floor((Date.now() - s) / 1000));
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
};
const pct = (v, m) => `${m > 0 ? Math.min(100, (v / m) * 100) : 0}%`;
const statCost = (value) =>
  value < 100
    ? 2 + Math.floor((value - 1) / 10)
    : 16 + 4 * Math.floor((value - 100) / 5);

function syncAudioControls() {
  for (const id of ['authMusicVolume', 'musicVolume'])
    if ($(`#${id}`)) $(`#${id}`).value = audioPrefs.musicVolume;
  for (const id of ['authMusicValue', 'musicValue'])
    if ($(`#${id}`)) $(`#${id}`).textContent = `${audioPrefs.musicVolume}%`;
  $('#soundVolume').value = audioPrefs.soundVolume;
  $('#soundValue').textContent = `${audioPrefs.soundVolume}%`;
  $('#authMusicToggle').checked = audioPrefs.musicEnabled;
  $('#musicToggle').checked = audioPrefs.musicEnabled;
  $('#soundToggle').checked = audioPrefs.soundEnabled;
  $('#damageFloatToggle').checked = audioPrefs.damageFloatsEnabled;
  $('#damageFloatScale').value = audioPrefs.damageFloatScale;
  $('#damageFloatOpacity').value = audioPrefs.damageFloatOpacity;
  $('#damageFloatWeight').value = String(audioPrefs.damageFloatWeight);
  $('#damageFloatFont').value = audioPrefs.damageFloatFont;
  $('#damageFloatPositionX').value = audioPrefs.damageFloatPositionX;
  $('#damageFloatPositionY').value = audioPrefs.damageFloatPositionY;
  $('#damageFloatArc').value = audioPrefs.damageFloatArc;
  const damageSize = (28 * audioPrefs.damageFloatScale) / 100;
  $('#damageFloatScaleValue').textContent = `${audioPrefs.damageFloatScale}%`;
  $('#damageFloatOpacityValue').textContent =
    `${audioPrefs.damageFloatOpacity}%`;
  $('#damageFloatPositionXValue').textContent =
    `${audioPrefs.damageFloatPositionX}%`;
  $('#damageFloatPositionYValue').textContent =
    `${audioPrefs.damageFloatPositionY}%`;
  $('#damageFloatArcValue').textContent = `${audioPrefs.damageFloatArc}%`;
  for (const node of [$('#damageFloatLayer'), $('#damageFloatPreview')]) {
    node.style.setProperty('--damage-float-size', `${damageSize}px`);
    node.style.setProperty(
      '--damage-float-opacity',
      String(audioPrefs.damageFloatOpacity / 100),
    );
    node.style.setProperty(
      '--damage-float-weight',
      audioPrefs.damageFloatWeight,
    );
    node.style.setProperty(
      '--damage-float-family',
      damageFloatFontFamilies[audioPrefs.damageFloatFont] ??
        damageFloatFontFamilies.classic,
    );
  }
  requestAnimationFrame(layoutDamageFloatPreview);
  const bgm = $('#bgm');
  // Preserve the displayed percentage while halving physical BGM output.
  bgm.volume = Math.max(0, Math.min(0.5, audioPrefs.musicVolume / 200));
  bgm.muted = !audioPrefs.musicEnabled;
}

function damageFloatMotion(container, node, lane = 0, sequence = 0) {
  const width = container.clientWidth || 390,
    height = container.clientHeight || 320,
    requestedX = (width * audioPrefs.damageFloatPositionX) / 100,
    requestedY = (height * audioPrefs.damageFloatPositionY) / 100,
    nodeWidth = Math.max(1, node.offsetWidth) * 1.08,
    nodeHeight = Math.max(1, node.offsetHeight) * 1.08,
    halfWidth = nodeWidth / 2,
    minimumX = halfWidth + 5,
    maximumX = width - halfWidth - 5,
    originX =
      minimumX <= maximumX
        ? Math.min(maximumX, Math.max(minimumX, requestedX))
        : width / 2,
    maximumY = Math.max(5, height - nodeHeight - 5),
    originY = Math.min(maximumY, Math.max(5, requestedY - lane * 9)),
    preferredDirection =
      audioPrefs.damageFloatPositionX < 50
        ? 1
        : audioPrefs.damageFloatPositionX > 50
          ? -1
          : sequence % 2 === 0
            ? 1
            : -1,
    availableRight = Math.max(0, width - 5 - (originX + halfWidth)),
    availableLeft = Math.max(0, originX - halfWidth - 5),
    direction =
      preferredDirection > 0 &&
      availableRight < 18 &&
      availableLeft > availableRight
        ? -1
        : preferredDirection < 0 &&
            availableLeft < 18 &&
            availableRight > availableLeft
          ? 1
          : preferredDirection,
    desiredDistance =
      Math.min(112, Math.max(62, width * 0.22)) *
      (audioPrefs.damageFloatArc / 100),
    horizontalRoom = direction > 0 ? availableRight : availableLeft,
    distance = Math.min(desiredDistance, horizontalRoom) * direction,
    desiredLift = (50 + lane * 9) * (audioPrefs.damageFloatArc / 100),
    lift = Math.min(desiredLift, Math.max(0, originY - 5)),
    desiredEndLift = (10 + lane * 9) * (audioPrefs.damageFloatArc / 100),
    endLift = Math.min(desiredEndLift, Math.max(0, originY - 5));
  return {
    originX,
    originY,
    midX: Math.round(distance * 0.62),
    midY: -Math.round(lift),
    endX: Math.round(distance),
    endY: -Math.round(endLift),
  };
}

function applyDamageFloatMotion(node, container, lane = 0, sequence = 0) {
  const motion = damageFloatMotion(container, node, lane, sequence);
  node.style.left = `${motion.originX}px`;
  node.style.top = `${motion.originY}px`;
  node.style.setProperty('--damage-mid-x', `${motion.midX}px`);
  node.style.setProperty('--damage-mid-y', `${motion.midY}px`);
  node.style.setProperty('--damage-end-x', `${motion.endX}px`);
  node.style.setProperty('--damage-end-y', `${motion.endY}px`);
  return motion;
}

function layoutDamageFloatPreview() {
  const preview = $('#damageFloatPreview');
  if (!preview) return;
  const samples = [...preview.querySelectorAll('.damage-preview')];
  let guideMotion;
  samples.forEach((sample, index) => {
    sample.classList.remove('preview-running');
    const motion = applyDamageFloatMotion(sample, preview, index, index);
    if (!guideMotion) guideMotion = motion;
  });
  if (guideMotion) {
    const positions = {
      start: [guideMotion.originX, guideMotion.originY],
      apex: [
        guideMotion.originX + guideMotion.midX,
        guideMotion.originY + guideMotion.midY,
      ],
      end: [
        guideMotion.originX + guideMotion.endX,
        guideMotion.originY + guideMotion.endY,
      ],
    };
    for (const [name, position] of Object.entries(positions)) {
      const marker = preview.querySelector(`[data-preview-marker="${name}"]`);
      marker.style.left = `${position[0]}px`;
      marker.style.top = `${position[1]}px`;
    }
    const path = $('#damagePreviewPathLine'),
      pathCanvas = path.closest('svg');
    pathCanvas.setAttribute(
      'viewBox',
      `0 0 ${preview.clientWidth} ${preview.clientHeight}`,
    );
    path.setAttribute(
      'points',
      `${positions.start.join(',')} ${positions.apex.join(',')} ${positions.end.join(',')}`,
    );
    const reference = preview.querySelector('.damage-preview-reference');
    reference.style.left = `${guideMotion.originX}px`;
    reference.style.top = `${guideMotion.originY}px`;
  }
  void preview.offsetWidth;
  samples.forEach((sample) => sample.classList.add('preview-running'));
}
function prepareCombatAudio() {
  if (!combatAudioContext || combatAudioLoading) return combatAudioLoading;
  combatAudioLoading = Promise.all(
    Object.entries(combatSounds).map(async ([key, source]) => {
      const response = await fetch(source, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`音效讀取失敗：${key}`);
      const buffer = await combatAudioContext.decodeAudioData(
        await response.arrayBuffer(),
      );
      combatAudioBuffers.set(key, buffer);
    }),
  ).catch((error) => {
    combatAudioLoading = null;
    console.warn('戰鬥音效解碼失敗，改用媒體播放', error);
  });
  return combatAudioLoading;
}
function unlockAudio(fromUserGesture = false) {
  if (audioPrefs.musicEnabled && audioPrefs.musicVolume > 0)
    $('#bgm')
      .play()
      .catch(() => {});
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass && (fromUserGesture || combatAudioContext)) {
    combatAudioContext ||= new AudioContextClass();
    const resume =
      combatAudioContext.state === 'suspended'
        ? combatAudioContext.resume()
        : Promise.resolve();
    void resume.then(prepareCombatAudio).catch(() => {});
  }
  for (const pool of Object.values(combatAudio)) {
    for (const sound of pool) {
      if (sound.dataset.unlocked === '1') continue;
      sound.muted = true;
      sound
        .play()
        .then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.muted = false;
          sound.dataset.unlocked = '1';
        })
        .catch(() => {
          sound.muted = false;
        });
    }
  }
}
function setMusicContext(context) {
  const key = musicSources[context] ? context : 'title';
  if (key === currentMusic) return;
  currentMusic = key;
  const bgm = $('#bgm');
  bgm.src = musicSources[key];
  bgm.load();
  unlockAudio();
}
function reportCombatSound(detail) {
  document.dispatchEvent(new CustomEvent('ro-combat-sound', { detail }));
}
function playCombatSound(
  key,
  delay = 0,
  combatEventId = '',
  hitIndex = 0,
  gainScale = 1,
) {
  if (
    !key ||
    !combatSounds[key] ||
    !audioPrefs.soundEnabled ||
    audioPrefs.soundVolume <= 0
  )
    return;
  const start = () => {
    const volume = Math.max(
        0,
        Math.min(1, (audioPrefs.soundVolume / 100) * gainScale),
      ),
      buffer = combatAudioBuffers.get(key);
    if (
      combatAudioContext &&
      combatAudioContext.state === 'running' &&
      buffer
    ) {
      const source = combatAudioContext.createBufferSource(),
        gain = combatAudioContext.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(combatAudioContext.destination);
      source.start();
      reportCombatSound({
        key,
        combatEventId,
        hitIndex,
        backend: 'web-audio',
        volume,
        started: true,
      });
      return;
    }
    const pool = combatAudio[key];
    if (!pool?.length) return;
    const cursor = combatAudioCursor[key]++ % pool.length,
      sound = pool[cursor];
    sound.currentTime = 0;
    sound.muted = false;
    sound.volume = volume;
    sound
      .play()
      .then(() =>
        reportCombatSound({
          key,
          combatEventId,
          hitIndex,
          backend: 'html-audio',
          volume,
          started: true,
        }),
      )
      .catch((error) => {
        reportCombatSound({
          key,
          combatEventId,
          hitIndex,
          backend: 'html-audio',
          volume,
          started: false,
        });
        console.warn('戰鬥音效播放失敗', key, error);
      });
  };
  if (delay > 0) setTimeout(start, delay);
  else start();
}
function persistAudio() {
  try {
    localStorage.setItem('ro-audio', JSON.stringify(audioPrefs));
  } catch {}
  syncAudioControls();
  unlockAudio();
  if (!authenticated) return;
  clearTimeout(audioSaveTimer);
  audioSaveTimer = setTimeout(
    () =>
      api('/api/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(audioPrefs),
      }).catch(() => {}),
    250,
  );
}
function setAudio(patch) {
  audioPrefs = { ...audioPrefs, ...patch };
  persistAudio();
}
async function loadAccountAudio() {
  try {
    const data = await api('/api/preferences');
    audioPrefs = { ...defaultAudio, ...data.preferences };
    localStorage.setItem('ro-audio', JSON.stringify(audioPrefs));
  } catch {}
  syncAudioControls();
  unlockAudio();
}

function localize(line) {
  const passiveProc = passiveProcName(line);
  const activeSkill = line.match(/You use (.+?) \(Lv: (\d+)\)/),
    selfSkill = line.match(/You use (.+?) on yourself \(Lv: (\d+)\)/),
    recoverySkill = line.match(
      /You use (.+?) on yourself \(Gained: (\d+) hp\)/,
    );
  for (const [from, to] of Object.entries(names))
    line = line.replaceAll(from, to);
  line = line
    .replace(/^\[\s*(\d+)\/\s*(\d+)\]\s*/, '[HP $1% · SP $2%] ')
    .replace(
      /Map Change: (prontera|prt_fild08|prt_in)\.gat/,
      (_, m) => `[地圖] 進入 ${mapNames[m] ?? m}`,
    )
    .replace(
      /Auto-storaging due to itemsMaxWeight/,
      '[補給] 負重達標，前往卡普拉存倉',
    )
    .replace(
      /Auto-selling due to itemsMaxWeight/,
      '[補給] 負重達標，前往商店販售',
    )
    .replace(
      /Auto-buying due to insufficient (.+)/,
      '[補給] $1 數量不足，前往商店購買',
    )
    .replace(/Auto-storage sequence completed\./, '[補給] 卡普拉存倉完成')
    .replace(/Auto-sell sequence completed\./, '[補給] 戰利品販售完成')
    .replace(/Auto-buy sequence completed\./, '[補給] 補給品購買完成')
    .replace(/Calculating random route to: /, '[尋路] 計算路徑：')
    .replace(/Moving to /, '[移動] 前往 ')
    .replace(/You are now attacking Monster /, '[索敵] 鎖定 ')
    .replace(/You attack Monster /, '[攻擊] 你攻擊 ')
    .replace(
      /You use (.+?) \(Lv: (\d+)\) on Monster /,
      (_, skill, level) =>
        `[主動技能] ${localizedSkillName(activeSkill?.[1] ?? skill)} Lv.${level} · 攻擊 `,
    )
    .replace(/You use (.+?) on yourself \(Lv: (\d+)\)/, (_, skill, level) => {
      const definition = localizedSkillDefinition(selfSkill?.[1] ?? skill);
      return definition?.automationMode === 'selfBuff'
        ? `[輔助技能] ${definition.name} Lv.${level} · 自動維持狀態`
        : `[主動技能] ${definition?.name ?? skill} Lv.${level} · 以自身為中心施放`;
    })
    .replace(
      /You use (.+?) on yourself \(Gained: (\d+) hp\)/,
      (_, skill, gained) =>
        `[主動技能] ${localizedSkillName(recoverySkill?.[1] ?? skill)} · 自身恢復 ${gained} HP`,
    )
    .replace(/Monster (.+?) attacks you/, '[受傷] $1 攻擊你')
    .replace(
      /You have gained ([-\d]+)\/([-\d]+).* Exp/,
      '[經驗] 人物 +$1，職業 +$2',
    )
    .replace(/You are now level (\d+)/, '[升級] 人物等級 $1')
    .replace(/You are now job level (\d+)/, '[升級] 職業等級 $1')
    .replace(/Item Appeared: (.+?) \(\d+\) x (\d+).*/, '[掉落] $1 × $2')
    .replace(
      /Item added to inventory: (.+?) \(\d+\) x (\d+).*/,
      '[拾取] $1 × $2',
    )
    .replace(/Target Monster (.+?) died/, '[擊倒] $1')
    .replace(/You have died/, '[死亡] 你被擊倒')
    .replace(/Sending respawn\./, '[復活] 返回儲存點')
    .replace(/\(Dmg: ([^)]+)\)/, '(傷害：$1)')
    .replace(/\(Delay: (\d+)ms\)/, '(延遲：$1ms)');
  return passiveProc
    ? line.replace('[攻擊]', `[被動技能] ${passiveProc}觸發 ·`)
    : line;
}
function localizedSkillDefinition(englishName) {
  const normalized = String(englishName).trim().toLocaleLowerCase('en');
  for (const job of Object.values(skillTreeData?.jobs ?? {})) {
    const skill = job.skills?.find((entry) => {
      const firstLine = String(entry.description ?? '')
        .split('\n', 1)[0]
        .toLocaleLowerCase('en');
      return (
        String(entry.englishName ?? '')
          .trim()
          .toLocaleLowerCase('en') === normalized ||
        firstLine.includes(`(${normalized})`)
      );
    });
    if (skill) return skill;
  }
  return null;
}
function localizedSkillName(englishName) {
  return localizedSkillDefinition(englishName)?.name ?? englishName;
}
const passiveProcRules = Object.freeze([
  { handle: 'TF_DOUBLE', hits: 2, name: '二刀連擊' },
  { handle: 'MO_TRIPLEATTACK', hits: 3, name: '三段掌' },
  { handle: 'GS_CHAINACTION', hits: 2, name: '連鎖動作' },
]);
function passiveProcName(line) {
  if (!/You attack Monster/.test(line)) return '';
  const hits = Number(line.match(/\(Dmg: [^)]+\*(\d+)\)/)?.[1] ?? 0);
  if (!hits) return '';
  const learned = new Set(
    (lastState?.derived?.skills ?? [])
      .filter((skill) => Number(skill.level) > 0)
      .map((skill) => skill.handle),
  );
  return (
    passiveProcRules.find(
      (rule) => rule.hits === hits && learned.has(rule.handle),
    )?.name ?? ''
  );
}
function eventClass(line) {
  if (passiveProcName(line)) return 'passive-proc';
  if (/You use /.test(line)) return 'active-skill';
  if (/Item |inventory/.test(line)) return 'drop-event';
  if (/gained|level/.test(line)) return 'exp';
  if (/attacks you|died/.test(line)) return 'hurt';
  if (/You attack|attacking/.test(line)) return 'hit';
  if (/route|Moving|Map Change/.test(line)) return 'route';
  return 'system';
}
function eventNode(line) {
  const row = document.createElement('div');
  row.className = `event ${eventClass(line)}`;
  const time = document.createElement('small');
  time.textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const message = document.createElement('span');
  message.textContent = localize(line);
  row.append(time, message);
  return row;
}
function damageEvent(line) {
  if (!/You (?:attack|use)/.test(line)) return null;
  const target = line.match(/Monster (.+?) \((\d+)\)/),
    damage = line.match(/\(Dmg: ([^)]+)\)/);
  if (!target || !damage) return null;
  const expression = damage[1].trim();
  if (/^Miss!?$/i.test(expression))
    return {
      target: `${target[1]}:${target[2]}`,
      targetName: target[1],
      parts: [],
      total: 0,
      miss: true,
    };
  const critical = expression.includes('!'),
    parts = [];
  for (const component of expression.replaceAll('!', '').split(/\s*\+\s*/)) {
    const multiple = component.match(/^(\d+)\s*\*\s*(\d+)$/);
    if (multiple) {
      const value = Number(multiple[1]),
        hits = Math.min(8, Number(multiple[2]));
      if (value > 0 && hits > 0)
        for (let index = 0; index < hits; index += 1) parts.push(value);
      continue;
    }
    const value = Number(component);
    if (Number.isFinite(value) && value > 0) parts.push(value);
  }
  if (!parts.length) return null;
  return {
    target: `${target[1]}:${target[2]}`,
    targetName: target[1],
    parts,
    total: parts.reduce((sum, value) => sum + value, 0),
    critical,
    miss: false,
  };
}
function currentWeaponSoundProfile() {
  const weapon = (lastState?.equipment ?? []).find(
      (item) => item.slot === 'rightHand',
    ),
    identity = `${weapon?.aegisName ?? ''} ${weapon?.name ?? ''}`;
  if (/bow|弓/i.test(identity)) return weaponSoundProfiles.bow;
  if (/axe|斧/i.test(identity)) return weaponSoundProfiles.axe;
  if (/dagger|knife|短劍|匕首/i.test(identity))
    return weaponSoundProfiles.dagger;
  if (/mace|club|錘|棍/i.test(identity)) return weaponSoundProfiles.mace;
  if (/rod|staff|杖/i.test(identity)) return weaponSoundProfiles.rod;
  if (/sword|falchion|劍/i.test(identity)) return weaponSoundProfiles.sword;
  return (
    {
      1: weaponSoundProfiles.sword,
      2: weaponSoundProfiles.rod,
      3: weaponSoundProfiles.bow,
      4: weaponSoundProfiles.mace,
      5: weaponSoundProfiles.axe,
      6: weaponSoundProfiles.dagger,
    }[Number(lastState?.character?.classId)] ?? weaponSoundProfiles.fist
  );
}
function playerCombatVoice(event) {
  if (lastState?.character?.sex !== 'F')
    return event === 'death' ? 'playerDieMale' : 'playerDamageMale';
  const job =
      {
        0: 'Novice',
        1: 'Swordman',
        2: 'Magician',
        3: 'Archer',
        4: 'Acolyte',
        5: 'Merchant',
        6: 'Thief',
      }[Number(lastState?.character?.classId)] ?? 'Novice',
    prefix = event === 'death' ? 'playerDie' : 'playerDamage';
  return `${prefix}${job}Female`;
}
function playMonsterSoundSequence(
  monsterName,
  event,
  baseDelay = 0,
  combatEventId = '',
  hitIndex = 0,
) {
  const sequence = monsterSoundProfiles[monsterName]?.[event] ?? [];
  for (const [key, offset] of sequence)
    playCombatSound(key, baseDelay + offset, combatEventId, hitIndex, 0.88);
}
function playInterfaceEventSound(line) {
  if (/Fly Wing|蝶翅膀|蒼蠅翅膀/i.test(line)) {
    playCombatSound('flyWing', 0, '', 0, 0.72);
    return;
  }
  if (/Map Change|teleport|warp|傳送/i.test(line)) {
    playCombatSound('warp', 0, '', 0, 0.62);
    return;
  }
  if (/Item .+ picked up|picked up .+|取得道具|獲得物品/i.test(line)) {
    playCombatSound('itemPickup', 0, '', 0, 0.55);
    return;
  }
  if (/drop|丟棄|丟下/i.test(line)) {
    playCombatSound('itemDrop', 0, '', 0, 0.5);
    return;
  }
  if (/Zeny|zeny|金幣/i.test(line)) {
    playCombatSound('getCoin', 0, '', 0, 0.5);
    return;
  }
  if (/You use .*(?:Potion|potion)|使用.*(?:藥水|紅水|藍水)/i.test(line)) {
    playCombatSound('itemDrinkPotion', 0, '', 0, 0.58);
    return;
  }
  if (/Job (?:Level|Lv).*?(?:up|提升)|職業等級/i.test(line)) {
    playCombatSound('jobLevelUp', 0, '', 0, 0.65);
    return;
  }
  if (/Base (?:Level|Lv).*?(?:up|提升)|等級提升|level up/i.test(line)) {
    playCombatSound('levelUp', 0, '', 0, 0.65);
    return;
  }
  if (/heal|healed|恢復|治癒/i.test(line))
    playCombatSound('heal', 0, '', 0, 0.52);
}
function equipSoundKey(item) {
  const itemId = Number(item?.itemId ?? item?.binId ?? 0);
  return `equipItem${String((Math.abs(itemId) % 7) + 1).padStart(2, '0')}`;
}
function monsterNameFromLine(line, suffix) {
  const match = line.match(new RegExp(`Monster (.+?)${suffix}`));
  return match?.[1]?.replace(/\s+\(\d+\)$/, '') ?? '';
}
function combatHitInterval(line) {
  return passiveProcName(line) === '二刀連擊' ? 347 : 75;
}
function createDamageFloat(
  text,
  kind,
  delay = 0,
  lane = 0,
  combatEventId = '',
  hitIndex = 0,
) {
  const layer = $('#damageFloatLayer');
  if (!layer || !audioPrefs.damageFloatsEnabled) return;
  while (layer.childElementCount >= 18) layer.firstElementChild.remove();
  const node = document.createElement('span');
  node.className = `damage-float ${kind}`;
  node.textContent = text;
  node.dataset.damageKind = kind;
  node.dataset.combatEventId = combatEventId;
  node.dataset.hitIndex = String(hitIndex);
  const sequence = damageFloatSequence++;
  node.style.setProperty('--damage-delay', `${delay}ms`);
  node.style.visibility = 'hidden';
  layer.append(node);
  applyDamageFloatMotion(node, layer, lane, sequence);
  node.style.visibility = '';
  setTimeout(() => node.remove(), 1450 + delay);
}
function spawnDamageFloats(row, event, combatEventId, hitInterval = 75) {
  if (!event || !audioPrefs.damageFloatsEnabled) return;
  const layer = $('#damageFloatLayer'),
    message = row.querySelector('span'),
    layerRect = layer?.getBoundingClientRect(),
    messageRect = message?.getBoundingClientRect();
  if (!layerRect || !messageRect || messageRect.bottom < layerRect.top) return;
  const now = performance.now(),
    previous = damageAccumulation.get(event.target),
    continuing = previous && now - previous.at <= 1200,
    accumulated = (continuing ? previous.total : 0) + event.total;
  damageAccumulation.set(event.target, { at: now, total: accumulated });
  for (const [index, value] of event.parts.entries())
    createDamageFloat(
      String(value),
      event.critical ? 'critical' : 'segment',
      index * hitInterval,
      index,
      combatEventId,
      index,
    );
  if (event.miss) createDamageFloat('MISS', 'miss', 0, 0, combatEventId, 0);
  if (!event.critical && (event.parts.length > 1 || continuing))
    createDamageFloat(
      String(accumulated),
      'total',
      Math.max(0, event.parts.length - 1) * hitInterval + 130,
      1,
      combatEventId,
      event.parts.length,
    );
}
function presentCombatEvent(row, line) {
  const damage = damageEvent(line);
  if (damage) {
    const combatEventId = `hit-${Date.now()}-${damageFloatSequence}`,
      audibleHits = Math.max(1, damage.parts.length),
      hitInterval = combatHitInterval(line),
      weapon = currentWeaponSoundProfile(),
      isSkill = /You use /.test(line);
    spawnDamageFloats(row, damage, combatEventId, hitInterval);
    if (!isSkill) playCombatSound(weapon.attack, 0, combatEventId, 0, 0.82);
    if (!damage.miss)
      for (let hitIndex = 0; hitIndex < audibleHits; hitIndex += 1) {
        const delay = hitIndex * hitInterval;
        if (!isSkill)
          playCombatSound(
            weapon.hits[hitIndex % weapon.hits.length],
            delay,
            combatEventId,
            hitIndex,
          );
        playMonsterSoundSequence(
          damage.targetName,
          'damage',
          delay,
          combatEventId,
          hitIndex,
        );
      }
    return;
  }
  if (/Monster .+ attacks you/.test(line)) {
    const combatEventId = `hurt-${Date.now()}-${damageFloatSequence}`,
      monsterName = monsterNameFromLine(line, ' attacks you');
    playMonsterSoundSequence(monsterName, 'attack', 0, combatEventId, 0);
    playCombatSound(playerCombatVoice('damage'), 0, combatEventId, 0, 0.72);
  } else if (/Target Monster .+ died/.test(line)) {
    const monsterName = monsterNameFromLine(line, ' died');
    playMonsterSoundSequence(monsterName, 'death');
  } else if (/You have died/.test(line))
    playCombatSound(playerCombatVoice('death'));
}
function renderEventDelta(lines, reset = false) {
  const log = $('#log');
  if (reset) {
    eventLines = [];
    log.replaceChildren();
    $('#damageFloatLayer').replaceChildren();
    damageAccumulation.clear();
  }
  if (!lines.length) return;
  eventLines.push(...lines);
  for (const line of lines) {
    const row = eventNode(line);
    log.append(row);
    playInterfaceEventSound(line);
    if (!reset) requestAnimationFrame(() => presentCombatEvent(row, line));
  }
  while (log.childElementCount > 220) {
    log.firstElementChild.remove();
    eventLines.shift();
  }
  log.scrollTop = log.scrollHeight;
  lastEventAt = performance.now();
  $('#logLatency').textContent = '即時';
}
function socialNode(entry) {
  const row = document.createElement('div');
  const channel = entry.channel || 'public';
  row.className = `chat-line ${entry.type} ${channel}`;
  row.dataset.chatChannel = channel;
  const time = document.createElement('time');
  time.dateTime = new Date(entry.at).toISOString();
  time.textContent = new Date(entry.at).toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const sender = document.createElement('b');
  sender.textContent = entry.sender;
  const message = document.createElement('span');
  if (entry.type === 'voice') {
    row.classList.add('voice');
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = `/api/social/voice/${encodeURIComponent(entry.voiceId)}`;
    audio.setAttribute('aria-label', `${entry.sender}的語音訊息`);
    const duration = document.createElement('small');
    duration.textContent = `${Math.max(1, Math.round(Number(entry.durationMs) / 1000))} 秒`;
    message.append(audio, duration);
  } else if (entry.type === 'emotion') {
    const emotion = emotionBySource.get(entry.message);
    message.textContent = emotion
      ? `${emotion.symbol} ${emotion.label}`
      : entry.message;
    message.title = entry.message;
  } else {
    message.textContent = entry.message;
  }
  row.append(time, sender, message);
  return row;
}
function pendingChatKey(channel, target, message) {
  return `${channel}\u0000${target || ''}\u0000${message}`;
}
function applyChatFilter() {
  const feed = $('#chatFeed');
  feed.querySelectorAll('.chat-line').forEach((row) => {
    row.hidden =
      currentChatChannel !== 'all' &&
      row.dataset.chatChannel !== currentChatChannel;
  });
  const visible = [...feed.querySelectorAll('.chat-line')].some(
    (row) => !row.hidden,
  );
  feed.querySelector('.chat-empty')?.remove();
  if (!visible) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = `${chatChannelDefs[currentChatChannel].label}尚無訊息`;
    feed.append(empty);
  }
}
function renderSocialDelta(events, reset = false) {
  const feed = $('#chatFeed');
  if (reset) {
    feed.replaceChildren();
    socialEvents = [];
    pendingChatRows.clear();
  }
  if (events.length) feed.querySelector('.chat-empty')?.remove();
  for (const entry of events) {
    socialEvents.push(entry);
    if (entry.sender === currentCharacterName) {
      const key = pendingChatKey(
        entry.channel || 'public',
        entry.target,
        entry.message,
      );
      const pending = pendingChatRows.get(key);
      if (pending) {
        pending.remove();
        pendingChatRows.delete(key);
      }
    }
    feed.append(socialNode(entry));
    if (entry.sender === currentCharacterName)
      $('#chatStatus').textContent =
        entry.type === 'error'
          ? `伺服器拒絕：${entry.message}`
          : '伺服器已確認並回送。';
  }
  while (socialEvents.length > 300) socialEvents.shift();
  while (feed.childElementCount > 120) feed.firstElementChild.remove();
  applyChatFilter();
  if (events.length) feed.scrollTop = feed.scrollHeight;
}
async function pollSocial() {
  if (!authenticated) return;
  const pollStartedAt = performance.now();
  try {
    const query = socialCursor === null ? '' : `?cursor=${socialCursor}`,
      data = await api(`/api/social${query}`);
    socialCursor = data.cursor;
    renderSocialDelta(data.events, data.reset);
  } catch (error) {
    if (!/登入/.test(error.message))
      $('#chatStatus').textContent = '對話重新連線中';
  }
  socialTimer = setTimeout(
    pollSocial,
    Math.max(0, 350 - (performance.now() - pollStartedAt)),
  );
}
function parseFld2(bytes) {
  if (bytes.byteLength < 4) throw new Error('地圖檔標頭不完整');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = view.getUint16(0, true),
    height = view.getUint16(2, true);
  if (!width || !height || bytes.byteLength !== width * height + 4)
    throw new Error('地圖尺寸不符');
  return { width, height, cells: bytes.slice(4) };
}
async function ensureMap(name) {
  if (!name || mapFieldName === name) return;
  mapFieldName = name;
  mapField = null;
  mapFieldError = '';
  try {
    const response = await fetch(
      '/ro/maps/' + encodeURIComponent(name) + '.fld2.bin?v=2',
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error();
    mapField = parseFld2(new Uint8Array(await response.arrayBuffer()));
    minimapTerrain = null;
    minimapTerrainKey = '';
  } catch {
    mapFieldError = '地形檔讀取失敗';
    mapFieldName = '';
  }
}
function sampleMinimapTrack(track, now) {
  if (!track || now >= track.until)
    return { x: track?.toX ?? 0, y: track?.toY ?? 0 };
  const progress = Math.max(
    0,
    Math.min(1, (now - track.since) / (track.until - track.since)),
  );
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: track.fromX + (track.toX - track.fromX) * eased,
    y: track.fromY + (track.toY - track.fromY) * eased,
  };
}
function updateMinimapTrack(key, x, y, now) {
  const previous = minimapTracks.get(key);
  if (!previous) {
    minimapTracks.set(key, {
      fromX: x,
      fromY: y,
      toX: x,
      toY: y,
      since: now,
      until: now,
    });
    return;
  }
  if (previous.toX === x && previous.toY === y) return;
  const current = sampleMinimapTrack(previous, now),
    distance = Math.hypot(x - current.x, y - current.y),
    duration = distance > 6 ? 0 : Math.max(260, Math.min(420, distance * 145));
  minimapTracks.set(key, {
    fromX: duration ? current.x : x,
    fromY: duration ? current.y : y,
    toX: x,
    toY: y,
    since: now,
    until: now + duration,
  });
}
function updateMinimapTargets(live) {
  const now = performance.now(),
    nextKeys = new Set(['self']);
  if (minimapLive?.map && minimapLive.map !== live.map) minimapTracks.clear();
  updateMinimapTrack('self', live.playerX, live.playerY, now);
  for (const monster of live.monsters ?? []) {
    const key = `monster:${monster.id}`;
    nextKeys.add(key);
    updateMinimapTrack(key, monster.x, monster.y, now);
  }
  for (const player of live.players ?? []) {
    const key = `player:${player.id}`;
    nextKeys.add(key);
    updateMinimapTrack(key, player.x, player.y, now);
  }
  for (const key of minimapTracks.keys())
    if (!nextKeys.has(key)) minimapTracks.delete(key);
  minimapLive = live;
  if (lastLiveHp !== null && live.hp < lastLiveHp) damageFlashUntil = now + 180;
  lastLiveHp = live.hp;
  $('#mapPosition').textContent = mapFieldError
    ? `${mapNames[live.map] ?? live.map} · ${mapFieldError}`
    : `${mapNames[live.map] ?? live.map} (${live.playerX}, ${live.playerY}) · 視野怪物 ${(live.monsters ?? []).length}`;
  if (!minimapFrame) minimapFrame = requestAnimationFrame(paintMinimap);
}
function syncMinimapCanvas(canvas) {
  const available = Math.floor(canvas.parentElement.clientWidth - 12);
  if (available < 240) return;
  const width = available,
    ratio = mapField ? mapField.height / mapField.width : 1,
    height = Math.max(240, Math.round(width * ratio));
  canvas.style.height = `${height}px`;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    minimapTerrain = null;
    minimapTerrainKey = '';
  }
}
function terrainLayer(width, height) {
  const key = `${mapFieldName}:${width}:${height}`;
  if (minimapTerrain && minimapTerrainKey === key) return minimapTerrain;
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext('2d'),
    scale = Math.min(width / mapField.width, height / mapField.height),
    ox = (width - mapField.width * scale) / 2,
    oy = (height - mapField.height * scale) / 2;
  ctx.fillStyle = '#050805';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#617365';
  for (let y = 0; y < mapField.height; y++)
    for (let x = 0; x < mapField.width; x++)
      if (mapField.cells[y * mapField.width + x] & 1)
        ctx.fillRect(
          ox + x * scale,
          oy + (mapField.height - 1 - y) * scale,
          Math.max(1, scale + 0.2),
          Math.max(1, scale + 0.2),
        );
  minimapTerrain = layer;
  minimapTerrainKey = key;
  return layer;
}
function paintMinimap(now) {
  minimapFrame = null;
  if (!minimapLive) return;
  if (now - minimapLastPaint < 30) {
    minimapFrame = requestAnimationFrame(paintMinimap);
    return;
  }
  minimapLastPaint = now;
  const live = minimapLive,
    canvas = $('#minimap');
  syncMinimapCanvas(canvas);
  const ctx = canvas.getContext('2d'),
    width = canvas.width,
    height = canvas.height;
  ctx.fillStyle = '#050805';
  ctx.fillRect(0, 0, width, height);
  if (mapField) {
    ctx.drawImage(terrainLayer(width, height), 0, 0);
    const scale = Math.min(width / mapField.width, height / mapField.height),
      ox = (width - mapField.width * scale) / 2,
      oy = (height - mapField.height * scale) / 2;
    const point = (x, y, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        ox + x * scale,
        oy + (mapField.height - 1 - y) * scale,
        size / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    };
    for (const monster of live.monsters ?? []) {
      const position = sampleMinimapTrack(
        minimapTracks.get(`monster:${monster.id}`),
        now,
      );
      point(
        position.x,
        position.y,
        monster.engaged ? 6 : 4,
        monster.engaged ? '#ff4f62' : '#f4a7d2',
      );
    }
    for (const player of live.players ?? []) {
      const position = sampleMinimapTrack(
        minimapTracks.get(`player:${player.id}`),
        now,
      );
      point(position.x, position.y, 5, '#70b8ff');
    }
    const self = sampleMinimapTrack(minimapTracks.get('self'), now);
    point(
      self.x,
      self.y,
      performance.now() < damageFlashUntil ? 9 : 6,
      performance.now() < damageFlashUntil ? '#ff354a' : '#50ffb1',
    );
  }
  const moving = [...minimapTracks.values()].some((track) => now < track.until);
  if (moving || now < damageFlashUntil)
    minimapFrame = requestAnimationFrame(paintMinimap);
}
window.addEventListener('resize', () => {
  minimapTerrain = null;
  minimapTerrainKey = '';
  if (minimapLive && !minimapFrame)
    minimapFrame = requestAnimationFrame(paintMinimap);
});
function renderMinimap(live) {
  if (!live) return;
  ensureMap(live.map);
  updateMinimapTargets(live);
}
async function pollEvents() {
  if (!authenticated) return;
  const pollStartedAt = performance.now();
  try {
    const query = eventCursor === null ? '' : '?cursor=' + eventCursor,
      data = await api('/api/events' + query);
    eventCursor = data.cursor;
    renderEventDelta(data.lines, data.reset);
    renderMinimap(data.live);
    if (data.live && lastState?.character) {
      lastState = { ...lastState, derived: data.live };
      setCharacterHeader(lastState.character, data.live);
      renderJobChange(lastState.character, data.live);
      renderTaskActionLog(data.live);
    }
  } catch (error) {
    if (/登入/.test(error.message)) return;
    $('#logLatency').textContent = '重新連線中';
  }
  eventTimer = setTimeout(
    pollEvents,
    Math.max(0, 150 - (performance.now() - pollStartedAt)),
  );
}

function setCharacterHeader(c, derived) {
  const liveBaseLevel = Number(derived?.baseLevel),
    liveJobLevel = Number(derived?.jobLevel),
    classId = Number(derived?.jobId ?? c.classId),
    baseLevel =
      liveBaseLevel > 0 ? liveBaseLevel : Math.max(1, Number(c.baseLevel) || 1),
    jobLevel =
      liveJobLevel > 0 ? liveJobLevel : Math.max(1, Number(c.jobLevel) || 1),
    baseExp = Number(derived?.baseExp ?? c.baseExp),
    jobExp = Number(derived?.jobExp ?? c.jobExp),
    baseExpMax = Number(derived?.baseExpMax ?? 0),
    jobExpMax = Number(derived?.jobExpMax ?? 0),
    hp = Number(derived?.hp ?? c.hp),
    maxHp = Number(derived?.maxHp ?? c.maxHp),
    sp = Number(derived?.sp ?? c.sp),
    maxSp = Number(derived?.maxSp ?? c.maxSp),
    zeny = Number(derived?.zeny ?? c.zeny),
    map = derived?.map || c.map,
    x = Number(derived?.playerX ?? c.x),
    y = Number(derived?.playerY ?? c.y),
    job = jobNames[classId] ?? `職業 ${classId}`;
  $('#name').textContent = c.name;
  $('#jobName').textContent = job;
  $('#base').textContent = baseLevel;
  $('#jobLevel').textContent = jobLevel;
  $('#baseExp').textContent = expProgressText(baseExp, baseExpMax);
  $('#jobExp').textContent = expProgressText(jobExp, jobExpMax);
  $('#baseExp').title = expProgressDetail(baseExp, baseExpMax);
  $('#jobExp').title = expProgressDetail(jobExp, jobExpMax);
  $('#hpText').textContent = `${hp} / ${maxHp}`;
  $('#spText').textContent = `${sp} / ${maxSp}`;
  $('#hpBar').style.width = pct(hp, maxHp);
  $('#spBar').style.width = pct(sp, maxSp);
  $('#baseBar').style.width = pct(baseExp, baseExpMax);
  $('#jobBar').style.width = pct(jobExp, jobExpMax);
  $('#weight').textContent =
    String(derived?.weight ?? 0) + ' / ' + String(derived?.maxWeight ?? 0);
  $('#zeny').textContent = zeny.toLocaleString();
  $('#location').textContent = `${mapNames[map] ?? map} (${x}, ${y})`;
}

function expProgressText(current, required) {
  if (!(required > 0)) return `${current.toLocaleString()} EXP · 同步中`;
  const progress = Math.min(100, Math.max(0, (current / required) * 100));
  return `${current.toLocaleString()} / ${required.toLocaleString()} EXP · ${progress.toFixed(1)}%`;
}
function expProgressDetail(current, required) {
  if (!(required > 0)) return '需求經驗同步中';
  const progress = Math.min(100, Math.max(0, (current / required) * 100));
  const remaining = Math.max(0, required - current);
  return `${current.toLocaleString()} / ${required.toLocaleString()} EXP · ${progress.toFixed(2)}% · 尚差 ${remaining.toLocaleString()}`;
}

function setCharacter(c, derived) {
  if (!c) return;
  currentCharacterName = c.name;
  setCharacterHeader(c, derived);
  const availableStatusPoints = derived?.statusPoint ?? c.statusPoint;
  $('#points').textContent = `Status Point ${availableStatusPoints}`;
  const labels = {
      str: 'Str',
      agi: 'Agi',
      vit: 'Vit',
      int: 'Int',
      dex: 'Dex',
      luk: 'Luk',
    },
    bonuses = {
      str: derived?.strBonus,
      agi: derived?.agiBonus,
      vit: derived?.vitBonus,
      int: derived?.intBonus,
      dex: derived?.dexBonus,
      luk: derived?.lukBonus,
    };
  $('#stats').replaceChildren(
    ...Object.entries(labels).map(([key, label]) => {
      const baseValue = derived?.[key] ?? c[key],
        cost = statCost(baseValue),
        bonus = bonuses[key],
        row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('b');
      value.textContent = `${baseValue}${bonus ? ` + ${bonus}` : ''}`;
      const requirement = document.createElement('small');
      requirement.textContent = `需要 ${cost}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.stat = key;
      button.disabled = availableStatusPoints < cost;
      button.textContent = '＋';
      row.append(name, value, requirement, button);
      return row;
    }),
  );
  const details = derived
    ? [
        ['Atk', `${derived.attack} + ${derived.attackBonus}`],
        ['Def', `${derived.def} + ${derived.defBonus}`],
        ['Matk', `${derived.matkMin} ~ ${derived.matkMax}`],
        ['Mdef', `${derived.mdef} + ${derived.mdefBonus}`],
        ['Hit', derived.hit],
        ['Flee', `${derived.flee} + ${derived.fleeBonus}`],
        ['Critical', derived.critical],
        ['Aspd', derived.aspd],
      ]
    : null;
  $('#derivedStats').replaceChildren(
    ...(
      details ?? [
        ['Atk', '等待角色封包'],
        ['Def', '等待角色封包'],
        ['Matk', '等待角色封包'],
        ['Mdef', '等待角色封包'],
        ['Hit', '等待角色封包'],
        ['Flee', '等待角色封包'],
        ['Critical', '等待角色封包'],
        ['Aspd', '等待角色封包'],
      ]
    ).map(([label, value]) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = label;
      const amount = document.createElement('b');
      amount.textContent = value;
      row.append(name, amount);
      return row;
    }),
  );
  $('#skillPoints').textContent =
    `Skill Point ${derived?.skillPoint ?? c.skillPoint}`;
  renderSkillTree(c, derived);
  renderJobChange(c, derived);
}

const skillResourceLabels = Object.freeze({
  Bow: '弓',
  Arrow: '箭矢',
  Bullet: '子彈',
  Shuriken: '飛鏢',
  Cannonball: '砲彈',
});
const skillAmmoItemTypes = Object.freeze({
  Arrow: 10,
  Bullet: 16,
  Shuriken: 17,
  Cannonball: 19,
});
function skillResourceState(skill, level, derived) {
  const resources = skill.resources ?? {},
    spCost = Number(resources.spCostByLevel?.[level - 1] ?? 0),
    zenyCost = Number(resources.zenyCostByLevel?.[level - 1] ?? 0),
    weapons = Array.isArray(resources.weapons) ? resources.weapons : [],
    ammo = Array.isArray(resources.ammo) ? resources.ammo : [],
    ammoAmount = Math.max(0, Number(resources.ammoAmount) || 0),
    inventory = Array.isArray(derived?.inventory) ? derived.inventory : [],
    equippedWeaponTypes = new Set(
      inventory
        .filter((item) => item.equipped)
        .map((item) => String(item.weaponType ?? '')),
    ),
    weaponReady =
      !weapons.length ||
      weapons.some((weapon) => equippedWeaponTypes.has(weapon)),
    ammoTypes = ammo
      .map((name) => skillAmmoItemTypes[name])
      .filter(Number.isInteger),
    ammoReady =
      !ammo.length ||
      inventory.some(
        (item) =>
          item.equipped &&
          ammoTypes.includes(Number(item.itemType)) &&
          Number(item.amount) >= ammoAmount,
      ),
    zenyReady = !zenyCost || Number(derived?.zeny ?? 0) >= zenyCost,
    parts = [];
  if (spCost) parts.push(`SP ${spCost}`);
  if (zenyCost)
    parts.push(`Zeny ${zenyCost}${zenyReady ? '' : '（目前不足）'}`);
  if (weapons.length)
    parts.push(
      `裝備 ${weapons.map((name) => skillResourceLabels[name] ?? name).join('／')}${weaponReady ? '' : '（未裝備）'}`,
    );
  if (ammo.length)
    parts.push(
      `已裝備 ${ammo.map((name) => skillResourceLabels[name] ?? name).join('／')} × ${ammoAmount}${ammoReady ? '' : '（目前不足）'}`,
    );
  return {
    text: parts.join(' · '),
    ready: zenyReady && weaponReady && ammoReady,
  };
}

function renderSkillTree(character, derived) {
  // The live character packet is authoritative after a job change. The SQL-backed
  // character snapshot can trail it briefly and must not render the old tree.
  const classId = Number(derived?.jobId ?? character?.classId ?? 0);
  const job = skillTreeData?.jobs?.[String(classId)];
  if (!job) return;
  const liveSkills = new Map(
      (derived?.skills ?? []).map((skill) => [skill.handle, skill]),
    ),
    availablePoints = Number(derived?.skillPoint ?? character?.skillPoint ?? 0);
  const signature = JSON.stringify({
    classId,
    availablePoints,
    skills: job.skills.map((skill) => {
      const live = liveSkills.get(skill.handle),
        level = Number(
          live?.level ??
            (skill.handle === 'NV_BASIC' ? derived?.basicSkillLevel : 0) ??
            0,
        ),
        resourceState = skillResourceState(skill, level, derived),
        slotKey =
          skill.automationMode === 'selfRecovery'
            ? 'self'
            : skill.automationMode === 'selfBuff'
              ? 'buff'
              : 'attack',
        active = derived?.skillAutomation?.[slotKey];
      return [
        skill.handle,
        level,
        Number(
          live?.upgradable ??
            (skill.handle === 'NV_BASIC' ? derived?.basicSkillUpgradable : 0) ??
            0,
        ),
        active?.handle === skill.handle
          ? [active.level, active.minimumSp, active.hpBelow]
          : null,
        resourceState.text,
        resourceState.ready,
      ];
    }),
  });
  if (signature === lastSkillTreeSignature) return;
  lastSkillTreeSignature = signature;
  $('#skillList').replaceChildren(
    ...job.skills.map((skill) => {
      const live = liveSkills.get(skill.handle),
        level = Number(
          live?.level ??
            (skill.handle === 'NV_BASIC' ? derived?.basicSkillLevel : 0) ??
            0,
        ),
        upgradable = Number(
          live?.upgradable ??
            (skill.handle === 'NV_BASIC' ? derived?.basicSkillUpgradable : 0) ??
            0,
        ),
        entry = document.createElement('div');
      entry.className = 'skill-entry';
      const information = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = skill.name;
      const meta = document.createElement('small');
      const requirements = skill.requires
        .map((requirement) => `${requirement.name} Lv.${requirement.level}`)
        .join('、');
      meta.textContent = `${skill.handle} · 最高 Lv.${skill.maxLevel}${requirements ? ` · 前置 ${requirements}` : ''}`;
      const description = document.createElement('details');
      description.className = 'skill-description';
      description.open = openSkillDescriptions.has(skill.handle);
      description.addEventListener('toggle', () => {
        if (description.open) openSkillDescriptions.add(skill.handle);
        else openSkillDescriptions.delete(skill.handle);
      });
      const summary = document.createElement('summary');
      summary.textContent = '技能說明';
      const text = document.createElement('p');
      text.textContent = skill.description || '目前沒有此技能說明。';
      description.append(summary, text);
      information.append(name, meta, description);
      if (skill.targetType === 'Passive' && level > 0) {
        const passive = document.createElement('span');
        passive.className = 'skill-passive-state';
        passive.textContent =
          skill.handle === 'TF_DOUBLE'
            ? '被動技能 · 觸發時會在戰鬥 Log 顯示'
            : '被動技能 · 常駐生效';
        information.append(passive);
      }
      const current = document.createElement('strong');
      current.textContent = `Lv.${level}`;
      current.dataset.skillLevel = skill.id;
      if (skill.handle === 'NV_BASIC') current.id = 'basicSkillLevel';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.skillId = skill.id;
      button.disabled =
        !skill.id ||
        availablePoints < 1 ||
        upgradable !== 1 ||
        level >= skill.maxLevel;
      button.textContent = '＋';
      button.title = button.disabled ? '目前無法提升' : `提升${skill.name}`;
      if (skill.handle === 'NV_BASIC') button.id = 'addBasicSkill';
      entry.append(information, current, button);
      if (level > 0 && skill.automationMode) {
        const mode =
            skill.automationMode === 'selfRecovery'
              ? 'selfRecovery'
              : skill.automationMode === 'selfBuff'
                ? 'selfBuff'
                : 'attack',
          slotKey =
            mode === 'attack'
              ? 'attack'
              : mode === 'selfRecovery'
                ? 'self'
                : 'buff',
          active = derived?.skillAutomation?.[slotKey],
          selected = active?.handle === skill.handle,
          automation = document.createElement('div'),
          resourceState = skillResourceState(skill, level, derived);
        automation.className = 'skill-automation';
        automation.dataset.skillAutomationRow = skill.handle;
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'skill-automation-toggle';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = selected;
        toggle.disabled = !selected && !resourceState.ready;
        toggle.dataset.skillAuto = mode;
        toggle.dataset.autoSkillId = skill.id;
        toggle.dataset.skillHandle = skill.handle;
        const toggleText = document.createElement('span');
        toggleText.textContent =
          mode === 'selfRecovery'
            ? '自動恢復'
            : mode === 'selfBuff'
              ? '自動維持'
              : skill.automationMode === 'attackSelf'
                ? '自動範圍攻擊'
                : '自動攻擊';
        toggleLabel.append(toggle, toggleText);
        const spLabel = document.createElement('label');
        spLabel.textContent = '最低 SP ';
        const spSelect = document.createElement('select');
        spSelect.dataset.skillAuto = mode;
        spSelect.dataset.autoSkillId = skill.id;
        spSelect.dataset.skillHandle = skill.handle;
        spSelect.dataset.skillAutoSetting = 'minimumSp';
        for (const value of [10, 20, 30, 40, 50]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = `${value}%`;
          spSelect.append(option);
        }
        spSelect.value = String(selected ? active.minimumSp || 20 : 20);
        spLabel.append(spSelect);
        automation.append(toggleLabel, spLabel);
        if (mode === 'selfRecovery') {
          const hpLabel = document.createElement('label');
          hpLabel.textContent = 'HP 低於 ';
          const hpSelect = document.createElement('select');
          hpSelect.dataset.skillAuto = mode;
          hpSelect.dataset.autoSkillId = skill.id;
          hpSelect.dataset.skillHandle = skill.handle;
          hpSelect.dataset.skillAutoSetting = 'hpBelow';
          for (const value of [40, 50, 60, 70, 80, 90]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${value}%`;
            hpSelect.append(option);
          }
          hpSelect.value = String(selected ? active.hpBelow || 70 : 70);
          hpLabel.append(hpSelect);
          automation.append(hpLabel);
        }
        const levelNote = document.createElement('small');
        levelNote.textContent = `使用目前技能 Lv.${level}`;
        automation.append(levelNote);
        if (resourceState.text) {
          const resourceNote = document.createElement('small');
          resourceNote.className = `skill-resource-requirement${resourceState.ready ? '' : ' unmet'}`;
          resourceNote.dataset.skillResource = skill.handle;
          resourceNote.textContent = `每次施放：${resourceState.text}`;
          automation.append(resourceNote);
        }
        entry.append(automation);
      }
      return entry;
    }),
  );
}

async function loadSkillTrees() {
  if (!skillTreeData) {
    const response = await fetch('/ro/data/skill-trees.json', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('技能資料讀取失敗');
    skillTreeData = await response.json();
    lastSkillTreeSignature = '';
  }
  renderSkillTree(lastState?.character, lastState?.derived);
}

function renderJobChange(character, live) {
  if (!character) return;
  const classId = Number(live?.jobId ?? character.classId ?? 0),
    basicLevel = Number(live?.basicSkillLevel ?? 0),
    eligible =
      classId === 0 && Number(character.jobLevel) >= 10 && basicLevel >= 9,
    route = live?.jobRoute,
    dialog = live?.npcDialog,
    routeJob = route ? firstJobs[route.job] : null,
    targetJob = character.targetJob || null;
  $('#jobChangeState').textContent =
    classId !== 0
      ? `已轉職：${jobNames[classId] ?? `職業 ${classId}`}`
      : eligible
        ? '可以轉職'
        : '尚未符合資格';
  $('#jobEligibility').textContent =
    classId !== 0
      ? `角色已完成一轉，Job Lv.${character.jobLevel}。`
      : `${targetJob ? `創角志願：${firstJobs[targetJob]?.name ?? targetJob}。` : '舊角色請先選擇一轉志願。'} 一轉資格：初心者 Job Lv.10、基本技能 Lv.9。目前為 Job Lv.${character.jobLevel}、基本技能 Lv.${basicLevel}。`;
  document.querySelectorAll('[data-job-route]').forEach((button) => {
    show(button, !targetJob || button.dataset.jobRoute === targetJob);
    button.disabled = !eligible || Boolean(route);
  });
  show($('#firstJobChoices'), classId === 0);
  show($('#jobRoutePanel'), Boolean(route));
  if (route) {
    $('#jobRouteStatus').textContent = route.arrived
      ? `已抵達${routeJob?.destination ?? route.map}，可向學院結業導師完成${routeJob?.name ?? ''}一轉。`
      : `前往${routeJob?.destination ?? route.map}：${routeJob?.transport ?? '步行'}，目前 ${mapNames[live.map] ?? live.map} (${live.playerX}, ${live.playerY})。`;
    $('#jobTalk').disabled = !route.arrived || Boolean(dialog?.active);
    $('#jobTalk').dataset.job = route.job;
  }
  show($('#npcDialog'), Boolean(dialog?.active));
  if (!dialog?.active) return;
  $('#npcName').textContent = '克里圖拉學院結業導師';
  $('#npcMessage').textContent = dialog.message || 'NPC 對話讀取中';
  const actions = [];
  if (dialog.stage === 'select') {
    for (const [index, response] of (dialog.responses ?? []).entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.npcChoice = index + 1;
      button.textContent = response;
      actions.push(button);
    }
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.npcAction = dialog.stage === 'next' ? 'next' : 'close';
    button.textContent = dialog.stage === 'next' ? '下一步' : '關閉';
    button.className = `official-skin-button ${
      dialog.stage === 'next' ? 'official-next' : 'official-close'
    }`;
    actions.push(button);
  }
  $('#npcActions').replaceChildren(...actions);
}

async function jobChangeAction(body, pendingText) {
  $('#jobChangeNotice').textContent = pendingText;
  try {
    await api('/api/job-change', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    $('#jobChangeNotice').textContent = '指令已接受，等待遊戲伺服器確認。';
  } catch (error) {
    $('#jobChangeNotice').textContent = error.message;
  }
}
function setEquipment(c, items = []) {
  if (!c) return;
  const job = jobNames[c.classId] ?? `職業 ${c.classId}`;
  $('#paperdollBody').src = paperdollAsset(c.sex, c.hair);
  $('#paperdollName').textContent = c.name;
  $('#appearanceMeta').textContent =
    `${job} · ${c.sex === 'F' ? '女性' : '男性'}`;
  $('#paperdollDetails').textContent = `髮型 ${c.hair} · 髮色 ${c.hairColor}`;
  document.querySelectorAll('.equip-slot').forEach((slot) => {
    slot.classList.remove('equipped');
    delete slot.dataset.binId;
    delete slot.dataset.itemKey;
    delete slot.dataset.action;
    delete slot.dataset.category;
    slot.querySelector('b').textContent = '未裝備';
    slot.querySelector('img')?.remove();
  });
  for (const item of items) {
    const slot = document.querySelector(
      `.equip-slot[data-slot="${item.slot}"]`,
    );
    if (!slot) continue;
    slot.classList.add('equipped');
    const live = inventoryItems.find((candidate) =>
      Number.isInteger(item.binId)
        ? candidate.binId === item.binId
        : candidate.itemId === item.itemId && candidate.equipped,
    );
    if (Number.isInteger(live?.binId)) {
      slot.dataset.binId = live.binId;
      slot.dataset.itemKey = live.itemKey ?? '';
      slot.dataset.action = 'unequip';
      slot.dataset.category = 'equipment';
      slot.title = '雙擊卸下';
    }
    slot.querySelector('b').textContent =
      `${item.refine > 0 ? `+${item.refine} ` : ''}${item.name}`;
    if (item.aegisName) {
      const icon = document.createElement('img');
      icon.src = `/ro/client/items/${item.aegisName}.png`;
      icon.alt = item.name;
      slot.prepend(icon);
    }
  }
}
function setServices(s) {
  const node = document.createElement('div');
  node.className = `service ${s.online ? 'ok' : ''}`;
  const indicator = document.createElement('i');
  const label = document.createElement('b');
  label.textContent = '世界伺服器';
  const status = document.createElement('small');
  status.textContent = s.online ? ' 正常' : ' 無法連線';
  node.append(indicator, label, status);
  $('#services').replaceChildren(node);
  const ok = Boolean(s.online);
  $('#worldLamp').className = `lamp ${ok ? 'online' : ''}`;
  $('#worldLamp').textContent = ok ? '世界伺服器正常' : '服務異常';
  $('#onlinePlayers').textContent = `${s.onlinePlayers ?? 0} 人在線`;
}
function setLoot(items) {
  $('#itemKinds').textContent = items.length;
  $('#lootTotal').textContent =
    `${items.reduce((sum, item) => sum + item.amount, 0)} 件`;
  $('#lootSummary').replaceChildren(
    ...(items.length ? items : [{ name: '尚未撿取物品', amount: '' }]).map(
      (item) => {
        const node = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = names[item.name] ?? item.name;
        const amount = document.createElement('b');
        amount.textContent = item.amount ? `× ${item.amount}` : '';
        node.append(name, amount);
        return node;
      },
    ),
  );
}
const supplyRuleLabels = Object.freeze({
  default: '系統預設',
  ignore: '不拾取',
  discard: '撿到即丟',
  sell: '回城販售',
  store: '存入倉庫',
  keep: '保留身上',
});
const supplyStageLabels = Object.freeze({
  storageAuto: '卡普拉存倉中',
  sellAuto: '販售戰利品中',
  buyAuto: '購買補給品中',
  mapRoute: '前往補給地點',
  route: '移動中',
});
function setSupplyCycle(settings, live, inventory = []) {
  supplyCycleSettings = settings;
  const runtime = live?.supplyCycle,
    enabled = Boolean(settings?.enabled),
    stage = runtime?.stage;
  $('#supplyStage').textContent = enabled
    ? (supplyStageLabels[stage] ?? '掛機循環待命')
    : '尚未啟用';
  const editing = $('#supplyForm').contains(document.activeElement);
  if (!editing) {
    $('#supplyEnabled').checked = enabled;
    $('#supplyWeight').value = String(settings?.returnWeight ?? 68);
    $('#supplyStore').checked = settings?.store !== false;
    $('#supplySell').checked = settings?.sell !== false;
    $('#supplyBuy').checked = settings?.buy !== false;
    $('#redPotionMin').value = String(settings?.redPotionMin ?? 20);
    $('#redPotionMax').value = String(settings?.redPotionMax ?? 100);
  }
  const ruleMap = new Map(
      (settings?.rules ?? []).map((rule) => [Number(rule.itemId), rule.action]),
    ),
    items = inventory
      .filter((item) => Number(item.itemId) > 0 && !item.equipped)
      .filter(
        (item, index, list) =>
          list.findIndex(
            (candidate) => Number(candidate.itemId) === Number(item.itemId),
          ) === index,
      )
      .sort((a, b) =>
        (names[a.name] ?? a.name).localeCompare(
          names[b.name] ?? b.name,
          'zh-Hant',
        ),
      ),
    signature = JSON.stringify([
      items.map((item) => [item.itemId, item.name]),
      [...ruleMap],
    ]);
  if (signature === supplyRuleSignature || editing) return;
  supplyRuleSignature = signature;
  $('#supplyRuleList').replaceChildren(
    ...(items.length
      ? items
      : [{ itemId: 0, name: '背包目前沒有可設定道具' }]
    ).map((item) => {
      if (!item.itemId) {
        const empty = document.createElement('p');
        empty.textContent = item.name;
        return empty;
      }
      const row = document.createElement('label');
      row.className = 'supply-rule-row';
      const label = document.createElement('span');
      label.textContent = `${names[item.name] ?? item.name} #${item.itemId}`;
      const select = document.createElement('select');
      select.dataset.supplyItemId = item.itemId;
      for (const [value, text] of Object.entries(supplyRuleLabels)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.append(option);
      }
      select.value = ruleMap.get(Number(item.itemId)) ?? 'default';
      row.append(label, select);
      return row;
    }),
  );
}
function percentage(rate) {
  const value = Number(rate) / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}
function renderMapInfo(mapId = 'prt_fild08') {
  const map =
    mapInfoData?.maps?.[mapId] ?? Object.values(mapInfoData?.maps ?? {})[0];
  if (!map) {
    $('#mapInfoTotal').textContent = '無資料';
    $('#mapMonsterList').replaceChildren();
    return;
  }
  $('#mapInfoTitle').textContent = map.name;
  $('#mapInfoTotal').textContent =
    `${map.monsters.length} 種／${map.totalMonsters} 隻`;
  $('#mapInfoSource').textContent =
    '怪物、重生、掉落與物品說明均採用遊戲伺服器資料';
  $('#mapMonsterList').replaceChildren(
    ...map.monsters.map((monster) => {
      const details = document.createElement('details');
      details.className = 'monster-entry';
      const monsterDisclosureKey = `${map.id}:${monster.id}`;
      details.open = openMapMonsters.has(monsterDisclosureKey);
      details.addEventListener('toggle', () => {
        if (details.open) openMapMonsters.add(monsterDisclosureKey);
        else openMapMonsters.delete(monsterDisclosureKey);
      });
      const summary = document.createElement('summary');
      const name = document.createElement('b');
      name.textContent = monster.name;
      const level = document.createElement('small');
      level.textContent = `Lv.${monster.level}`;
      const count = document.createElement('span');
      count.textContent = `${monster.count} 隻`;
      summary.append(name, level, count);
      const stats = document.createElement('div');
      stats.className = 'monster-stats';
      for (const [label, value] of [
        ['HP', monster.hp.toLocaleString()],
        ['屬性', monster.element],
        ['體型', monster.size],
        ['種族', monster.race],
        ['人物 EXP', monster.baseExp.toLocaleString()],
        ['職業 EXP', monster.jobExp.toLocaleString()],
        ['ATK', `${monster.attackMin}～${monster.attackMax}`],
        [
          '重生',
          monster.respawnMinMs === monster.respawnMaxMs
            ? `${monster.respawnMinMs / 1000} 秒`
            : `${monster.respawnMinMs / 1000}～${monster.respawnMaxMs / 1000} 秒`,
        ],
      ]) {
        const cell = document.createElement('span');
        cell.textContent = `${label}：${value}`;
        stats.append(cell);
      }
      const drops = document.createElement('div');
      drops.className = 'monster-drops';
      for (const drop of monster.drops) {
        const dropDetails = document.createElement('details');
        dropDetails.className = 'drop-entry';
        const dropDisclosureKey = `${monsterDisclosureKey}:${drop.itemId ?? drop.aegisName}`;
        dropDetails.open = openMapDrops.has(dropDisclosureKey);
        dropDetails.addEventListener('toggle', () => {
          if (dropDetails.open) openMapDrops.add(dropDisclosureKey);
          else openMapDrops.delete(dropDisclosureKey);
        });
        const dropSummary = document.createElement('summary');
        const icon = document.createElement('img');
        icon.src = `/ro/client/items/${drop.aegisName}.png`;
        icon.alt = drop.name;
        icon.onerror = () => icon.remove();
        const dropName = document.createElement('b');
        dropName.textContent = drop.name;
        const rate = document.createElement('span');
        rate.className = 'drop-rate';
        rate.textContent = percentage(drop.ratePerTenThousand);
        dropSummary.append(icon, dropName, rate);
        const description = document.createElement('div');
        description.className = 'drop-description';
        const copy = document.createElement('p');
        copy.textContent = drop.description;
        const meta = document.createElement('small');
        meta.textContent = `${drop.type}　重量 ${drop.weight}${drop.attack ? `　ATK ${drop.attack}` : ''}${drop.defense ? `　DEF ${drop.defense}` : ''}${drop.slots ? `　插槽 ${drop.slots}` : ''}`;
        description.append(copy, meta);
        dropDetails.append(dropSummary, description);
        drops.append(dropDetails);
      }
      details.append(summary, stats, drops);
      return details;
    }),
  );
}
async function loadMapInfo() {
  if (!mapInfoData) {
    const response = await fetch('/ro/data/map-info.json', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('地圖情報讀取失敗');
    mapInfoData = await response.json();
  }
  renderMapInfo(lastState?.character?.map);
}
function renderInventoryList(target, category) {
  const filtered = inventoryItems.filter((item) => item.category === category);
  target.replaceChildren(
    ...(filtered.length
      ? filtered
      : [{ empty: true, name: '此分類目前沒有道具' }]
    ).map((item) => {
      const node = document.createElement('div');
      if (item.empty) {
        node.className = 'inventory-empty';
        node.textContent = item.name;
        return node;
      }
      node.className = 'inventory-item';
      node.dataset.binId = item.binId ?? '';
      node.dataset.itemKey = item.itemKey ?? '';
      node.dataset.category = item.category;
      node.dataset.blockedReason = item.equipRestriction || '';
      node.dataset.action =
        item.category === 'card'
          ? 'card'
          : item.category === 'equipment'
            ? item.equipped
              ? 'unequip'
              : 'equip'
            : 'use';
      node.title =
        item.binId === null
          ? '等待角色資料同步'
          : item.category === 'equipment'
            ? item.equipped
              ? '雙擊卸下'
              : item.canEquip === false
                ? item.equipRestriction || '此裝備目前無法穿上'
                : '雙擊裝備'
            : item.usable
              ? '雙擊使用'
              : '此物品不可使用';
      if (item.aegisName) {
        const icon = document.createElement('img');
        icon.src = `/ro/client/items/${item.aegisName}.png`;
        icon.alt = item.name;
        node.append(icon);
      }
      const text = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = `${item.refine ? `+${item.refine} ` : ''}${item.name}`;
      const amount = document.createElement('small');
      amount.textContent = item.equipRestriction
        ? `${item.equipRestriction} · 持有 × ${item.amount}`
        : `${item.equipped ? '裝備中' : '持有'} × ${item.amount}`;
      text.append(name, amount);
      node.append(text);
      return node;
    }),
  );
}
function renderInventory() {
  renderInventoryList($('#inventoryList'), inventoryCategory);
  renderInventoryList($('#equipmentInventoryList'), 'equipment');
}
function setInventory(items = []) {
  inventoryItems = items;
  $('#inventoryTotal').textContent = `${items.length} 種`;
  renderInventory();
}
const questStatusNames = Object.freeze({
  complete: '完成',
  active: '進行中',
  available: '可進行',
  locked: '未開始',
});
function renderTaskActionLog(live) {
  const detail = $('#questDetail');
  if (!detail) return;
  const events = Array.isArray(live?.taskEvents) ? live.taskEvents : [];
  const missions = Array.isArray(live?.questMissions) ? live.questMissions : [];
  const rows = [];
  if (missions.length) {
    for (const mission of missions) {
      const row = document.createElement('div');
      row.className = 'task-log-entry battle event';
      const name = mission.mobName || `怪物 ${mission.mobId}`;
      const time = document.createElement('time');
      const message = document.createElement('span');
      time.textContent = new Date().toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      message.textContent = `[戰鬥需求] ${name}：${Number(mission.count).toLocaleString()} / ${Number(mission.goal).toLocaleString()} 隻`;
      row.append(time, message);
      rows.push(row);
    }
  }
  const typeLabels = {
    action: '任務',
    battle: '戰鬥',
    dialog: 'NPC',
    map: '移動',
    recovery: '修正',
  };
  for (const event of events.slice(-40)) {
    const row = document.createElement('div');
    const type = event.type || 'info';
    row.className = `task-log-entry ${type} event`;
    const time = document.createElement('time');
    const message = document.createElement('span');
    time.textContent = new Date(
      Number(event.at) || Date.now(),
    ).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const meta = [
      event.target ? `目標：${event.target}` : '',
      event.map ? `地圖：${mapNames[event.map] ?? event.map}` : '',
    ]
      .filter(Boolean)
      .join('　');
    message.textContent = [
      `[${typeLabels[type] ?? '任務'}] ${event.title || '任務更新'}`,
      event.detail || '',
      meta,
    ]
      .filter(Boolean)
      .join('　');
    row.append(time, message);
    rows.push(row);
  }
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'task-log-empty';
    empty.textContent =
      '啟動自動新手任務後，這裡會顯示移動、NPC 對話與任務需求。';
    rows.push(empty);
  }
  detail.replaceChildren(...rows);
  detail.scrollTop = detail.scrollHeight;
}
function renderOnboarding(onboarding, character, running, live) {
  const quests = onboarding?.quests ?? [];
  const complete = Boolean(onboarding?.complete);
  const migratedFirstJob = Number(character?.classId) > 0 && !complete;
  const currentIndex = Math.max(0, Number(onboarding?.currentIndex) || 0);
  const currentQuest = quests[currentIndex];
  $('#questSummary').textContent = complete
    ? '新生訓練完成'
    : migratedFirstJob
      ? '一轉完成，任務未記錄'
      : 'Renewal 新生訓練';
  $('#questNotice').textContent = complete
    ? character?.map === 'prt_fild08'
      ? '已抵達普隆德拉原野 08 並開始掛機。後續會依角色等級提供推薦地圖。'
      : '一轉已完成，正在前往普隆德拉原野 08。'
    : migratedFirstJob
      ? '此角色已完成一轉，新手任務已標記完成。'
      : `目前位置：${mapNames[character?.map] ?? character?.map ?? '同步中'}。雙擊未完成任務即可從目前進度繼續。`;
  if (!quests.length) {
    const empty = document.createElement('p');
    empty.textContent = '正在讀取任務資料';
    $('#questList').replaceChildren(empty);
    return;
  }
  const entries = quests.map((quest, index) => {
    const button = document.createElement('button');
    const title = document.createElement('span');
    const status = document.createElement('small');
    button.type = 'button';
    button.className = `quest-entry ${quest.status}`;
    button.setAttribute('role', 'listitem');
    title.textContent = quest.title;
    status.textContent = questStatusNames[quest.status] ?? '未開始';
    button.append(title, status);
    button.onclick = () => {
      document
        .querySelectorAll('.quest-entry')
        .forEach((entry) =>
          entry.classList.toggle('selected', entry === button),
        );
    };
    button.ondblclick = () => {
      if (quest.status === 'complete' || migratedFirstJob) return;
      resumeOnboarding(quest.id);
    };
    if (index === currentIndex) button.classList.add('selected');
    return button;
  });
  $('#questList').replaceChildren(...entries);
  renderTaskActionLog(live);
}
function renderEden(eden, character) {
  const journey = eden?.journey,
    member = Boolean(eden?.member || journey?.member),
    active = Boolean(journey?.active),
    eligible =
      Number(character?.classId) >= 1 && Number(character?.classId) <= 6;
  $('#edenSummary').textContent = active
    ? '自動入團中'
    : member
      ? `成員・訓練進度 ${Number(eden?.trainingStage ?? 0)}`
      : eligible
        ? '可加入'
        : '一轉後開放';
  const phaseNotices = {
    route_officer: '正在前往普隆德拉的伊甸園傳送員。',
    enter_headquarters: '正在使用原生伊甸園傳送服務。',
    route_secretary: '已進入伊甸園總部，正在尋找秘書 Lime Evenor。',
    register_member: '正在填寫伊甸園成員資料並領取徽章。',
    returning_hunt: '已取得伊甸園徽章，正在返回普隆德拉原野 08。',
    complete: '入團已完成，角色已返回普隆德拉原野 08 並恢復掛機。',
  };
  $('#edenNotice').textContent =
    active || journey?.completed
      ? (phaseNotices[journey?.phase] ?? '正在同步伊甸園任務狀態。')
      : member
        ? `已取得伊甸園徽章。Base Lv.${Number(character?.baseLevel ?? 0)} 可依序進行 Lv.12、26、40 裝備訓練。`
        : eligible
          ? '會從目前地圖前往普隆德拉，使用遊戲內建傳送服務，向秘書 Lime Evenor 正式入團。'
          : '完成一轉後開放伊甸園入團與階段裝備訓練。';
  const milestones = (eden?.milestones ?? []).map((milestone) => {
    const row = document.createElement('button'),
      title = document.createElement('span'),
      level = document.createElement('small'),
      status = document.createElement('b');
    row.type = 'button';
    row.className = `eden-milestone ${milestone.status}`;
    row.setAttribute('role', 'listitem');
    row.disabled = active || milestone.status === 'locked';
    title.textContent = milestone.title;
    level.textContent =
      milestone.id === 'member'
        ? '原生 NPC 入團'
        : `Base Lv.${milestone.minimumLevel}`;
    status.textContent = questStatusNames[milestone.status] ?? '未開始';
    row.append(title, level, status);
    row.onclick = () => {
      document
        .querySelectorAll('.eden-milestone')
        .forEach((entry) =>
          entry.classList.toggle('selected', entry === row),
        );
    };
    row.ondblclick = () => {
      if (milestone.id === 'member' && !member && milestone.status !== 'locked')
        enrollEden();
    };
    return row;
  });
  if (milestones.length) $('#edenMilestones').replaceChildren(...milestones);
}
const equipmentSlotBits = [
  [1, 'headLower'],
  [2, 'rightHand'],
  [4, 'robe'],
  [8, 'accessoryRight'],
  [16, 'armor'],
  [32, 'leftHand'],
  [64, 'shoes'],
  [128, 'accessoryLeft'],
  [256, 'headTop'],
  [512, 'headMid'],
];
function itemEquipmentEntry(item) {
  const mask = Number(item.equipMask || item.equipTarget || 0);
  return {
    binId: item.binId,
    itemKey: item.itemKey,
    itemId: item.itemId,
    equipMask: Number(item.equipMask || 0),
    equipTarget: Number(item.equipTarget || 0),
    slot:
      equipmentSlotBits.find(([bit]) => (mask & bit) !== 0)?.[1] ?? 'unknown',
    amount: item.amount,
    refine: item.refine,
    aegisName: item.aegisName,
    name: item.name,
  };
}

async function refresh() {
  try {
    const state = await api('/api/state');
    lastState = state;
    if (state.needsCharacter) {
      show($('#auth'));
      show($('#loginForm'), false);
      show($('#characterForm'));
      show($('#game'), false);
      return;
    }
    sessionStartedAt = state.startedAt;
    currentRunning = state.running;
    $('#accountName').textContent = `帳號：${state.account.username}`;
    $('#status').textContent = state.running ? '掛機中' : '已停止';
    $('#start').disabled = state.running;
    $('#stop').disabled = !state.running;
    $('#kills').textContent = state.kills;
    $('#deaths').textContent = state.deaths;
    $('#baseExpGained').textContent = state.baseExpGained.toLocaleString();
    $('#jobExpGained').textContent = state.jobExpGained.toLocaleString();
    $('#duration').textContent = duration(state.startedAt);
    setCharacter(state.character, state.derived);
    renderOnboarding(
      state.onboarding,
      state.character,
      state.running,
      state.derived,
    );
    renderEden(state.eden, state.character);
    setMusicContext(state.character?.map);
    const editingChat = document.activeElement === $('#chatInput');
    if (!editingChat) {
      setInventory(state.inventory);
      setEquipment(state.character, state.equipment);
    }
    setServices(state.world);
    setLoot(state.items);
    setSupplyCycle(state.supplyCycle, state.derived, state.inventory);
  } catch (error) {
    if (/登入/.test(error.message)) {
      show($('#auth'));
      show($('#game'), false);
      clearInterval(statePoll);
      clearTimeout(eventTimer);
      clearTimeout(socialTimer);
    } else {
      $('#status').textContent = '控制層斷線';
      $('#worldLamp').textContent = '無法連線';
    }
  }
}
async function enter() {
  const [session, health] = await Promise.all([
    api('/api/session'),
    api('/api/health').catch(() => ({ ok: false })),
  ]);
  $('#loginServerStatus').textContent = health.ok ? '伺服器正常' : '無法連線';
  authenticated = Boolean(session.account);
  if (!session.account) {
    setMusicContext('title');
    show($('#auth'));
    show($('#loginForm'));
    show($('#characterForm'), false);
    show($('#characterSelectForm'), false);
    syncAudioControls();
    return;
  }
  await loadAccountAudio();
  if (!session.account.characterName) {
    setMusicContext('title');
    currentCreateSex = 'M';
    document.querySelector('[name=createSex][value=M]').checked = true;
    show($('#auth'));
    show($('#loginForm'), false);
    show($('#characterForm'));
    show($('#characterSelectForm'), false);
    $('#createPaperdoll').src = paperdollAsset(
      currentCreateSex,
      $('#hair').value,
    );
    return;
  }
  setMusicContext('title');
  let state = await api('/api/state');
  for (
    let attempt = 0;
    !state.character && !state.needsCharacter && attempt < 8;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    state = await api('/api/state');
  }
  lastState = state;
  const character = state.character;
  if (!character) {
    currentCreateSex = session.account.sex === 'F' ? 'F' : 'M';
    document.querySelector(
      `[name=createSex][value=${currentCreateSex}]`,
    ).checked = true;
    $('#createPaperdoll').src = paperdollAsset(
      currentCreateSex,
      $('#hair').value,
    );
    $('#characterError').textContent = state.needsCharacter
      ? '請先建立角色'
      : '角色資料同步中，請重新整理後再試';
    show($('#auth'));
    show($('#loginForm'), false);
    show($('#characterForm'));
    show($('#characterSelectForm'), false);
    return;
  }
  $('#selectPaperdoll').src = paperdollAsset(character.sex, character.hair);
  $('#selectCharacterName').textContent = character.name;
  $('#selectCharacterMeta').textContent =
    `${jobNames[character.classId] ?? `職業 ${character.classId}`}　Base Lv. ${character.baseLevel} / Job Lv. ${character.jobLevel}`;
  show($('#auth'));
  show($('#loginForm'), false);
  show($('#characterForm'), false);
  show($('#characterSelectForm'));
  show($('#game'), false);
}
async function enterGame() {
  show($('#auth'), false);
  show($('#game'));
  chatReady = false;
  selectChatChannel(currentChatChannel);
  await refresh();
  await Promise.all([loadMapInfo(), loadSkillTrees()]);
  clearInterval(statePoll);
  clearTimeout(eventTimer);
  clearTimeout(socialTimer);
  eventCursor = null;
  socialCursor = null;
  statePoll = setInterval(refresh, 1500);
  pollEvents();
  await pollSocial();
  chatReady = true;
  selectChatChannel(currentChatChannel);
}
async function act(action) {
  $('#start').disabled = $('#stop').disabled = true;
  $('#status').textContent = '處理中';
  try {
    await api('/api/automation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  } catch (error) {
    $('#status').textContent = error.message;
  }
  setTimeout(refresh, 500);
}
async function resumeOnboarding(questId = '') {
  $('#questNotice').textContent = '正在核對任務進度與正確返回地點';
  try {
    await api('/api/onboarding/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questId }),
    });
    $('#questNotice').textContent = '已送出恢復請求，正在返回未完成的新生任務';
  } catch (error) {
    $('#questNotice').textContent = error.message;
  }
  setTimeout(refresh, 300);
}
async function enrollEden() {
  $('#edenNotice').textContent = '正在啟動角色並核對伊甸園成員資格';
  try {
    await api('/api/eden/enroll', { method: 'POST' });
    $('#edenNotice').textContent = '已開始前往普隆德拉伊甸園傳送員';
  } catch (error) {
    $('#edenNotice').textContent = error.message;
  }
  setTimeout(refresh, 300);
}

$('#loginForm').onsubmit = async (event) => {
  event.preventDefault();
  $('#authError').textContent = '登入中';
  try {
    await api('/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: $('#username').value,
        password: $('#password').value,
      }),
    });
    $('#authError').textContent = '';
    await enter();
  } catch (error) {
    $('#authError').textContent = error.message;
  }
};
$('#characterForm').onsubmit = async (event) => {
  event.preventDefault();
  $('#characterError').textContent = '建立中';
  try {
    await api('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $('#characterName').value,
        hair: Number($('#hair').value),
        hairColor: Number($('#hairColor').value),
        sex: document.querySelector('[name=createSex]:checked').value,
        targetJob: document.querySelector('[name=targetJob]:checked')?.value,
      }),
    });
    await enter();
  } catch (error) {
    $('#characterError').textContent = error.message;
  }
};
$('#characterSelectForm').onsubmit = async (event) => {
  event.preventDefault();
  $('#selectEnter').disabled = true;
  $('#characterSelectError').textContent = '正在進入遊戲';
  try {
    await enterGame();
    $('#characterSelectError').textContent = '';
  } catch (error) {
    $('#characterSelectError').textContent = error.message;
  } finally {
    $('#selectEnter').disabled = false;
  }
};
$('#selectLogout').onclick = async () => {
  await api('/api/account', { method: 'DELETE' });
  location.reload();
};
function changeAppearance(inputId, outputId, minimum, maximum, delta) {
  const input = $(`#${inputId}`);
  let value = Number(input.value) + delta;
  if (value < minimum) value = maximum;
  if (value > maximum) value = minimum;
  input.value = String(value);
  $(`#${outputId}`).textContent =
    `${value - minimum + 1} / ${maximum - minimum + 1}`;
  $('#createPaperdoll').src = paperdollAsset(
    currentCreateSex,
    $('#hair').value,
  );
}
$('#hairPrev').onclick = () => changeAppearance('hair', 'hairValue', 1, 42, -1);
$('#hairNext').onclick = () => changeAppearance('hair', 'hairValue', 1, 42, 1);
$('#hairColorPrev').onclick = () =>
  changeAppearance('hairColor', 'hairColorValue', 0, 8, -1);
$('#hairColorNext').onclick = () =>
  changeAppearance('hairColor', 'hairColorValue', 0, 8, 1);
for (const input of document.querySelectorAll('[name=createSex]'))
  input.onchange = (event) => {
    currentCreateSex = event.target.value;
    $('#createPaperdoll').src = paperdollAsset(
      currentCreateSex,
      $('#hair').value,
    );
  };
$('#authMusicVolume').oninput = (event) =>
  setAudio({ musicVolume: Number(event.target.value) });
$('#musicVolume').oninput = (event) =>
  setAudio({ musicVolume: Number(event.target.value) });
$('#soundVolume').oninput = (event) =>
  setAudio({ soundVolume: Number(event.target.value) });
$('#damageFloatScale').oninput = (event) =>
  setAudio({ damageFloatScale: Number(event.target.value) });
$('#damageFloatOpacity').oninput = (event) =>
  setAudio({ damageFloatOpacity: Number(event.target.value) });
$('#damageFloatWeight').onchange = (event) =>
  setAudio({ damageFloatWeight: Number(event.target.value) });
$('#damageFloatFont').onchange = (event) =>
  setAudio({ damageFloatFont: event.target.value });
$('#damageFloatPositionX').oninput = (event) =>
  setAudio({ damageFloatPositionX: Number(event.target.value) });
$('#damageFloatPositionY').oninput = (event) =>
  setAudio({ damageFloatPositionY: Number(event.target.value) });
$('#damageFloatArc').oninput = (event) =>
  setAudio({ damageFloatArc: Number(event.target.value) });
$('#authMusicToggle').onchange = (event) =>
  setAudio({ musicEnabled: event.target.checked });
$('#musicToggle').onchange = (event) =>
  setAudio({ musicEnabled: event.target.checked });
$('#soundToggle').onchange = (event) =>
  setAudio({ soundEnabled: event.target.checked });
$('#damageFloatToggle').onchange = (event) =>
  setAudio({ damageFloatsEnabled: event.target.checked });
$('#quickAudio').onclick = () => {
  document.querySelector('[data-tab="system"]').click();
  $('#system').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
document.addEventListener('pointerdown', () => unlockAudio(true));
document.addEventListener('keydown', () => unlockAudio(true));
setRandomLoginBackground();
syncAudioControls();
$('#emotionPalette').replaceChildren(
  ...emotions.map((emotion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.emotionId = emotion.id;
    button.textContent = emotion.symbol;
    button.title = `${emotion.label} (${emotion.source})`;
    button.setAttribute('aria-label', emotion.label);
    return button;
  }),
);
$('#emotionToggle').onclick = () => {
  const palette = $('#emotionPalette'),
    opening = palette.classList.contains('hidden');
  show(palette, opening);
  $('#emotionToggle').setAttribute('aria-expanded', String(opening));
};
function selectChatChannel(channel) {
  const definition = chatChannelDefs[channel];
  if (!definition) return;
  currentChatChannel = channel;
  $('#chatChannel').textContent = definition.label;
  document.querySelectorAll('[data-chat-channel]').forEach((button) => {
    const selected = button.dataset.chatChannel === channel;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  show($('#chatRecipientRow'), Boolean(definition.target));
  const readonly = Boolean(definition.readonly),
    disabled = readonly || !chatReady,
    input = $('#chatInput'),
    sendChannel = definition.send || channel;
  input.disabled = disabled;
  $('#chatSend').disabled = disabled;
  $('#emotionToggle').disabled =
    disabled || !['all', 'public'].includes(channel);
  $('#voiceRecord').disabled = disabled || sendChannel !== 'public';
  input.placeholder = readonly
    ? '系統訊息僅供查看'
    : definition.target
      ? '輸入密語內容'
      : `輸入${definition.label}訊息`;
  $('#chatStatus').textContent = readonly
    ? '系統訊息由遊戲伺服器送出。'
    : sendChannel === 'public'
      ? '文字由遊戲伺服器回送；錄音最長 30 秒、最大 1 MB。'
      : '文字由遊戲伺服器頻道收發。';
  applyChatFilter();
  if (!readonly) input.focus();
}
$('#chatChannels').onclick = (event) => {
  const button = event.target.closest('[data-chat-channel]');
  if (button) selectChatChannel(button.dataset.chatChannel);
};
$('#chatForm').onsubmit = async (event) => {
  event.preventDefault();
  if (!chatReady) {
    $('#chatStatus').textContent = '正在同步對話紀錄';
    return;
  }
  const input = $('#chatInput'),
    message = input.value.trim(),
    definition = chatChannelDefs[currentChatChannel],
    channel = definition?.send || currentChatChannel,
    target = definition?.target ? $('#chatRecipient').value.trim() : '';
  if (!message) return;
  if (definition?.readonly) return;
  if (definition?.target && !target) {
    $('#chatStatus').textContent = '請先輸入密語對象';
    $('#chatRecipient').focus();
    return;
  }
  input.value = '';
  input.focus();
  $('#chatSend').disabled = true;
  $('#chatStatus').textContent = '傳送中';
  const pending = socialNode({
    at: Date.now(),
    type: 'chat pending',
    channel,
    target,
    sender: currentCharacterName,
    message,
  });
  const pendingKey = pendingChatKey(channel, target, message);
  pendingChatRows.get(pendingKey)?.remove();
  pendingChatRows.set(pendingKey, pending);
  $('#chatFeed').querySelector('.chat-empty')?.remove();
  $('#chatFeed').append(pending);
  $('#chatFeed').scrollTop = $('#chatFeed').scrollHeight;
  try {
    const accepted = await api('/api/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'chat', channel, target, message }),
    });
    pending.dataset.commandId = accepted.commandId || '';
    $('#chatStatus').textContent = '已送出，等待伺服器確認';
  } catch (error) {
    pending.classList.remove('pending');
    pending.classList.add('error');
    pending.querySelector('span').textContent =
      `${message}（${error.message}）`;
    pendingChatRows.delete(pendingKey);
    $('#chatStatus').textContent = error.message;
  } finally {
    $('#chatSend').disabled = false;
    input.focus();
  }
};
function preferredVoiceMimeType() {
  return [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ].find((type) => window.MediaRecorder?.isTypeSupported(type));
}
function stopVoiceRecording() {
  clearTimeout(voiceStopTimer);
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
}
async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
    throw new Error('此瀏覽器不支援錄音');
  const mimeType = preferredVoiceMimeType();
  if (!mimeType) throw new Error('此瀏覽器沒有可用的語音格式');
  voiceStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  voiceChunks = [];
  mediaRecorder = new MediaRecorder(voiceStream, { mimeType });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size) voiceChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const durationMs = Math.max(250, Date.now() - voiceStartedAt),
      recorderMime = mediaRecorder.mimeType || mimeType,
      blob = new Blob(voiceChunks, { type: recorderMime });
    voiceStream?.getTracks().forEach((track) => track.stop());
    voiceStream = null;
    mediaRecorder = null;
    $('#voiceRecord').classList.remove('recording');
    $('#voiceRecord').setAttribute('aria-pressed', 'false');
    $('#voiceRecord').textContent = '錄音';
    if (blob.size < 128) {
      $('#chatStatus').textContent = '沒有錄到聲音';
      return;
    }
    $('#voiceRecord').disabled = true;
    $('#chatStatus').textContent = '正在上傳語音';
    try {
      const result = await api('/api/social/voice', {
        method: 'POST',
        headers: {
          'content-type': recorderMime,
          'x-ro-voice-duration': String(Math.min(30000, durationMs)),
        },
        body: blob,
      });
      $('#voiceRecord').dataset.lastVoiceId = result.voiceId;
      $('#chatStatus').textContent = '語音已送出';
    } catch (error) {
      $('#chatStatus').textContent = error.message;
    } finally {
      $('#voiceRecord').disabled = false;
    }
  };
  voiceStartedAt = Date.now();
  mediaRecorder.start(250);
  $('#voiceRecord').classList.add('recording');
  $('#voiceRecord').setAttribute('aria-pressed', 'true');
  $('#voiceRecord').textContent = '停止';
  $('#chatStatus').textContent = '錄音中，最長 30 秒';
  voiceStopTimer = setTimeout(stopVoiceRecording, 30000);
}
$('#voiceRecord').onclick = async () => {
  if (mediaRecorder?.state === 'recording') {
    stopVoiceRecording();
    return;
  }
  try {
    await startVoiceRecording();
  } catch (error) {
    voiceStream?.getTracks().forEach((track) => track.stop());
    voiceStream = null;
    mediaRecorder = null;
    $('#chatStatus').textContent = error.message;
  }
};
$('#emotionPalette').onclick = async (event) => {
  const button = event.target.closest('[data-emotion-id]');
  if (!button) return;
  button.disabled = true;
  $('#chatStatus').textContent = '已送出表情，等待遊戲伺服器回送';
  try {
    await api('/api/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'emotion',
        emotionId: Number(button.dataset.emotionId),
      }),
    });
  } catch (error) {
    $('#chatStatus').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
$('#logout').onclick = async () => {
  await api('/api/account', { method: 'DELETE' });
  location.reload();
};
document.querySelectorAll('[data-tab]').forEach((button) =>
  button.addEventListener('click', () => {
    playCombatSound('uiTab', 0, '', 0, 0.42);
    document
      .querySelectorAll('[data-tab],.panel')
      .forEach((element) => element.classList.remove('active'));
    button.classList.add('active');
    $(`#${button.dataset.tab}`).classList.add('active');
    if (button.dataset.tab === 'mapInfo')
      void loadMapInfo().catch((error) => {
        $('#mapInfoSource').textContent = error.message;
      });
    if (button.dataset.tab === 'skills')
      void loadSkillTrees().catch((error) => {
        $('#skillNotice').textContent = error.message;
      });
  }),
);
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled || button.matches('[data-tab]')) return;
  if (button.matches('[data-inventory]')) return;
  const key =
    button.id === 'stop' ||
    button.id === 'logout' ||
    button.id === 'selectLogout'
      ? 'uiCancel'
      : button.hasAttribute('aria-expanded')
        ? button.getAttribute('aria-expanded') === 'true'
          ? 'uiClose'
          : 'uiOpen'
        : 'uiConfirm';
  playCombatSound(key, 0, '', 0, 0.38);
});
document.querySelectorAll('[data-inventory]').forEach((button) =>
  button.addEventListener('click', () => {
    playCombatSound('uiTab', 0, '', 0, 0.42);
    document
      .querySelectorAll('[data-inventory]')
      .forEach((element) => element.classList.remove('active'));
    button.classList.add('active');
    inventoryCategory = button.dataset.inventory;
    renderInventory();
  }),
);
let statHoldDelay = null,
  statHoldTimer = null,
  statRequestBusy = false,
  resetArmedUntil = 0;
async function waitForState(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const attemptStartedAt = performance.now();
    const state = await api('/api/state');
    if (predicate(state)) {
      lastState = state;
      return state;
    }
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, 120 - (performance.now() - attemptStartedAt)),
      ),
    );
  }
  return null;
}
async function waitForLive(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const attemptStartedAt = performance.now();
    const events = await api('/api/events');
    if (events.live && predicate(events.live)) return events.live;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, 80 - (performance.now() - attemptStartedAt)),
      ),
    );
  }
  return null;
}
async function addStatusPoint(stat) {
  if (statRequestBusy) return;
  statRequestBusy = true;
  const before = Number(
    lastState?.derived?.[stat] ?? lastState?.character?.[stat] ?? 0,
  );
  try {
    const result = await api('/api/status-point', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stat }),
    });
    if (result.character) setCharacter(result.character);
    else {
      const confirmed = await waitForLive(
        (live) => Number(live[stat]) > before,
      );
      if (confirmed) {
        lastState = { ...lastState, derived: confirmed };
        setCharacter(lastState.character, confirmed);
        $('#statNotice').textContent = '伺服器已確認能力配點';
      } else {
        $('#statNotice').textContent = '伺服器尚未確認能力配點';
      }
    }
  } catch (error) {
    $('#statNotice').textContent = error.message;
    stopStatHold();
  } finally {
    statRequestBusy = false;
  }
}
function stopStatHold() {
  clearTimeout(statHoldDelay);
  clearInterval(statHoldTimer);
  statHoldDelay = statHoldTimer = null;
}
$('#stats').addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-stat]');
  if (!button || button.disabled) return;
  event.preventDefault();
  const stat = button.dataset.stat;
  addStatusPoint(stat);
  statHoldDelay = setTimeout(() => {
    statHoldTimer = setInterval(() => addStatusPoint(stat), 110);
  }, 380);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
  $('#stats').addEventListener(type, stopStatHold);
$('#resetStats').onclick = async () => {
  if (Date.now() > resetArmedUntil) {
    resetArmedUntil = Date.now() + 5000;
    $('#statNotice').textContent =
      '再次點擊「全部重置」確認，角色會保持在線與掛機。';
    return;
  }
  resetArmedUntil = 0;
  const beforeUpdate = Number(lastState?.derived?.updatedAt ?? 0);
  $('#resetStats').disabled = true;
  $('#statNotice').textContent = '正在重置能力值';
  try {
    await api('/api/status-reset', { method: 'POST' });
    const confirmed = await waitForLive(
      (live) =>
        Number(live.updatedAt ?? 0) > beforeUpdate &&
        ['str', 'agi', 'vit', 'int', 'dex', 'luk'].every(
          (stat) => Number(live[stat]) === 1,
        ),
    );
    if (confirmed) {
      lastState = { ...lastState, derived: confirmed };
      setCharacter(lastState.character, confirmed);
      $('#statNotice').textContent = '能力值已重置，掛機持續進行。';
    } else {
      $('#statNotice').textContent = '伺服器尚未確認能力重置';
    }
  } catch (error) {
    $('#statNotice').textContent = error.message;
  } finally {
    $('#resetStats').disabled = false;
  }
};
$('#skillList').onclick = async (event) => {
  const button = event.target.closest('[data-skill-id]');
  if (!button || button.disabled) return;
  const skillId = Number(button.dataset.skillId),
    before = Number(
      lastState?.derived?.skills?.find((skill) => Number(skill.id) === skillId)
        ?.level ??
        (skillId === 1 ? lastState?.derived?.basicSkillLevel : 0) ??
        0,
    );
  button.disabled = true;
  $('#skillNotice').textContent = '正在送出技能配點';
  try {
    await api('/api/skill-point', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skillId }),
    });
    const confirmed = await waitForLive(
      (live) =>
        Number(
          live.skills?.find((skill) => Number(skill.id) === skillId)?.level ??
            (skillId === 1 ? live.basicSkillLevel : 0) ??
            0,
        ) > before,
    );
    if (confirmed) {
      lastState = { ...lastState, derived: confirmed };
      setCharacter(lastState.character, confirmed);
      $('#skillNotice').textContent = '伺服器已確認技能配點';
    } else {
      $('#skillNotice').textContent = '伺服器尚未確認技能配點';
    }
  } catch (error) {
    $('#skillNotice').textContent = error.message;
  } finally {
    refresh();
  }
};
$('#skillList').onchange = async (event) => {
  const control = event.target.closest('[data-skill-auto]');
  if (!control) return;
  const row = control.closest('.skill-automation'),
    toggle = row.querySelector('input[type="checkbox"]'),
    mode = control.dataset.skillAuto,
    skillId = Number(control.dataset.autoSkillId),
    skillHandle = control.dataset.skillHandle,
    settingChange = Boolean(control.dataset.skillAutoSetting),
    enabled = settingChange ? toggle.checked : control.checked,
    minimumSp = Number(
      row.querySelector('[data-skill-auto-setting="minimumSp"]')?.value ?? 20,
    ),
    hpBelow = Number(
      row.querySelector('[data-skill-auto-setting="hpBelow"]')?.value ?? 70,
    ),
    liveSkill = lastState?.derived?.skills?.find(
      (skill) => Number(skill.id) === skillId,
    ),
    level = Number(liveSkill?.level ?? 0);
  if (settingChange && !enabled) return;
  row.querySelectorAll('input, select').forEach((element) => {
    element.disabled = true;
  });
  $('#skillNotice').textContent = enabled
    ? '正在更新掛機技能設定'
    : '正在關閉掛機技能';
  try {
    await api('/api/skill-automation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        enabled,
        skillId,
        level,
        minimumSp,
        hpBelow,
      }),
    });
    const slotKey =
      mode === 'attack' ? 'attack' : mode === 'selfRecovery' ? 'self' : 'buff';
    const confirmed = await waitForLive((live) => {
      const slot = live.skillAutomation?.[slotKey];
      return enabled
        ? slot?.handle === skillHandle &&
            Number(slot.minimumSp) === minimumSp &&
            (mode !== 'selfRecovery' || Number(slot.hpBelow) === hpBelow)
        : !slot;
    });
    if (confirmed) {
      lastState = { ...lastState, derived: confirmed };
      setCharacter(lastState.character, confirmed);
      $('#skillNotice').textContent = enabled
        ? '掛機技能已生效，角色保持在線'
        : '掛機技能已關閉，角色保持在線';
    } else $('#skillNotice').textContent = '遊戲伺服器尚未確認技能設定';
  } catch (error) {
    $('#skillNotice').textContent = error.message;
  } finally {
    await refresh();
  }
};
$('#firstJobChoices').onclick = (event) => {
  const button = event.target.closest('[data-job-route]');
  if (!button || button.disabled) return;
  void (async () => {
    const job = button.dataset.jobRoute;
    if (!lastState?.character?.targetJob) {
      await api('/api/job-target', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      await refresh();
    }
    await jobChangeAction(
      { action: 'route', job },
      `正在以${firstJobs[job].transport}前往${firstJobs[job].destination}`,
    );
  })().catch((error) => {
    $('#jobChangeNotice').textContent = error.message;
  });
};
$('#jobTalk').onclick = () =>
  void jobChangeAction(
    { action: 'talk', job: $('#jobTalk').dataset.job },
    '正在開啟轉職 NPC 對話',
  );
$('#jobResume').onclick = () =>
  void jobChangeAction({ action: 'resume' }, '正在恢復原掛機設定');
$('#npcActions').onclick = (event) => {
  const choice = event.target.closest('[data-npc-choice]'),
    action = event.target.closest('[data-npc-action]');
  if (choice)
    void jobChangeAction(
      { action: 'select', choice: Number(choice.dataset.npcChoice) },
      '正在送出 NPC 選項',
    );
  else if (action)
    void jobChangeAction(
      { action: action.dataset.npcAction },
      '正在更新 NPC 對話',
    );
};
$('#supplyForm').onsubmit = async (event) => {
  event.preventDefault();
  const save = $('#saveSupply');
  save.disabled = true;
  $('#supplyNotice').textContent = '正在套用自動補給設定';
  try {
    const rules = [...document.querySelectorAll('[data-supply-item-id]')]
        .map((select) => ({
          itemId: Number(select.dataset.supplyItemId),
          action: select.value,
        }))
        .filter((rule) => rule.action !== 'default'),
      result = await api('/api/supply-cycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: $('#supplyEnabled').checked,
          returnWeight: Number($('#supplyWeight').value),
          store: $('#supplyStore').checked,
          sell: $('#supplySell').checked,
          buy: $('#supplyBuy').checked,
          redPotionMin: Number($('#redPotionMin').value),
          redPotionMax: Number($('#redPotionMax').value),
          rules,
        }),
      });
    supplyCycleSettings = result.supplyCycle;
    supplyRuleSignature = '';
    $('#supplyNotice').textContent = result.supplyCycle.enabled
      ? '設定已生效，達到條件會自動回城並在完成後返回掛機地圖'
      : '回城補給循環已關閉';
    await refresh();
  } catch (error) {
    $('#supplyNotice').textContent = error.message;
  } finally {
    save.disabled = false;
  }
};
$('#start').onclick = () => act('start');
$('#stop').onclick = () => act('stop');
setInterval(() => {
  if (!$('#game').classList.contains('hidden'))
    $('#duration').textContent = duration(sessionStartedAt);
  if (lastEventAt && performance.now() - lastEventAt > 2000 && currentRunning)
    $('#logLatency').textContent = '等待戰鬥事件';
}, 1000);
setupFoldableWindows();
setupTaskSections();
enter();
function setItemActionNotice(message) {
  $('#itemNotice').textContent = message;
  $('#equipmentItemNotice').textContent = message;
}
async function confirmItemAction(action, trackedBinId, trackedItemKey, before) {
  const deadline = Date.now() + 2500;
  let confirmed = false,
    after = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const events = await api('/api/events');
    after = events.live?.inventory?.find((entry) =>
      trackedItemKey
        ? entry.itemKey === trackedItemKey
        : entry.binId === trackedBinId,
    );
    confirmed =
      action === 'card'
        ? !after || Number(after.amount) < Number(before?.amount ?? 0)
        : action === 'equip'
          ? after?.equipped === true
          : action === 'unequip'
            ? after?.equipped === false
            : !after || Number(after.amount) < Number(before?.amount ?? 0);
    if (confirmed) break;
  }
  if (confirmed) {
    if (after) {
      inventoryItems = inventoryItems.map((item) =>
        (
          trackedItemKey
            ? item.itemKey === trackedItemKey
            : item.binId === trackedBinId
        )
          ? {
              ...item,
              amount: Number(after.amount),
              equipped: Boolean(after.equipped),
              equipMask: Number(after.equipMask ?? 0),
              equipTarget: Number(after.equipTarget ?? item.equipTarget ?? 0),
            }
          : item,
      );
    } else {
      inventoryItems = inventoryItems.filter((item) =>
        trackedItemKey
          ? item.itemKey !== trackedItemKey
          : item.binId !== trackedBinId,
      );
    }
    const equipment = inventoryItems
      .filter((item) => item.category === 'equipment' && item.equipped)
      .map(itemEquipmentEntry);
    lastState = { ...lastState, inventory: inventoryItems, equipment };
    renderInventory();
    setEquipment(lastState.character, equipment);
  }
  setItemActionNotice(
    confirmed
      ? action === 'card'
        ? '伺服器已確認卡片插入裝備'
        : action === 'use'
          ? '伺服器已確認使用道具'
          : action === 'equip'
            ? '伺服器已確認穿上裝備'
            : '伺服器已確認卸下裝備'
      : action === 'use'
        ? '伺服器未消耗道具，角色目前無法使用'
        : '伺服器尚未確認，道具狀態沒有變更',
  );
  if (confirmed && action === 'card') {
    selectedCardBinId = null;
    selectedCardItemKey = null;
  }
  void refresh();
}
document.addEventListener('dblclick', async (event) => {
  const item = event.target.closest('.inventory-item, .equip-slot.equipped');
  if (!item) return;
  const blockedReason = item.dataset.blockedReason || '';
  if (blockedReason) {
    setItemActionNotice(blockedReason);
    return;
  }
  const binId = item.dataset.binId === '' ? NaN : Number(item.dataset.binId);
  const itemKey = item.dataset.itemKey || '';
  if (!Number.isInteger(binId)) {
    setItemActionNotice('遊戲伺服器尚未同步此道具');
    return;
  }
  item.classList.add('pending');
  setItemActionNotice('正在送出操作');
  let action = item.dataset.action;
  if (action === 'card') {
    selectedCardBinId = binId;
    selectedCardItemKey = itemKey;
    document
      .querySelectorAll('.inventory-item.card-selected')
      .forEach((entry) => entry.classList.remove('card-selected'));
    item.classList.add('card-selected');
    item.classList.remove('pending');
    setItemActionNotice('已選擇卡片，請雙擊要插卡的裝備');
    return;
  }
  const cardBinId = selectedCardBinId;
  if (cardBinId !== null && item.dataset.category === 'equipment')
    action = 'card';
  const trackedBinId = action === 'card' ? cardBinId : binId;
  const trackedItemKey = action === 'card' ? selectedCardItemKey : itemKey;
  const before = inventoryItems.find((entry) =>
    trackedItemKey
      ? entry.itemKey === trackedItemKey
      : entry.binId === trackedBinId,
  );
  if (action === 'equip' || action === 'unequip')
    playCombatSound(equipSoundKey(before), 0, '', 0, 0.56);
  else if (action === 'use')
    playCombatSound(
      /potion|藥水/i.test(item.dataset.name || item.textContent || '')
        ? 'itemDrinkPotion'
        : 'uiConfirm',
      0,
      '',
      0,
      0.5,
    );
  else if (action === 'card') playCombatSound('uiConfirm', 0, '', 0, 0.5);
  try {
    await api('/api/item-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        binId: action === 'card' ? cardBinId : binId,
        itemKey: action === 'card' ? selectedCardItemKey : itemKey,
        targetBinId: action === 'card' ? binId : undefined,
        targetItemKey: action === 'card' ? itemKey : undefined,
      }),
    });
    setItemActionNotice('指令已送出，伺服器確認中');
    item.classList.remove('pending');
    void confirmItemAction(action, trackedBinId, trackedItemKey, before).catch(
      (error) => setItemActionNotice(error.message),
    );
  } catch (error) {
    setItemActionNotice(error.message);
  } finally {
    item.classList.remove('pending');
  }
});
