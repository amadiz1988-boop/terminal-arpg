const $ = (s) => document.querySelector(s);
let configEditorCharacterId = null;
function mountCharacterConfigEditor(characterId) {
  const root = $('#configEditor');
  const id = Number(characterId);
  if (!root || !Number.isSafeInteger(id) || id <= 0 || configEditorCharacterId === id) return;
  configEditorCharacterId = id;
  root.dataset.configEditorMounted = '';
  root.replaceChildren();
  if (window.GhostIslandConfigEditor?.mount)
    void window.GhostIslandConfigEditor.mount(root);
}
const rememberedAccountStorageKey = 'ghost-island.remembered-account.v1';
function hydrateRememberedAccount() {
  try {
    const username = localStorage.getItem(rememberedAccountStorageKey) ?? '';
    if (!/^[A-Za-z0-9_]{4,23}$/.test(username)) return;
    $('#username').value = username;
    $('#rememberAccount').checked = true;
  } catch {}
}
function persistRememberedAccount(username) {
  try {
    if ($('#rememberAccount').checked)
      localStorage.setItem(rememberedAccountStorageKey, username);
    else localStorage.removeItem(rememberedAccountStorageKey);
  } catch {}
}
const deferredScriptPromises = new Map();
function loadDeferredScript(source) {
  if (!deferredScriptPromises.has(source)) {
    deferredScriptPromises.set(
      source,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = source;
        script.async = true;
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error(`延後載入失敗：${source.split('?')[0]}`));
        document.head.append(script);
      }),
    );
  }
  return deferredScriptPromises.get(source);
}
async function loadCharacterSelectionAssets() {
  await loadDeferredScript('/ro-asset-resolver.js?v=r005-map-name-index');
  await window.roAssetResolver?.load();
  void prefetchMapInfo();
}
let gameplayModulesPromise = null;
function loadGameplayModules() {
  if (!gameplayModulesPromise) {
    gameplayModulesPromise = (async () => {
      await loadCharacterSelectionAssets();
      void loadSkillTrees().catch(() => null);
      await Promise.all([
        loadDeferredScript('/pet-showcase.js?v=r001'),
        loadDeferredScript('/pet-companion-settings.js?v=r003-size-aware'),
        loadDeferredScript('/pet-sprite-source.js?v=r007-terasoid-move'),
        loadDeferredScript('/npc-visual-manifest.js?v=r001'),
      ]);
      await Promise.all([
        loadDeferredScript('/mission-interaction-stage.js?v=r002'),
        loadDeferredScript('/pet-companion.js?v=r011-card-preview-avoid'),
      ]);
    })();
  }
  return gameplayModulesPromise;
}
function activateDeferredGameImages({ includeWorldMap = true } = {}) {
  document.querySelectorAll('img[data-game-src]').forEach((image) => {
    if (!includeWorldMap && image.id === 'worldMapImage') return;
    if (!image.src) image.src = image.dataset.gameSrc;
  });
}
function scheduleGameplayModuleWarmup() {
  const load = () => void loadGameplayModules().catch(() => null);
  if ('requestIdleCallback' in window)
    requestIdleCallback(load, { timeout: 1500 });
  else setTimeout(load, 750);
}
function scheduleWorldMapWarmup() {
  setTimeout(() => {
    if (!$('#game').classList.contains('hidden'))
      activateDeferredGameImages({ includeWorldMap: true });
  }, 1000);
}
const mapNames = {
  prontera: '普隆德拉',
  prt_in: '普隆德拉室內商店',
  prt_cas: '普隆德拉十字軍總部',
  job_cru: '十字軍考場',
  prt_fild08: '普隆德拉原野 08',
  morocc: '夢羅克',
  moc_fild19: '夢羅克原野 19',
  moc_ruins: '夢羅克遺跡',
  moc_pryd01: '金字塔迷宮 1F',
  moc_prydb1: '盜賊公會',
  in_moc_16: '刺客公會',
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
function localizedItemDisplayName(item) {
  const runtimeName = String(item?.name ?? item ?? '').trim();
  const resolved = window.roAssetResolver?.resolveItemAsset(
    typeof item === 'object' ? item : { name: runtimeName },
  );
  return resolved?.name ?? names[runtimeName] ?? runtimeName;
}
const jobNames = {
    0: '初心者',
    1: '劍士',
    2: '魔法師',
    3: '弓箭手',
    4: '服事',
    5: '商人',
    6: '盜賊',
    12: '刺客',
    14: '十字軍',
    21: '跆拳',
    4046: '跆拳',
    23: '超級初心者',
    24: '神槍手',
    25: '忍者',
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
    supernovice: {
      name: '超級初心者',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
      requirement: 'Base Lv.45、Job Lv.10',
    },
    taekwon: {
      name: '跆拳',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    gunslinger: {
      name: '神槍手',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
    ninja: {
      name: '忍者',
      destination: '克里圖拉學院',
      transport: '新生快速引導',
    },
  },
  allowedFirstJobIds = new Set([1, 2, 3, 4, 5, 6, 21, 23, 24, 25, 4046]),
  defaultAudio = {
    musicEnabled: true,
    soundEnabled: true,
    muted: false,
    musicVolume: 20,
    soundVolume: 35,
    damageFloatsEnabled: true,
    damageFloatSize: 14,
    damageFloatScale: 500,
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
const officialDamageRoot = '/ro/client/damage';
const officialDamageSources = Object.freeze({
  digits: Array.from(
    { length: 10 },
    (_, digit) => `${officialDamageRoot}/number-${digit}.png`,
  ),
  criticalDigits: Array.from(
    { length: 10 },
    (_, digit) => `${officialDamageRoot}/critical-number-${digit}.png`,
  ),
  criticalBackground: `${officialDamageRoot}/critical-bg.png`,
  rays: [`${officialDamageRoot}/lens1.png`, `${officialDamageRoot}/lens2.png`],
});
const bgmTrack = (number) => {
  const id = String(number).padStart(2, '0');
  return `/ro/client/bgm/${
    id === '01'
      ? '01-title'
      : id === '08'
        ? '08-prontera'
        : id === '12'
          ? '12-streamside'
          : id
  }.mp3`;
};
// Gravity client data/mp3nametable.txt is the source of truth for map music.
const musicSources = Object.freeze({
  title: bgmTrack(1),
  iz_int: bgmTrack(26),
  iz_int01: bgmTrack(26),
  iz_int02: bgmTrack(26),
  iz_int03: bgmTrack(26),
  iz_int04: bgmTrack(26),
  // int_land variants have no entry in the locked client's table. A transition
  // from iz_int therefore keeps track 26; a direct login starts them silently.
  int_land: null,
  int_land01: null,
  int_land02: null,
  int_land03: null,
  int_land04: null,
  'new_1-3': bgmTrack(30),
  prontera: bgmTrack(8),
  prt_in: bgmTrack(8),
  prt_fild08: bgmTrack(12),
  izlude: bgmTrack(26),
  izlude_a: bgmTrack(26),
  izlude_b: bgmTrack(26),
  izlude_c: bgmTrack(26),
  izlude_d: bgmTrack(26),
  izlude_in: bgmTrack(26),
  iz_ac01: bgmTrack(26),
  iz_ac01_a: bgmTrack(26),
  iz_ac01_b: bgmTrack(26),
  iz_ac01_c: bgmTrack(26),
  iz_ac01_d: bgmTrack(26),
  iz_ac02: bgmTrack(26),
  iz_ac02_a: bgmTrack(26),
  iz_ac02_b: bgmTrack(26),
  iz_ac02_c: bgmTrack(26),
  iz_ac02_d: bgmTrack(26),
  prt_church: bgmTrack(10),
  prt_fild05: bgmTrack(12),
  mjolnir_09: bgmTrack(31),
  prt_fild00: bgmTrack(5),
  mjolnir_07: bgmTrack(31),
  mjolnir_06: bgmTrack(31),
  gef_fild00: bgmTrack(25),
  geffen: bgmTrack(13),
  geffen_in: bgmTrack(13),
  moc_fild01: bgmTrack(24),
  moc_fild11: bgmTrack(37),
  pay_fild04: bgmTrack(3),
  moc_fild02: bgmTrack(3),
  pay_gld: bgmTrack(66),
  payon: bgmTrack(14),
  pay_arche: bgmTrack(14),
  payon_in02: bgmTrack(14),
  pay_dun00: bgmTrack(20),
  morocc: bgmTrack(11),
  moc_para01: bgmTrack(11),
  moc_fild19: bgmTrack(37),
  moc_ruins: bgmTrack(52),
  moc_pryd01: bgmTrack(22),
  moc_prydb1: bgmTrack(22),
});
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
  uiOriginalButton: `${officialCombatSoundRoot}/ui_button_original.wav`,
  uiOriginalCancel: `${officialCombatSoundRoot}/ui_cancel_original.wav`,
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
  readyPortal: `${officialCombatSoundRoot}/ready_portal.wav`,
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
const travelCueKeys = new Set(['readyPortal', 'portal', 'warp', 'flyWing']);
const uiSoundKeys = new Set([
  'uiConfirm', 'uiCancel', 'uiOriginalButton', 'uiOriginalCancel',
  'uiOpen', 'uiClose', ...travelCueKeys,
]);
const combatAudio = Object.fromEntries(
  Object.entries(combatSounds).map(([key, source]) => [
    key,
    Array.from({ length: 4 }, () => {
      const audio = new Audio(source);
      audio.preload = uiSoundKeys.has(key) ? 'auto' : 'none';
      audio.setAttribute('playsinline', '');
      if (uiSoundKeys.has(key)) audio.load();
      return audio;
    }),
  ]),
);
const combatAudioCursor = Object.fromEntries(
  Object.keys(combatSounds).map((key) => [key, 0]),
);
let combatAudioContext = null;
const combatAudioBuffers = new Map();
const combatAudioBufferLoads = new Map();
const travelCueSessions = new Map();
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
  all: { label: '全部訊息' },
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
const chatChannelBadges = Object.freeze({
  public: '一般',
  private: '密語',
  party: '隊伍',
  guild: '公會',
  clan: '家族',
  battleground: '戰場',
  map: '地圖',
  global: '全服',
  trade: '交易',
  support: '支援',
  ally: '同盟',
  system: '系統',
});
const defaultVisibleChatChannels = Object.freeze([
  'all',
  'public',
  'private',
  'party',
  'guild',
  'system',
]);
function createWebViewerId() {
  try {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : [...crypto.getRandomValues(new Uint8Array(16))]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('');
  } catch {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }
}

const ObservationInterest = Object.freeze({
    IDLE_PAGE: 'IDLE_PAGE',
    COMBAT_PAGE: 'COMBAT_PAGE',
    QUEST_PAGE: 'QUEST_PAGE',
    INVENTORY_PAGE: 'INVENTORY_PAGE',
    SOCIAL_PAGE: 'SOCIAL_PAGE',
    OTHER_GAME_PAGE: 'OTHER_GAME_PAGE',
    HIDDEN: 'HIDDEN',
    NO_WEB: 'NO_WEB',
  }),
  DEFAULT_OBSERVATION_POLICY = Object.freeze({
    COMBAT_PAGE: {
      eventPollMs: 300,
      statePollMs: 5000,
      socialPollMs: 1000,
      positionPollMs: 500,
    },
    QUEST_PAGE: {
      eventPollMs: 1000,
      statePollMs: 5000,
      socialPollMs: 1000,
      positionPollMs: 0,
    },
    INVENTORY_PAGE: {
      eventPollMs: 2500,
      statePollMs: 5000,
      socialPollMs: 1000,
      positionPollMs: 0,
    },
    SOCIAL_PAGE: {
      eventPollMs: 5000,
      statePollMs: 5000,
      socialPollMs: 750,
      positionPollMs: 0,
    },
    OTHER_GAME_PAGE: {
      eventPollMs: 5000,
      statePollMs: 5000,
      socialPollMs: 1000,
      positionPollMs: 0,
    },
    IDLE_PAGE: {
      eventPollMs: 5000,
      statePollMs: 10000,
      socialPollMs: 2500,
      positionPollMs: 0,
    },
    HIDDEN: {
      eventPollMs: 15000,
      statePollMs: 0,
      socialPollMs: 10000,
      positionPollMs: 2000,
    },
    NO_WEB: {
      eventPollMs: 0,
      statePollMs: 0,
      socialPollMs: 0,
      positionPollMs: 0,
    },
  }),
  POLL_RETRY_MAX_MS = 5000,
  webViewerId = createWebViewerId();
let observationPolicy = DEFAULT_OBSERVATION_POLICY;
let authenticated = false,
  audioSaveTimer = null,
  petSettingsSaveTimer = null,
  sessionStartedAt = null,
  sessionEndedAt = null,
  statePoll = null,
  eventTimer = null,
  webActivityHeartbeatTimer = null,
  eventPollActive = false,
  eventPollRestartRequested = false,
  eventPollFailures = 0,
  positionTimer = null,
  positionInFlight = false,
  eventCursor = null,
  combatStreamConfig = {
    enabled: false,
    eligible: false,
    transport: 'polling',
  },
  combatStream = null,
  combatStreamActive = false,
  combatStreamReconnectTimer = null,
  combatStreamFailures = 0,
  combatStreamLastEventId = '',
  combatStreamSnapshotCursor = null,
  combatStreamRevision = 0,
  combatStreamReconnects = [],
  combatStreamSeenIds = new Set(),
  combatStreamRecoveryPromise = null,
  eventLines = [],
  socialTimer = null,
  socialPollFailures = 0,
  socialCursor = null,
  socialEvents = [],
  currentChatChannel = 'all',
  currentChatSendChannel = 'public',
  visibleChatChannels = (() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('ro-chat-visible-channels') || 'null',
      );
      const valid = Array.isArray(saved)
        ? saved.filter((channel) => chatChannelDefs[channel])
        : [];
      return new Set(valid.length ? valid : defaultVisibleChatChannels);
    } catch {
      return new Set(defaultVisibleChatChannels);
    }
  })(),
  chatReady = false,
  pendingChatRows = new Map(),
  pendingTaskEvents = [],
  taskCommandPendingUntil = 0,
  lastQuestFullRevision = null,
  mediaRecorder = null,
  voiceStream = null,
  voiceChunks = [],
  voiceStartedAt = 0,
  voiceStopTimer = null,
  currentCharacterName = '',
  lastState = null,
  gameEntryBootstrap = null,
  selectedCardBinId = null,
  selectedCardItemKey = null,
  selectedCardInventoryIndex = null,
  cardArtPreviewAnchor = null,
  cardArtPreviewReturnFocus = null,
  cardArtPreviewHideTimer = null,
  cardMergeReturnFocus = null,
  inventoryItemClickTimer = null,
  inventoryItems = [],
  pendingItemCommands = new Set(),
  inventoryCategory = 'consumable',
  lastEventAt = 0,
  currentRunning = false,
  mapField = null,
  mapFieldName = '',
  mapFieldError = '',
  mapInfoData = null,
  farmMapAvailabilityData = null,
  farmMapAvailabilityPromise = null,
  mapInfoCache = new Map(),
  mapInfoRenderedId = '',
  mapInfoLoadingId = '',
  mapInfoRequestId = 0,
  selectedWorldMapId = '',
  skillTreeData = null,
  skillTreeLayouts = null,
  skillUiAssets = null,
  lastSkillTreeSignature = '',
  skillControlsOpen = false,
  supplyCycleSettings = null,
  supplyRuleSignature = '',
  openSkillDescriptions = new Set(),
  openMapMonsters = new Set(),
  openMapDrops = new Set(),
  minimapLive = null,
  minimapFrame = null,
  minimapTerrain = null,
  minimapTerrainKey = '',
  minimapOriginalManager = null,
  minimapTracks = new Map(),
  minimapMotionLastMap = '',
  minimapMotionLastAuthoritativeAt = null,
  minimapMotionLastReceivedAt = null,
  minimapMotionGaps = [],
  minimapLastPaint = 0,
  minimapFreshness = null,
  minimapFreshnessTimer = null,
  minimapCombatObserved = true,
  minimapPlayerStale = false,
  lastLiveHp = null,
  damageFlashUntil = 0,
  damageFloatSequence = 0,
  officialDamageAssetsReady = false,
  damageAccumulation = new Map(),
  currentMusic = null,
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
let worldMapTravelPresentation = null;
let worldMapTravelModulePromise = null;
let worldMapOpenGeneration = 0;
let accountPreferences = null;
let availableItemIcons = null;
let itemIconManifestPromise = null;
const roAssetDebug = new URLSearchParams(location.search).has('debugAssets');
function roAssetTooltip(resolved, fallback = {}) {
  const id =
    resolved?.itemId ?? resolved?.skillId ?? resolved?.mobId ??
    resolved?.npcId ?? resolved?.mapId ?? fallback.itemId ?? fallback.id;
  const lines = [resolved?.name ?? fallback.name ?? '未辨識資產'];
  // Identifier and asset provenance are internal metadata: they stay out of the
  // player view and only appear for GM/debug tooling.
  if (roAssetDebug) {
    if (id !== null && id !== undefined) lines.push(`ID：${id}`);
    lines.push(
      resolved?.assetStatus === 'ready'
        ? '圖片來源：RO 原廠資產'
        : '圖片來源：待補',
    );
    if (resolved?.enName) lines.push(`英文：${resolved.enName}`);
    if (resolved?.aegisName) lines.push(`Aegis：${resolved.aegisName}`);
    lines.push(`查核等級：${resolved?.verificationGrade ?? resolved?.verification ?? 'X'}`);
  }
  return lines.join('\n');
}
const equipmentSlotLabels = Object.freeze({
  headTop: '頭上',
  headMid: '頭中',
  headLow: '頭下',
  armor: '鎧甲',
  rightHand: '右手',
  leftHand: '左手',
  garment: '披肩',
  robe: '披肩',
  shoes: '鞋子',
  accessoryLeft: '左飾品',
  accessoryRight: '右飾品',
  ammo: '彈藥',
});
function equipmentTooltip(resolved, fallback = {}, slot = null) {
  const name = resolved?.name ?? fallback.name ?? '未辨識裝備';
  const itemId = resolved?.itemId ?? fallback.itemId;
  const lines = [
    `${Number(fallback.refine) > 0 ? `+${Number(fallback.refine)} ` : ''}${name}`,
  ];
  if (roAssetDebug && itemId !== null && itemId !== undefined)
    lines.push(`道具 ID：${itemId}`);
  const slotName = equipmentSlotLabels[slot ?? fallback.slot ?? resolved?.equipSlot];
  if (slotName) lines.push(`裝備部位：${slotName}`);
  const attack = Number(resolved?.attack ?? fallback.attack);
  const defense = Number(resolved?.defense ?? fallback.defense);
  if (Number.isFinite(attack) && attack > 0) lines.push(`ATK：${attack}`);
  if (Number.isFinite(defense) && defense > 0) lines.push(`DEF：${defense}`);
  const slots = Number(resolved?.slots ?? fallback.slots ?? 0);
  lines.push(`插槽：${Number.isFinite(slots) ? slots : 0}`);
  const cards = fallback.cards ?? fallback.cardIds ?? [];
  if (Array.isArray(cards) && cards.length)
    lines.push(`卡片：${cards.filter(Boolean).join('、') || '無'}`);
  const description = resolved?.description ?? fallback.description;
  lines.push(`說明：${description || '【資料不足，無法確認】'}`);
  if (roAssetDebug) {
    if (resolved?.aegisName) lines.push(`Aegis：${resolved.aegisName}`);
    lines.push(`查核等級：${resolved?.verificationGrade ?? 'X'}`);
  }
  return lines.join('\n');
}
const show = (el, on = true) => el.classList.toggle('hidden', !on);
async function loadItemIconManifest() {
  if (!itemIconManifestPromise) {
    itemIconManifestPromise = fetch('/ro/client/manifest.json', {
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((manifest) => {
        availableItemIcons = new Set(
          (manifest.derived ?? [])
            .filter((entry) => entry.kind === 'item-icon-png')
            .map((entry) => entry.key),
        );
        window.roAssetResolver?.registerItemManifest(availableItemIcons);
      })
      .catch(() => {
        availableItemIcons = new Set();
      });
  }
  await itemIconManifestPromise;
}
function preloadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth && image.naturalHeight
        ? resolve(image)
        : reject(new Error(`空白圖片：${source}`));
    image.onerror = () => reject(new Error(`無法載入：${source}`));
    image.src = source;
  });
}
function decorateOfficialDamage(node) {
  const text = node.dataset.damageText ?? node.textContent?.trim() ?? '';
  node.dataset.damageText = text;
  if (!officialDamageAssetsReady || !/^\d+$/.test(text)) return;
  node.classList.add('has-official-digits');
  node.setAttribute('aria-label', text);
  const readable = document.createElement('span');
  readable.className = 'damage-readable';
  readable.textContent = text;
  const digits = [...text].map((digit) => {
    const image = document.createElement('img');
    image.className = 'official-damage-digit';
    image.src =
      node.classList.contains('critical') || node.classList.contains('total')
        ? officialDamageSources.criticalDigits[Number(digit)]
        : officialDamageSources.digits[Number(digit)];
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    return image;
  });
  node.replaceChildren(readable, ...digits);
  if (node.classList.contains('critical')) {
    const background = document.createElement('img');
    background.className = 'official-critical-background';
    background.src = officialDamageSources.criticalBackground;
    background.alt = '';
    background.setAttribute('aria-hidden', 'true');
    node.prepend(background);
  }
}
function createOfficialHitRays(container, motion, delay = 0) {
  if (!officialDamageAssetsReady) return;
  const rays = document.createElement('span');
  rays.className = 'official-hit-rays';
  rays.style.left = `${motion.originX}px`;
  rays.style.top = `${motion.originY}px`;
  rays.style.setProperty('--hit-ray-delay', `${delay}ms`);
  const angleRanges = [
    [0, 35],
    [50, 85],
    [100, 135],
    [150, 185],
    [200, 235],
    [255, 290],
    [300, 335],
    [340, 360],
  ];
  for (let index = 0; index < angleRanges.length; index += 1) {
    const ray = document.createElement('img');
    const [minimum, maximum] = angleRanges[index];
    ray.src = officialDamageSources.rays[index % 2];
    ray.alt = '';
    ray.setAttribute('aria-hidden', 'true');
    ray.style.setProperty(
      '--hit-ray-angle',
      `${minimum + Math.random() * (maximum - minimum)}deg`,
    );
    ray.style.setProperty(
      '--hit-ray-duration',
      `${200 + Math.round(Math.random() * 150)}ms`,
    );
    rays.append(ray);
  }
  container.append(rays);
  setTimeout(() => rays.remove(), delay + 450);
}
async function loadOfficialDamageAssets() {
  const status = $('#damageAssetStatus');
  try {
    await Promise.all(
      [
        ...officialDamageSources.digits,
        ...officialDamageSources.criticalDigits,
        officialDamageSources.criticalBackground,
        ...officialDamageSources.rays,
      ].map(preloadImage),
    );
    officialDamageAssetsReady = true;
    document.documentElement.classList.add('official-damage-assets');
    document
      .querySelectorAll('.damage-preview, .damage-preview-reference')
      .forEach(decorateOfficialDamage);
    if (status) status.textContent = '原廠 숫자.spr／msg.spr／EF_HIT2 已啟用';
    requestAnimationFrame(layoutDamageFloatPreview);
  } catch {
    if (status) status.textContent = '原廠傷害素材尚未匯入，目前保留相容顯示';
  }
}
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
      if (section.dataset.taskSection === 'completed') {
        if (collapsed) $('#completedQuestList').replaceChildren();
        else renderCompletedQuestList();
      }
    });
  });
}
const completedQuestSources = new Map();
function completedQuestItems() {
  return [...completedQuestSources.values()].flat();
}
function renderCompletedQuestList() {
  const root = $('#completedQuestList');
  const section = document.querySelector('[data-task-section="completed"]');
  if (!root || !section || section.classList.contains('is-collapsed')) return;
  const rows = completedQuestItems().map((quest) => {
    const row = document.createElement('div');
    const title = document.createElement('span');
    const category = document.createElement('small');
    row.className = 'completed-quest-entry';
    row.setAttribute('role', 'listitem');
    row.dataset.questId = quest.id;
    title.textContent = quest.title;
    category.textContent = quest.category;
    row.append(title, category);
    return row;
  });
  root.replaceChildren(...rows);
}
function syncCompletedQuestSection() {
  const section = document.querySelector('[data-task-section="completed"]');
  const button = section?.querySelector('.task-section-title');
  const countLabel = $('#completedQuestCount');
  const count = completedQuestItems().length;
  if (!section || !button || !countLabel) return;
  section.hidden = count === 0;
  countLabel.textContent = `（${count}）`;
  button.setAttribute('aria-label', `已完成任務，共 ${count} 個`);
  if (section.classList.contains('is-collapsed'))
    $('#completedQuestList').replaceChildren();
  else renderCompletedQuestList();
}
function setCompletedQuestSource(source, quests) {
  completedQuestSources.set(source, quests);
  syncCompletedQuestSection();
}
function resetCompletedQuestSection() {
  completedQuestSources.clear();
  const section = document.querySelector('[data-task-section="completed"]');
  const button = section?.querySelector('.task-section-title');
  if (section) {
    section.hidden = true;
    section.classList.add('is-collapsed');
  }
  if (button) button.setAttribute('aria-expanded', 'false');
  if ($('#completedQuestCount')) $('#completedQuestCount').textContent = '（0）';
  if ($('#completedQuestList')) $('#completedQuestList').replaceChildren();
}
function setRandomLoginBackground() {
  const verifiedBackgrounds = ['login-background-original'];
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  $('#auth').classList.add(
    verifiedBackgrounds[bytes[0] % verifiedBackgrounds.length],
  );
}
const webLatencyTrace = {
  enabled: false,
  records: [],
  hiddenAt: null,
};
const webExperienceTelemetry = {
  enabled: false,
  eligible: false,
  actions: new Set(),
  deploymentId: null,
};
let minimapTelemetryLastAt = 0;
let minimapTelemetryLastPosition = null;
let minimapFreshnessTelemetryLastAt = 0;

function minimapMotionApi() {
  const api = globalThis.minimapPresence;
  return api && typeof api.updateMotionTrack === 'function' ? api : null;
}

function minimapMotionRumSnapshot() {
  const api = minimapMotionApi();
  return api
    ? {
        ...api.summarizeMotionGaps(minimapMotionGaps),
        spikeLayer: 'UNKNOWN',
        model: 'SNAPSHOT_INTERPOLATION',
        maxExtrapolationMs: api.motionConfig.maxExtrapolationMs,
      }
    : {
        count: 0,
        p50: null,
        p95: null,
        p99: null,
        max: null,
        countGt500Ms: 0,
        countGt1000Ms: 0,
        countGt2000Ms: 0,
        spikeLayer: 'UNKNOWN',
        model: 'SNAPSHOT_INTERPOLATION',
        maxExtrapolationMs: 0,
      };
}
globalThis.minimapRUM = minimapMotionRumSnapshot;

function noteMinimapDeliveryGap(live, now) {
  const map = String(live?.map ?? '');
  const authoritativeAt = Number(
    live?.freshness?.authoritativeAt ?? live?.updatedAt,
  );
  if (!map || !Number.isFinite(authoritativeAt)) return null;
  if (
    minimapMotionLastMap === map &&
    minimapMotionLastAuthoritativeAt === authoritativeAt
  )
    return null;
  const gapMs =
    minimapMotionLastMap === map &&
    Number.isFinite(minimapMotionLastReceivedAt)
      ? Math.max(0, now - minimapMotionLastReceivedAt)
      : null;
  minimapMotionLastMap = map;
  minimapMotionLastAuthoritativeAt = authoritativeAt;
  minimapMotionLastReceivedAt = now;
  if (gapMs === null) return null;
  minimapMotionGaps.push(gapMs);
  if (minimapMotionGaps.length > 240) minimapMotionGaps.shift();
  globalThis.playerWebObservability?.record('MINIMAP', 'snapshot_gap_ms', gapMs, 'ms', { map });
  if (gapMs >= 500) globalThis.playerWebObservability?.record('MINIMAP', gapMs >= 2000 ? 'snapshot_gap_gt2000_ms' : gapMs >= 1000 ? 'snapshot_gap_gt1000_ms' : 'snapshot_gap_gt500_ms', gapMs, 'ms', { map });
  return gapMs;
}

function applyWebExperienceTelemetry(config = {}) {
  webExperienceTelemetry.enabled = config.enabled === true;
  webExperienceTelemetry.eligible = config.eligible === true;
  webExperienceTelemetry.actions = new Set(
    Array.isArray(config.actions) ? config.actions : [],
  );
  webExperienceTelemetry.deploymentId = config.deploymentId ?? null;
  globalThis.__webExperienceTelemetryConfig = { enabled: webExperienceTelemetry.enabled, eligible: webExperienceTelemetry.eligible };
  if (webExperienceTelemetry.enabled && webExperienceTelemetry.eligible && !globalThis.__playerWebObservabilityInitialRouteRecorded) {
    const navigation = performance.getEntriesByType('navigation')[0];
    const routeMs = Number(navigation?.loadEventEnd || navigation?.duration);
    if (Number.isFinite(routeMs)) {
      globalThis.playerWebObservability?.record('ROUTE_NAVIGATION', 'route_complete_ms', routeMs, 'ms', { source: 'navigation_timing' });
      globalThis.__playerWebObservabilityInitialRouteRecorded = true;
    }

  }
}

function telemetryActionForInteraction(name) {
  return {
    automation_start: 'automation_start',
    automation_stop: 'automation_stop',
    quest_page_open: 'quest_open',
    inventory_open: 'inventory_open',
    stat_allocate: 'stat_allocate',
    equip_item: 'equip_item',
    unequip_item: 'unequip_item',
    use_item: 'use_item',
    npc_dialog_action: 'npc_dialog_action',
    minimap_freshness: 'minimap_freshness',
  }[name] ?? null;
}

function browserDeviceClass() {
  if (window.innerWidth <= 600) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

function telemetryAuthorityDuration(trace) {
  const timing = trace?.requests?.at(-1)?.serverTiming ?? {};
  const stages = ['db', 'projection', 'bridge'];
  const values = stages.map((stage) => Number(timing[stage])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

// WEB_REAL_USER_EXPERIENCE_V1: batched, bounded, fail-soft browser telemetry
// transport. Never one HTTP request per frame; telemetry never blocks gameplay.
const webExperienceTelemetryQueue = [];
const WEB_EXPERIENCE_QUEUE_LIMIT = 24;
const WEB_EXPERIENCE_BATCH_AT = 8;
const WEB_EXPERIENCE_FLUSH_MS = 1500;
// The telemetry endpoint enforces an 8 KiB request body cap. Batch by BYTES as
// well as count so a realistic burst can never turn into a rejected 413 batch.
const WEB_EXPERIENCE_BATCH_BYTES = 6000;
let webExperienceTelemetryQueuedBytes = 0;
let webExperienceTelemetryFlushTimer = null;
function flushWebExperienceTelemetry() {
  if (webExperienceTelemetryFlushTimer !== null) {
    clearTimeout(webExperienceTelemetryFlushTimer);
    webExperienceTelemetryFlushTimer = null;
  }
  if (!webExperienceTelemetryQueue.length) {
    webExperienceTelemetryQueuedBytes = 0;
    return;
  }
  const events = webExperienceTelemetryQueue.splice(0, webExperienceTelemetryQueue.length);
  webExperienceTelemetryQueuedBytes = 0;
  try {
    void fetch('/api/web-experience/telemetry', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
    }).catch(() => {});
  } catch {}
}
function payloadByteSize(payload) {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}
function enqueueWebExperienceTelemetry(payload) {
  try {
    const size = payloadByteSize(payload);
    // Flush first when this payload would push the batch past the endpoint cap.
    if (
      webExperienceTelemetryQueue.length &&
      webExperienceTelemetryQueuedBytes + size > WEB_EXPERIENCE_BATCH_BYTES
    )
      flushWebExperienceTelemetry();
    webExperienceTelemetryQueue.push(payload);
    webExperienceTelemetryQueuedBytes += size;
    if (webExperienceTelemetryQueue.length > WEB_EXPERIENCE_QUEUE_LIMIT) {
      webExperienceTelemetryQueue.splice(
        0,
        webExperienceTelemetryQueue.length - WEB_EXPERIENCE_QUEUE_LIMIT,
      );
      webExperienceTelemetryQueuedBytes = webExperienceTelemetryQueue.reduce(
        (total, item) => total + payloadByteSize(item),
        0,
      );
    }
    if (webExperienceTelemetryQueue.length >= WEB_EXPERIENCE_BATCH_AT)
      flushWebExperienceTelemetry();
    else if (webExperienceTelemetryFlushTimer === null)
      webExperienceTelemetryFlushTimer = setTimeout(
        flushWebExperienceTelemetry,
        WEB_EXPERIENCE_FLUSH_MS,
      );
  } catch {}
}

function sendWebExperienceTelemetry(event) {
  if (!webExperienceTelemetry.enabled || !webExperienceTelemetry.eligible)
    return;
  const actionId = telemetryActionForInteraction(event.name) ?? event.actionId;
  try {
    const actionDomain =
      actionId === 'automation_start' || actionId === 'automation_stop'
        ? 'FARM_STATUS'
        : actionId === 'quest_open' || actionId === 'npc_dialog_action'
          ? 'QUEST_UI'
          : actionId === 'inventory_open' || actionId === 'equip_item' || actionId === 'unequip_item' || actionId === 'use_item'
            ? 'INVENTORY'
            : actionId === 'minimap_freshness'
              ? 'MINIMAP'
              : 'BROWSER_RENDER_HEALTH';
    const duration = Number(event.durationMs);
    if (Number.isFinite(duration))
      globalThis.playerWebObservability?.record(
        actionDomain,
        'action_duration_ms',
        duration,
        'ms',
        { actionId, success: event.success === true, error: event.error === true },
      );
  } catch {}
  if (!webExperienceTelemetry.actions.has(actionId)) return;
  const metric = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const payload = {
    actionId,
    durationMs: metric(event.durationMs),
    authorityDurationMs: metric(event.authorityDurationMs),
    visibleDurationMs: metric(event.visibleDurationMs),
    freshnessMs: metric(event.freshnessMs),
    success: event.success === true ? true : event.success === false ? false : null,
    error: event.error === true ? true : event.error === false ? false : null,
    reject: event.reject === true ? true : event.reject === false ? false : null,
    timeout: event.timeout === true ? true : event.timeout === false ? false : null,
    stale: event.stale === true ? true : event.stale === false ? false : null,
    deviceClass: browserDeviceClass(),
    authoritySource: event.authoritySource ?? 'WEB_ONLY',
    // V1 layer breakdown. Unknown fields are ignored by the legacy canary
    // pipeline and aggregated by the RUM read model.
    traceId: typeof event.traceId === 'string' ? event.traceId : null,
    requestStartedAt: metric(event.requestStartedAt),
    responseAt: metric(event.responseAt),
    authoritativeStateAt: metric(event.authoritativeStateAt),
    visibleAt: metric(event.visibleAt),
    serverMs: metric(event.serverMs),
    playerPerceivedMs: metric(event.playerPerceivedMs),
    errorCode: /^[A-Z0-9_]{1,64}$/.test(String(event.errorCode ?? ''))
      ? String(event.errorCode)
      : null,
  };
  enqueueWebExperienceTelemetry(payload);
}

// Shared Player Web interaction trace. Every V1 action uses this helper so
// request RTT / server / state convergence / render stay comparable.
const experienceTraceActions = new Set([
  'stat_allocate',
  'equip_item',
  'unequip_item',
  'use_item',
  'npc_dialog_action',
  'minimap_freshness',
]);
function beginExperienceTrace(actionId) {
  if (!experienceTraceActions.has(actionId)) return null;
  return {
    actionId,
    interactionId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    captureRequests: true,
    requests: [],
    startedAt: performance.now(),
    requestStartedAt: null,
    responseAt: null,
    authoritativeStateAt: null,
    visibleAt: null,
    serverMs: null,
    errorCode: null,
  };
}
function markExperienceRequest(trace) {
  if (!trace || trace.requestStartedAt !== null) return trace;
  trace.requestStartedAt = performance.now();
  return trace;
}
function experienceServerMs(trace) {
  const timing = trace?.requests?.at(-1)?.serverTiming ?? {};
  const app = Number(timing.app);
  if (Number.isFinite(app)) return app;
  return telemetryAuthorityDuration(trace);
}
function markExperienceResponse(trace) {
  if (!trace || trace.responseAt !== null) return trace;
  const last = trace.requests?.at(-1);
  trace.responseAt = performance.now();
  trace.serverMs = experienceServerMs(trace);
  // Prefer the real fetch start over the click time so request RTT excludes
  // any local queue wait.
  if (Number.isFinite(last?.requestStartMs))
    trace.requestStartedAt = trace.startedAt + last.requestStartMs;
  return trace;
}
function markExperienceAuthoritative(trace) {
  if (!trace || trace.authoritativeStateAt !== null) return trace;
  if (trace.responseAt === null) markExperienceResponse(trace);
  trace.authoritativeStateAt = performance.now();
  return trace;
}
async function settleExperienceTrace(trace, options = {}) {
  if (!trace) return;
  try {
    if (trace.requestStartedAt === null) trace.requestStartedAt = trace.startedAt;
    if (trace.responseAt === null) trace.responseAt = trace.requestStartedAt;
    if (trace.authoritativeStateAt === null)
      trace.authoritativeStateAt = trace.responseAt;
    if (trace.visibleAt === null)
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    if (trace.visibleAt === null) trace.visibleAt = performance.now();
    const perceived = trace.visibleAt - trace.startedAt;
    const success =
      options.success === true ? true : options.success === false ? false : null;
    sendWebExperienceTelemetry({
      actionId: trace.actionId,
      traceId: trace.traceId,
      requestStartedAt: trace.requestStartedAt - trace.startedAt,
      responseAt: trace.responseAt - trace.startedAt,
      authoritativeStateAt: trace.authoritativeStateAt - trace.startedAt,
      visibleAt: perceived,
      serverMs: trace.serverMs,
      durationMs: perceived,
      visibleDurationMs: perceived,
      authorityDurationMs: trace.serverMs,
      playerPerceivedMs: perceived,
      freshnessMs: Number.isFinite(Number(options.freshnessMs))
        ? Number(options.freshnessMs)
        : null,
      success,
      error: success === false ? true : null,
      reject: options.reject === true ? true : null,
      timeout: options.timeout === true ? true : null,
      stale: options.stale === true ? true : null,
      errorCode: options.errorCode ?? trace.errorCode ?? null,
      authoritySource: options.authoritySource ?? 'RATHENA_NATIVE',
    });
  } catch {}
}

// Bounded MutationObserver "visible update" probe. Used where a later state
// render (not the fetch resolution) is the real visible success signal.
// No full-page polling.
function observeVisibleChange(node, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!node || typeof MutationObserver !== 'function') {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (observed) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(observed);
    };
    const observer = new MutationObserver(() => finish(true));
    const timer = setTimeout(
      () => finish(false),
      Math.max(250, Number(timeoutMs) || 3000),
    );
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  });
}

function beginLatencyInteraction(name, options = {}) {
  return {
    interactionId: crypto.randomUUID(),
    name,
    startedAt: Number(options.startedAt ?? performance.now()),
    wallStartedAt: Date.now(),
    requests: [],
    metadata: { ...(options.metadata ?? {}) },
  };
}
function parseServerTiming(value) {
  return Object.fromEntries(
    String(value ?? '')
      .split(',')
      .map((entry) => {
        const name = entry.trim().match(/^([a-z][a-z0-9_-]*)/i)?.[1];
        const duration = Number(entry.match(/;dur=([0-9.]+)/i)?.[1]);
        return name && Number.isFinite(duration) ? [name, duration] : null;
      })
      .filter(Boolean),
  );
}
function latencyAssetGroup(pathname) {
  if (pathname.startsWith('/api/')) return 'api';
  if (/world-map/i.test(pathname)) return 'world-map';
  if (/\.(?:css|js)$/i.test(pathname)) return 'js-css';
  if (pathname.startsWith('/ro/client/')) return 'game-assets';
  return 'first-screen';
}
function latencyResourcesSince(startedAt) {
  const groups = {};
  for (const entry of performance.getEntriesByType('resource')) {
    if (entry.startTime < startedAt) continue;
    const pathname = new URL(entry.name, location.href).pathname;
    const group = latencyAssetGroup(pathname);
    const summary = groups[group] ?? {
      count: 0,
      durationMs: 0,
      transferBytes: 0,
      decodedBytes: 0,
    };
    summary.count += 1;
    summary.durationMs += Number(entry.duration ?? 0);
    summary.transferBytes += Number(entry.transferSize ?? 0);
    summary.decodedBytes += Number(entry.decodedBodySize ?? 0);
    groups[group] = summary;
  }
  return groups;
}
async function completeLatencyInteraction(trace, metadata = {}) {
  if (!trace) return;
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  const actionId = telemetryActionForInteraction(trace.name);
  sendWebExperienceTelemetry({
    name: trace.name,
    actionId,
    durationMs: performance.now() - trace.startedAt,
    visibleDurationMs: performance.now() - trace.startedAt,
    authorityDurationMs: telemetryAuthorityDuration(trace),
    success: metadata.success,
    error: metadata.error,
    reject: metadata.reject,
    timeout: metadata.timeout,
    stale: metadata.stale,
    freshnessMs: metadata.freshnessMs,
    authoritySource: metadata.authoritySource,
  });
  if (!webLatencyTrace.enabled) return;
  const navigation = performance.getEntriesByType('navigation')[0],
    record = {
    interactionId: trace.interactionId,
    name: trace.name,
    wallStartedAt: trace.wallStartedAt,
    actionToVisibleMs: performance.now() - trace.startedAt,
    requests: trace.requests,
    resources: latencyResourcesSince(trace.startedAt),
    navigation:
      trace.name === 'initial_entry' && navigation
        ? {
            requestStartMs: navigation.requestStart,
            responseStartMs: navigation.responseStart,
            responseEndMs: navigation.responseEnd,
            domInteractiveMs: navigation.domInteractive,
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadCompleteMs: navigation.loadEventEnd,
            transferBytes: Number(navigation.transferSize ?? 0),
            decodedBytes: Number(navigation.decodedBodySize ?? 0),
          }
        : undefined,
    metadata: { ...trace.metadata, ...metadata },
  };
  webLatencyTrace.records.push(record);
  if (webLatencyTrace.records.length > 200)
    webLatencyTrace.records.splice(0, webLatencyTrace.records.length - 200);
}
window.__webLatencyTrace = Object.freeze({
  enabled: () => webLatencyTrace.enabled,
  records: () => structuredClone(webLatencyTrace.records),
  clear: () => webLatencyTrace.records.splice(0),
});
const api = async (url, options = {}) => {
  const requestOptions = { cache: 'no-store', ...options },
    trace = requestOptions.latencyTrace ?? null,
    requestStartedAt = performance.now();
  delete requestOptions.latencyTrace;
  if (trace) {
    const headers = new Headers(requestOptions.headers ?? {});
    headers.set('x-interaction-id', trace.interactionId);
    requestOptions.headers = headers;
  }
  const r = await fetch(url, requestOptions),
    responseReceivedAt = performance.now(),
    traceEnabled = r.headers.get('x-web-latency-trace') === 'on';
  try {
    globalThis.playerWebObservability?.record(
      'HTTP_API',
      'request_duration_ms',
      responseReceivedAt - requestStartedAt,
      'ms',
      { endpoint: new URL(url, location.href).pathname, status: r.status },
    );
  } catch {}
  if (traceEnabled) webLatencyTrace.enabled = true;
  const responseContentType = r.headers.get('content-type') ?? '',
    responseText = await r.text();
  let data = null;
  if (
    /application\/json|\+json/i.test(responseContentType) ||
    /^\s*[\[{]/.test(responseText)
  ) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }
  if (trace && (traceEnabled || trace.captureRequests))
    trace.requests.push({
      endpoint: new URL(url, location.href).pathname,
      requestStartMs: requestStartedAt - trace.startedAt,
      responseReceivedMs: responseReceivedAt - trace.startedAt,
      durationMs: responseReceivedAt - requestStartedAt,
      serverTiming: parseServerTiming(r.headers.get('server-timing')),
      status: r.status,
    });
  if (!data || typeof data !== 'object') {
    const error = new Error(r.ok ? '回應格式暫時異常' : '操作失敗');
    error.status = r.status;
    error.code = 'NON_JSON_RESPONSE';
    error.responseContentType = responseContentType;
    error.responseBodyPrefix = responseText.slice(0, 200);
    throw error;
  }
  if (!r.ok) {
    const serverError = String(data.error || '操作失敗');
    const playerMessage = /openkore/i.test(serverError)
      ? '此角色的控制狀態需要處理，請聯絡管理員。'
      : /rathena|renewal/i.test(serverError)
        ? '操作暫時無法完成，請稍後再試。'
        : serverError;
    const error = new Error(playerMessage);
    error.status = r.status;
    error.code = data.code ?? serverError;
    error.payload = data;
    throw error;
  }
  return data;
};
const characterBaseStatKeys = Object.freeze([
  'str',
  'agi',
  'vit',
  'int',
  'dex',
  'luk',
]);
const liveFieldsByStateDomain = Object.freeze({
  vitals: Object.freeze([
    'updatedAt', 'lastCombatAt', 'name', 'jobId', 'baseLevel', 'jobLevel',
    'baseExp', 'jobExp', 'baseExpMax', 'jobExpMax', 'zeny', 'hp', 'maxHp',
    'sp', 'maxSp', 'weight', 'maxWeight', 'skillPoint',
    ...characterBaseStatKeys.map((key) => `${key}Bonus`),
  ]),
  stat: Object.freeze(['statusPoint', ...characterBaseStatKeys]),
  map: Object.freeze(['map', 'mapWidth', 'mapHeight', 'playerX', 'playerY']),
  combat: Object.freeze([
    'attack', 'attackBonus', 'matkMin', 'matkMax', 'def', 'defBonus',
    'mdef', 'mdefBonus', 'hit', 'flee', 'fleeBonus', 'critical', 'aspd',
    'monsters', 'players', 'supplyCycle',
  ]),
  inventory: Object.freeze([
    'inventory', 'skills', 'skillAutomation', 'basicSkillLevel',
    'basicSkillUpgradable',
  ]),
  quest: Object.freeze([
    'questMissions', 'questRuntimeAgent', 'edenJourney', 'onboarding',
    'npcDialog', 'jobRoute', 'grindHubTransition',
  ]),
  events: Object.freeze(['taskEvents']),
});
const stateDomainForLiveField = new Map(
  Object.entries(liveFieldsByStateDomain).flatMap(([domain, fields]) =>
    fields.map((field) => [field, domain]),
  ),
);
let lastInvalidCharacterStatSignature = '';
function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return false;
  return typeof value === 'number'
    ? Number.isFinite(value)
    : Number.isFinite(Number(value));
}
function reportInvalidCharacterStatPayload(character, derived, source) {
  const invalid = [
    ...characterBaseStatKeys.filter((key) => {
      const value = derived?.[key] ?? character?.[key];
      return !finiteNumber(value) || Number(value) < 1;
    }),
    ...(
      finiteNumber(derived?.statusPoint ?? character?.statusPoint) ? [] : ['statusPoint']
    ),
  ];
  if (!invalid.length) return true;
  const signature = `${source}:${invalid.join(',')}`;
  if (signature !== lastInvalidCharacterStatSignature) {
    lastInvalidCharacterStatSignature = signature;
    console.error('INVALID_CHARACTER_STAT_PAYLOAD', {
      source,
      invalid,
      partial: Boolean(character?.partial),
    });
  }
  return false;
}
function mergeDomainRevisions(previous, incoming) {
  const merged = { ...(previous ?? {}) };
  for (const [domain, value] of Object.entries(incoming ?? {})) {
    const revision = Number(value);
    if (!Number.isFinite(revision)) continue;
    merged[domain] = Math.max(Number(merged[domain] ?? 0), revision);
  }
  return merged;
}
function stateDomainIsFresh(previousRevisions, incomingRevisions, domain) {
  const incoming = Number(incomingRevisions?.[domain]);
  if (!Number.isFinite(incoming)) return true;
  const previous = Number(previousRevisions?.[domain]);
  return !Number.isFinite(previous) || incoming >= previous;
}
function mergeProjectedDerived(previous, incoming, source = 'delta') {
  if (!incoming) return previous ?? null;
  if (!previous) return incoming;
  const previousRevisions = previous.domainRevisions ?? {};
  const incomingRevisions = incoming.domainRevisions ?? {};
  const merged = { ...previous };
  for (const [field, value] of Object.entries(incoming)) {
    if (field === 'domainRevisions') continue;
    const domain = stateDomainForLiveField.get(field);
    if (
      domain &&
      !stateDomainIsFresh(previousRevisions, incomingRevisions, domain)
    ) {
      console.warn('STALE_DASHBOARD_STATE_IGNORED', {
        source,
        domain,
        field,
        incomingRevision: incomingRevisions[domain],
        currentRevision: previousRevisions[domain],
      });
      continue;
    }
    merged[field] = value;
  }
  merged.domainRevisions = mergeDomainRevisions(
    previousRevisions,
    incomingRevisions,
  );
  return merged;
}
function mergePartialCharacter(previous, incoming, derived) {
  const merged = { ...(previous ?? {}) };
  for (const [field, value] of Object.entries(incoming ?? {})) {
    if (
      characterBaseStatKeys.includes(field) &&
      (!finiteNumber(value) || Number(value) < 1)
    )
      continue;
    merged[field] = value;
  }
  for (const field of characterBaseStatKeys)
    if (finiteNumber(derived?.[field]) && Number(derived[field]) >= 1)
      merged[field] = Number(derived[field]);
  if (finiteNumber(derived?.statusPoint))
    merged.statusPoint = Number(derived.statusPoint);
  if (finiteNumber(derived?.skillPoint))
    merged.skillPoint = Number(derived.skillPoint);
  return merged;
}
function mergeDashboardState(previous, incoming, source = 'state') {
  if (!previous) return incoming;
  if (
    previous.character?.charId !== undefined &&
    incoming.character?.charId !== undefined &&
    Number(previous.character.charId) !== Number(incoming.character.charId)
  )
    return incoming;
  const previousRevisions =
    previous?.domainRevisions ?? previous?.derived?.domainRevisions ?? {};
  const incomingRevisions =
    incoming?.domainRevisions ?? incoming?.derived?.domainRevisions ?? {};
  const derived = mergeProjectedDerived(
    previous?.derived,
    incoming.derived,
    source,
  );
  const merged = {
    ...previous,
    ...incoming,
    derived,
    character: mergePartialCharacter(
      previous?.character,
      incoming.character,
      derived,
    ),
    domainRevisions: mergeDomainRevisions(
      previousRevisions,
      incomingRevisions,
    ),
  };
  if (
    !stateDomainIsFresh(previousRevisions, incomingRevisions, 'inventory')
  ) {
    merged.inventory = previous?.inventory ?? [];
    merged.equipment = previous?.equipment ?? [];
  }
  reportInvalidCharacterStatPayload(merged.character, merged.derived, source);
  return merged;
}
function characterCommandMeta(domain) {
  const revision = Number(
    lastState?.derived?.domainRevisions?.[domain] ??
      lastState?.domainRevisions?.[domain],
  );
  return {
    commandId: crypto.randomUUID(),
    characterId: Number(lastState?.character?.charId),
    ...(Number.isSafeInteger(revision) && revision >= 0
      ? { expectedRevision: revision }
      : {}),
  };
}
function cloneDashboardState(state) {
  return state
    ? {
        ...state,
        character: state.character ? { ...state.character } : state.character,
        derived: state.derived
          ? {
              ...state.derived,
              domainRevisions: {
                ...(state.derived.domainRevisions ?? {}),
              },
              skills: state.derived.skills?.map((skill) => ({ ...skill })),
              inventory: state.derived.inventory?.map((item) => ({ ...item })),
            }
          : state.derived,
        inventory: state.inventory?.map((item) => ({ ...item })),
        equipment: state.equipment?.map((item) => ({ ...item })),
      }
    : state;
}
const bodyAsset = (c) =>
  `/ro/client/paperdoll/novice-${c.sex === 'F' ? 'female' : 'male'}.png`;
const paperdollAsset = (sex, hair = 1) => {
  const style = Math.max(1, Math.min(42, Number(hair) || 1));
  return `/ro/client/paperdoll/novice-${sex === 'F' ? 'female' : 'male'}-hair-${style}.png`;
};
const showcaseJobKeys = Object.freeze({
  0: 'novice',
  1: 'swordsman',
  2: 'mage',
  3: 'archer',
  4: 'acolyte',
  5: 'merchant',
  6: 'thief',
  21: 'taekwon',
  4046: 'taekwon',
  23: 'supernovice',
  24: 'gunslinger',
  25: 'ninja',
});
const showcaseActionLabels = Object.freeze({
  stand: '站立',
  walk: '走路',
  sit: '坐下',
  attack: '攻擊',
});
const showcaseDirectionLabels = [
  '正面',
  '左前方',
  '左側',
  '左後方',
  '背面',
  '右後方',
  '右側',
  '右前方',
];
const showcaseCycleDuration = 10000;
const showcaseManualPauseDuration = 60000;
const showcasePreloads = new Map();
const characterShowcase = {
  manifest: null,
  loading: null,
  character: null,
  action: 'stand',
  direction: 0,
  actionStartedAt: performance.now(),
  nextCycleAt: performance.now() + showcaseCycleDuration,
  dragging: false,
  lastPointerX: 0,
  lastUiSignature: '',
  equipment: [],
  assetsReady: false,
  preloadGeneration: 0,
  loadedSignature: '',
};
const rankingJobIds = Object.freeze([0, 1, 2, 3, 4, 5, 6, 21, 23, 24, 25, 4046]);
const rankingState = {
  classId: null,
  loading: false,
  loaded: false,
  entries: [],
  generatedAt: 0,
};

function showcaseAsset(layer, action, equipment = characterShowcase.equipment) {
  const rightHand = equipment.find((item) => item.slot === 'rightHand');
  const resolvedWeapon = rightHand
    ? window.roAssetResolver?.resolveEquipmentAsset(rightHand)
    : null;
  const hasBow = String(rightHand?.weaponType ?? resolvedWeapon?.weaponType ?? '')
    .toLocaleLowerCase('en') === 'bow';
  const actionKey = action === 'attack' && hasBow ? 'bowAttack' : action;
  const entry = layer?.[actionKey] ?? layer?.[action] ?? layer?.stand;
  return entry?.src ? entry : null;
}

function createItemIcon(item, preResolved = null) {
  const holder = document.createElement('span');
  holder.className = 'item-icon item-icon-fallback item-icon-missing';
  holder.textContent = '?';
  holder.dataset.itemIconStatus = 'missing';
  holder.title = `圖示待補：${String(item?.name ?? `道具 #${item?.itemId ?? '?'}`)}`;
  holder.setAttribute('aria-hidden', 'true');
  const resolved = preResolved ?? window.roAssetResolver?.resolveItemAsset(item);
  const source = resolved?.asset?.webPath;
  holder.title = roAssetTooltip(resolved, item);
  holder.dataset.assetDiagnostic = resolved?.diagnosticCode ?? '';
  if (!source) return holder;
  const image = document.createElement('img');
  image.src = source;
  image.alt = '';
  image.onload = () => {
    holder.classList.add('item-icon-loaded');
    holder.classList.remove('item-icon-missing');
    holder.dataset.itemIconStatus = 'loaded';
  };
  image.onerror = () => {
    holder.classList.add('item-icon-missing');
    holder.dataset.itemIconStatus = 'load-error';
    image.remove();
  };
  holder.append(image);
  return holder;
}

function verifiedCardArt(resolved) {
  const asset =
    resolved?.asset?.assetRole === 'card-art' ? resolved.asset : resolved?.cardArt;
  if (
    resolved?.category !== 'card' ||
    resolved?.assetStatus !== 'ready' ||
    asset?.verified !== true ||
    asset?.assetRole !== 'card-art' ||
    Number(asset.sourceWidth) !== 300 ||
    Number(asset.sourceHeight) !== 400 ||
    !asset.webPath
  )
    return null;
  return {
    source: asset.webPath,
    width: Number(asset.sourceWidth) || 300,
    height: Number(asset.sourceHeight) || 400,
  };
}

// Description art priority for the shared detail panel: original collection
// art, then card illustration, then the bounded inventory-icon fallback.
function descriptionArtOf(resolved) {
  const collectionArt = resolved?.collectionArt;
  if (
    collectionArt?.verified === true &&
    collectionArt?.assetRole === 'collection-art' &&
    collectionArt.webPath
  )
    return { asset: collectionArt, role: 'collection-art' };
  const cardArt = resolved?.cardArt ?? (resolved?.asset?.assetRole === 'card-art' ? resolved.asset : null);
  if (cardArt?.verified === true && cardArt?.assetRole === 'card-art' && cardArt.webPath)
    return { asset: cardArt, role: 'card-art' };
  const icon = resolved?.asset;
  if (icon?.webPath) return { asset: icon, role: icon.assetRole ?? 'item-icon' };
  return null;
}

function attachCardArtPreviewData(node, item, resolved) {
  const art = verifiedCardArt(resolved);
  if (!art) return null;
  const name = resolved.name ?? item.name ?? `卡片 #${item.itemId}`;
  node.dataset.cardArtSource = art.source;
  node.dataset.cardArtName = name;
  node.dataset.cardArtItemId = String(resolved.itemId ?? item.itemId ?? '');
  node.dataset.cardArtWidth = String(art.width);
  node.dataset.cardArtHeight = String(art.height);
  node.dataset.itemAssetRole = 'card-art';
  node.dataset.itemDescription = resolved.description ?? item.description ?? '';
  node.dataset.itemCategory = item.category ?? resolved.category ?? 'card';
  node.dataset.itemBinId = item.binId ?? '';
  node.dataset.itemKey = item.itemKey ?? '';
  node.dataset.itemAction = item.category === 'card' ? 'card' : '';
  node.__roItemDetail = { item, resolved };
  return art;
}

function attachItemDetailData(node, item, resolved) {
  const art = descriptionArtOf(resolved);
  if (!art) return null;
  const asset = art.asset;
  node.dataset.cardArtSource = asset.webPath;
  node.dataset.cardArtName = resolved.name ?? item.name ?? `道具 #${item.itemId ?? '?'}`;
  node.dataset.cardArtItemId = String(resolved.itemId ?? item.itemId ?? '');
  node.dataset.cardArtWidth = String(Number(asset.sourceWidth) || 32);
  node.dataset.cardArtHeight = String(Number(asset.sourceHeight) || 32);
  node.dataset.itemAssetRole = art.role;
  node.dataset.itemDescription = resolved.description ?? item.description ?? '';
  node.dataset.itemCategory = item.category ?? resolved.category ?? '';
  node.dataset.itemBinId = item.binId ?? '';
  node.dataset.itemKey = item.itemKey ?? '';
  node.dataset.itemAction =
    item.category === 'card'
      ? 'card'
      : item.category === 'equipment'
        ? item.equipped ? 'unequip' : item.canEquip === false ? '' : 'equip'
        : item.usable ? 'use' : '';
  node.__roItemDetail = { item, resolved };
  return asset;
}

function cardArtTouchMode() {
  return matchMedia('(hover: none), (pointer: coarse), (max-width: 650px)').matches;
}

function cardArtPreviewSourceNode(target) {
  return target instanceof Element
    ? target.closest('[data-card-art-source]')
    : null;
}

function positionCardArtPreview(anchor) {
  const panel = $('#cardArtPreviewPanel');
  if (!panel || !anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 8;
  const fitsRight = anchorRect.right + gap + panelRect.width <= innerWidth - 8;
  const left = fitsRight
    ? anchorRect.right + gap
    : Math.max(8, anchorRect.left - panelRect.width - gap);
  const top = Math.max(
    8,
    Math.min(anchorRect.top, innerHeight - panelRect.height - 8),
  );
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function openCardArtPreview(anchor, forceMobile = cardArtTouchMode()) {
  const sourceNode = cardArtPreviewSourceNode(anchor);
  const preview = $('#cardArtPreview');
  if (!sourceNode || !preview) return;
  clearTimeout(cardArtPreviewHideTimer);
  cardArtPreviewAnchor = sourceNode;
  const detail = sourceNode.__roItemDetail ?? {
    item: {
      itemId: sourceNode.dataset.cardArtItemId,
      name: sourceNode.dataset.cardArtName,
      description: sourceNode.dataset.itemDescription,
    },
    resolved: {
      itemId: sourceNode.dataset.cardArtItemId,
      name: sourceNode.dataset.cardArtName,
      description: sourceNode.dataset.itemDescription,
      asset: sourceNode.dataset.cardArtSource
        ? {
            webPath: sourceNode.dataset.cardArtSource,
            assetRole: sourceNode.dataset.itemAssetRole,
            sourceWidth: Number(sourceNode.dataset.cardArtWidth) || undefined,
            sourceHeight: Number(sourceNode.dataset.cardArtHeight) || undefined,
            verified: true,
          }
        : null,
    },
  };
  const roItemDetail = window.RoOriginalUiKit?.RoItemDetail;
  const detailItem = {
    ...(detail.item ?? {}),
    amount:
      detail.item?.amount ??
      (Number.isFinite(Number(sourceNode.dataset.itemAmount))
        ? Number(sourceNode.dataset.itemAmount)
        : undefined),
  };
  const model = roItemDetail?.buildModel(detailItem, detail.resolved);
  if (model) roItemDetail.render(preview, model);
  const actionButton = $('#cardArtPreviewAction');
  const fallbackAction = sourceNode.dataset.blockedReason
    ? ''
    : sourceNode.dataset.action || '';
  const action = sourceNode.dataset.itemAction || fallbackAction;
  actionButton.classList.toggle('hidden', !action);
  actionButton.dataset.itemAction = action;
  const actionLabel = action === 'card'
    ? '插入卡片'
    : action === 'equip'
      ? '穿上裝備'
      : action === 'unequip'
        ? '卸下裝備'
        : '使用道具';
  actionButton.setAttribute('aria-label', actionLabel);
  actionButton.title = actionLabel;
  actionButton.disabled = false;
  preview.classList.toggle('mobile', forceMobile);
  preview.classList.toggle('anchored', !forceMobile);
  preview.classList.toggle('actionable', Boolean(action));
  preview.classList.remove('hidden');
  preview.setAttribute('role', forceMobile || action ? 'dialog' : 'tooltip');
  if (forceMobile) {
    preview.setAttribute('aria-modal', 'true');
    cardArtPreviewReturnFocus = document.activeElement;
    $('#cardArtPreviewClose')?.focus({ preventScroll: true });
  } else {
    preview.removeAttribute('aria-modal');
    positionCardArtPreview(sourceNode.closest('.inventory-item') ?? sourceNode);
  }
}

function closeCardArtPreview({ restoreFocus = true } = {}) {
  const preview = $('#cardArtPreview');
  if (!preview || preview.classList.contains('hidden')) return;
  const wasMobile = preview.classList.contains('mobile');
  preview.classList.add('hidden');
  preview.classList.remove('mobile', 'anchored');
  $('#cardArtPreviewImage').removeAttribute('src');
  cardArtPreviewAnchor = null;
  if (wasMobile && restoreFocus && cardArtPreviewReturnFocus instanceof HTMLElement)
    cardArtPreviewReturnFocus.focus({ preventScroll: true });
  cardArtPreviewReturnFocus = null;
}

function scheduleCardArtPreviewClose() {
  clearTimeout(cardArtPreviewHideTimer);
  cardArtPreviewHideTimer = setTimeout(
    () => closeCardArtPreview({ restoreFocus: false }),
    90,
  );
}

function setupCardArtPreview() {
  const openInventoryDetail = (source) => {
    clearTimeout(inventoryItemClickTimer);
    if (cardArtTouchMode()) openCardArtPreview(source, true);
    else inventoryItemClickTimer = setTimeout(() => openCardArtPreview(source, true), 240);
  };
  document.addEventListener('pointerover', (event) => {
    if (cardArtTouchMode()) return;
    const source = cardArtPreviewSourceNode(event.target);
    if (source && source !== cardArtPreviewAnchor) openCardArtPreview(source, false);
  });
  document.addEventListener('pointerout', (event) => {
    if (cardArtTouchMode()) return;
    const source = cardArtPreviewSourceNode(event.target);
    const panel = $('#cardArtPreviewPanel');
    if (panel?.contains(event.relatedTarget)) {
      clearTimeout(cardArtPreviewHideTimer);
      return;
    }
    if (!source || source.contains(event.relatedTarget)) return;
    scheduleCardArtPreviewClose();
  });
  $('#cardArtPreviewPanel')?.addEventListener('pointerover', () => {
    clearTimeout(cardArtPreviewHideTimer);
  });
  document.addEventListener('focusin', (event) => {
    if (!cardArtTouchMode() && event.target.closest?.('.card-art-trigger'))
      openCardArtPreview(event.target, false);
  });
  document.addEventListener('focusout', (event) => {
    if (!cardArtTouchMode() && event.target.closest?.('.card-art-trigger'))
      scheduleCardArtPreviewClose();
  });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('.card-art-trigger');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      if (trigger.closest('.inventory-item')) openInventoryDetail(trigger);
      else openCardArtPreview(trigger, cardArtTouchMode());
      return;
    }
    const inventoryItem = event.target.closest?.('.inventory-item[data-card-art-source]');
    if (inventoryItem) {
      event.preventDefault();
      openInventoryDetail(inventoryItem);
      return;
    }
    if (
      event.target.closest?.('[data-card-preview-close]') ||
      event.target === $('#cardArtPreview')
    )
      closeCardArtPreview();
  });
  $('#cardArtPreviewAction')?.addEventListener('click', () => {
    const source = cardArtPreviewAnchor?.closest('.inventory-item') ?? cardArtPreviewAnchor;
    if (!source) return;
    const actionButton = $('#cardArtPreviewAction');
    const action = actionButton.dataset.itemAction;
    actionButton.disabled = true;
    closeCardArtPreview({ restoreFocus: false });
    if (action === 'card') openCardMergeDialog(source);
    else source.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
  document.addEventListener('dblclick', (event) => {
    if (event.target.closest?.('.inventory-item')) clearTimeout(inventoryItemClickTimer);
  }, true);
  addEventListener('resize', () => {
    if ($('#cardArtPreview')?.classList.contains('anchored') && cardArtPreviewAnchor)
      positionCardArtPreview(cardArtPreviewAnchor.closest('.inventory-item') ?? cardArtPreviewAnchor);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#cardArtPreview')?.classList.contains('hidden'))
      closeCardArtPreview();
  });
}

// SERVER_AGENT inventory items carry no binId/itemKey: their authoritative
// identity is the inventory slot index. These helpers let every inventory
// action resolve identity by itemKey, otherwise binId, otherwise
// inventoryIndex, so native SERVER_AGENT mutations work from the Web UI.
function inventoryIdentityOf(item) {
  return {
    itemKey: item?.itemKey || '',
    binId: Number.isInteger(item?.binId) ? Number(item.binId) : null,
    inventoryIndex: Number.isInteger(item?.inventoryIndex)
      ? Number(item.inventoryIndex)
      : null,
  };
}
function hasInventoryIdentity(identity) {
  return Boolean(identity?.itemKey)
    || identity?.binId !== null
    || identity?.inventoryIndex !== null;
}
function inventoryMatchesIdentity(entry, identity) {
  if (!entry || !identity) return false;
  if (identity.itemKey) return entry.itemKey === identity.itemKey;
  if (identity.inventoryIndex !== null && Number.isInteger(entry.inventoryIndex))
    return Number(entry.inventoryIndex) === identity.inventoryIndex;
  if (identity.binId !== null) return Number(entry.binId) === identity.binId;
  return false;
}
function inventoryIdentityKey(identity) {
  if (!identity) return '';
  if (identity.itemKey) return identity.itemKey;
  if (identity.inventoryIndex !== null) return `i${identity.inventoryIndex}`;
  if (identity.binId !== null) return String(identity.binId);
  return '';
}
function nodeInventoryIdentity(node) {
  const itemKey = node.dataset.itemKey || '';
  const binId = node.dataset.binId === '' || node.dataset.binId === undefined
    ? NaN
    : Number(node.dataset.binId);
  const inventoryIndex = node.dataset.inventoryIndex === ''
    || node.dataset.inventoryIndex === undefined
    ? NaN
    : Number(node.dataset.inventoryIndex);
  return {
    itemKey,
    binId: Number.isInteger(binId) ? binId : null,
    inventoryIndex: Number.isInteger(inventoryIndex)
      ? Number(inventoryIndex)
      : null,
  };
}
function selectedCardIdentity() {
  return {
    itemKey: selectedCardItemKey || '',
    binId: Number.isInteger(selectedCardBinId) ? selectedCardBinId : null,
    inventoryIndex: Number.isInteger(selectedCardInventoryIndex)
      ? selectedCardInventoryIndex
      : null,
  };
}

function compatibleCardTargets(cardItem) {
  const card = window.roAssetResolver?.resolveItemAsset(cardItem);
  const allowedLocations = new Set(card?.equipLocations ?? []);
  if (!allowedLocations.size) return [];
  return inventoryItems.flatMap((item) => {
    if (
      item.category !== 'equipment' ||
      !item.equippable ||
      !hasInventoryIdentity(inventoryIdentityOf(item))
    ) return [];
    const equipment = window.roAssetResolver?.resolveEquipmentAsset(item);
    const slots = Number(equipment?.slots ?? item.slots ?? 0);
    const cardIds = Array.isArray(item.cardIds) ? item.cardIds : [];
    const occupied = cardIds.filter((id) => Number(id) > 0 && ![254, 255].includes(Number(id))).length;
    const matchingLocation = (equipment?.equipLocations ?? []).some((location) =>
      allowedLocations.has(location));
    if (!matchingLocation || slots <= occupied) return [];
    return [{ item, equipment, availableSlots: slots - occupied, slots }];
  });
}

function closeCardMergeDialog({ restoreFocus = true, clearSelection = true } = {}) {
  const dialog = $('#cardMergeDialog');
  if (!dialog || dialog.classList.contains('hidden')) return;
  dialog.classList.add('hidden');
  if (clearSelection) {
    selectedCardBinId = null;
    selectedCardItemKey = null;
    selectedCardInventoryIndex = null;
    document.querySelectorAll('.inventory-item.card-selected')
      .forEach((entry) => entry.classList.remove('card-selected'));
  }
  if (restoreFocus && cardMergeReturnFocus instanceof HTMLElement)
    cardMergeReturnFocus.focus({ preventScroll: true });
  cardMergeReturnFocus = null;
}

function openCardMergeDialog(cardNode) {
  const identity = nodeInventoryIdentity(cardNode);
  const binId = identity.binId ?? NaN;
  const itemKey = identity.itemKey;
  const cardItem = inventoryItems.find((entry) =>
    inventoryMatchesIdentity(entry, identity));
  if (!cardItem) {
    setItemActionNotice('遊戲伺服器尚未同步此卡片');
    return;
  }
  const resolvedCard = window.roAssetResolver?.resolveItemAsset(cardItem);
  selectedCardBinId = identity.binId;
  selectedCardItemKey = identity.itemKey;
  selectedCardInventoryIndex = identity.inventoryIndex;
  document.querySelectorAll('.inventory-item.card-selected')
    .forEach((entry) => entry.classList.toggle('card-selected', entry === cardNode));
  $('#cardMergeTitle').textContent = `插入 ${resolvedCard?.name ?? cardItem.name}`;
  $('#cardMergeDialog').dataset.cardBinId = String(binId);
  const candidates = compatibleCardTargets(cardItem);
  $('#cardMergeList').replaceChildren(
    ...(candidates.length ? candidates.map(({ item, equipment, availableSlots, slots }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-merge-candidate';
      button.append(createItemIcon(item, equipment));
      const copy = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = `${Number(item.refine) > 0 ? `+${Number(item.refine)} ` : ''}${equipment?.name ?? item.name}`;
      const meta = document.createElement('small');
      meta.textContent = `可用插槽 ${availableSlots}／${slots}`;
      copy.append(name, meta);
      button.append(copy);
      button.addEventListener('click', () => {
        closeCardMergeDialog({ restoreFocus: false, clearSelection: false });
        const targetIdentity = inventoryIdentityOf(item);
        const target = [...document.querySelectorAll('.inventory-item[data-category="equipment"]')]
          .find((node) => inventoryMatchesIdentity(nodeInventoryIdentity(node), targetIdentity));
        if (!target) {
          selectedCardBinId = null;
          selectedCardItemKey = null;
          selectedCardInventoryIndex = null;
          setItemActionNotice('裝備資料已更新，請重新選擇卡片');
          return;
        }
        target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      return button;
    }) : [Object.assign(document.createElement('p'), {
      className: 'card-merge-empty',
      textContent: '身上目前沒有可插入此卡片且仍有空洞的裝備。',
    })]),
  );
  cardMergeReturnFocus = document.activeElement;
  $('#cardMergeDialog').classList.remove('hidden');
  $('#cardMergeClose')?.focus({ preventScroll: true });
}

function setupCardMergeDialog() {
  $('#cardMergeClose')?.addEventListener('click', () => closeCardMergeDialog());
  $('#cardMergeCancel')?.addEventListener('click', () => closeCardMergeDialog());
  $('#cardMergeDialog')?.addEventListener('click', (event) => {
    if (event.target === $('#cardMergeDialog')) closeCardMergeDialog();
  });
}

function showcaseLayersFor(c, equipment = []) {
  const manifest = characterShowcase.manifest;
  if (!manifest || !c) return {};
  return window.roAssetResolver?.resolvePaperDoll(
    { character: c, equipment },
    manifest,
  ).layers ?? {};
}

function currentShowcaseLayers() {
  return showcaseLayersFor(
    characterShowcase.character,
    characterShowcase.equipment,
  );
}

function preloadShowcaseSource(source) {
  if (!source) return Promise.resolve();
  if (!showcasePreloads.has(source)) {
    showcasePreloads.set(
      source,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      }),
    );
  }
  return showcasePreloads.get(source);
}

async function preloadCharacterShowcase() {
  const c = characterShowcase.character;
  if (!characterShowcase.manifest || !c) return;
  const signature = `${c.classId}|${c.sex}|${c.hair}|${characterShowcase.equipment.map((item) => `${item.slot}:${item.itemId}`).join(',')}`;
  if (characterShowcase.loadedSignature === signature) {
    characterShowcase.assetsReady = true;
    return;
  }
  const generation = ++characterShowcase.preloadGeneration;
  characterShowcase.assetsReady = false;
  $('#paperdollStage')?.classList.add('showcase-fallback');
  const sources = new Set();
  for (const layer of Object.values(currentShowcaseLayers())) {
    for (const actionName of Object.keys(showcaseActionLabels)) {
      const asset = showcaseAsset(layer, actionName);
      for (const source of [asset?.src, asset?.backSrc, asset?.frontSrc])
        if (source) sources.add(source);
    }
  }
  try {
    await Promise.all([...sources].map(preloadShowcaseSource));
    if (generation !== characterShowcase.preloadGeneration) return;
    characterShowcase.loadedSignature = signature;
    characterShowcase.assetsReady = true;
    renderCharacterShowcase();
  } catch {
    if (generation === characterShowcase.preloadGeneration)
      characterShowcase.assetsReady = false;
  }
}

// Attachment basis. HEAD, HAIR, UPPER_HEADGEAR, MID_HEADGEAR and
// LOWER_HEADGEAR are all ordinary layers of one character rig, so every layer is
// placed by aligning its own per-frame anchor onto the *body's resolved frame
// anchor*. This is a single shared head/neck basis: headgear can never compute
// its own independent transform. When a layer ships fewer frames than the body
// it holds its closest authored frame for the sprite, but the reference anchor
// always comes from the body frame the character is actually rendering, so the
// layer stays welded to the head instead of drifting a frame behind.
function layerAnchorOffset(
  asset,
  reference,
  direction,
  layerFrame,
  referenceFrame = layerFrame,
) {
  const ownFrames = asset?.anchors?.[direction] ?? [];
  const referenceFrames = reference?.anchors?.[direction] ?? [];
  const own = ownFrames.length
    ? ownFrames[layerFrame % ownFrames.length]
    : null;
  const target = referenceFrames.length
    ? referenceFrames[referenceFrame % referenceFrames.length]
    : null;
  return own && target
    ? { x: target.offsetX - own.offsetX, y: target.offsetY - own.offsetY }
    : { x: 0, y: 0 };
}

function paintShowcaseLayer(element, asset, pose, source = asset?.src) {
  if (!element) return false;
  if (!asset || !source) {
    delete element.dataset.showcaseFrame;
    element.style.backgroundImage = '';
    element.style.transform = '';
    return false;
  }
  // Single canonical pose: every body/hair/equipment layer renders the exact
  // frame index and direction the body is rendering. A layer never advances its
  // own animation clock, so it cannot lag or drift a state behind the body; if
  // it has fewer authored frames it holds the closest valid frame instead of
  // cycling independently off the head.
  const count = Math.max(1, Number(asset.frameCounts?.[pose.direction] ?? 1));
  const safeFrame = Math.min(pose.frame, count - 1);
  const anchor = layerAnchorOffset(
    asset,
    pose.bodyAsset,
    pose.direction,
    safeFrame,
    pose.frame,
  );
  const frameKey = `${source}|${pose.direction}|${safeFrame}|${anchor.x}|${anchor.y}`;
  if (element.dataset.showcaseFrame !== frameKey) {
    element.dataset.showcaseFrame = frameKey;
    element.style.backgroundImage = `url("${source}")`;
    element.style.backgroundPosition = `${-safeFrame * 96}px ${-pose.direction * 160}px`;
    element.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`;
  }
  return true;
}

// Authoritative pose state for the paperdoll. Action, direction, frame index
// and the body anchor are resolved exactly once per render, and every layer is
// painted against this single object.
function showcasePose(now = performance.now()) {
  const layers = currentShowcaseLayers();
  const bodyAsset = showcaseAsset(layers.body, characterShowcase.action);
  const direction = characterShowcase.direction;
  const frameCount = Math.max(
    1,
    Number(bodyAsset?.frameCounts?.[direction] ?? 1),
  );
  const frame = ['stand', 'sit'].includes(characterShowcase.action)
    ? 0
    : Math.floor(
        (now - characterShowcase.actionStartedAt) /
          Math.max(25, Number(bodyAsset?.delay ?? 100)),
      ) % frameCount;
  return { action: characterShowcase.action, direction, frame, frameCount, bodyAsset, layers };
}

function renderCharacterShowcase(now = performance.now()) {
  const stage = $('#paperdollStage');
  const manifest = characterShowcase.manifest;
  const c = characterShowcase.character;
  if (!stage || !manifest || !c) return;
  if (!characterShowcase.assetsReady) {
    stage.classList.add('showcase-fallback');
    return;
  }
  const pose = showcasePose(now);
  const { hair, headTop, headMid, headLow, weapon, shield } = pose.layers;
  const bodyReady = paintShowcaseLayer(
    $('#paperdollBodyLayer'),
    pose.bodyAsset,
    pose,
  );
  const hairAsset = showcaseAsset(hair, pose.action);
  paintShowcaseLayer(
    $('#paperdollHairBackLayer'),
    hairAsset,
    pose,
    hairAsset?.backSrc,
  );
  const hairReady = paintShowcaseLayer(
    $('#paperdollHairFrontLayer'),
    hairAsset,
    pose,
    hairAsset?.frontSrc,
  );
  const headTopAsset = showcaseAsset(headTop, pose.action);
  const headMidAsset = showcaseAsset(headMid, pose.action);
  const headLowAsset = showcaseAsset(headLow, pose.action);
  paintShowcaseLayer(
    $('#paperdollHeadBackLayer'),
    headTopAsset,
    pose,
    headTopAsset?.backSrc,
  );
  paintShowcaseLayer(
    $('#paperdollHeadFrontLayer'),
    headTopAsset,
    pose,
    headTopAsset?.frontSrc,
  );
  paintShowcaseLayer(
    $('#paperdollHeadMidBackLayer'),
    headMidAsset,
    pose,
    headMidAsset?.backSrc,
  );
  paintShowcaseLayer(
    $('#paperdollHeadMidFrontLayer'),
    headMidAsset,
    pose,
    headMidAsset?.frontSrc,
  );
  paintShowcaseLayer(
    $('#paperdollHeadLowBackLayer'),
    headLowAsset,
    pose,
    headLowAsset?.backSrc,
  );
  paintShowcaseLayer(
    $('#paperdollHeadLowFrontLayer'),
    headLowAsset,
    pose,
    headLowAsset?.frontSrc,
  );
  const weaponAsset = showcaseAsset(weapon, pose.action);
  paintShowcaseLayer(
    $('#paperdollWeaponBackLayer'),
    weaponAsset,
    pose,
    weaponAsset?.backSrc,
  );
  paintShowcaseLayer(
    $('#paperdollWeaponFrontLayer'),
    weaponAsset,
    pose,
    weaponAsset?.frontSrc,
  );
  const shieldAsset = showcaseAsset(shield, pose.action);
  paintShowcaseLayer(
    $('#paperdollShieldBackLayer'),
    shieldAsset,
    pose,
    shieldAsset?.backSrc,
  );
  paintShowcaseLayer(
    $('#paperdollShieldFrontLayer'),
    shieldAsset,
    pose,
    shieldAsset?.frontSrc,
  );
  stage.classList.toggle('showcase-fallback', !(bodyReady && hairReady));
  const uiSignature = `${c.name}|${characterShowcase.action}|${characterShowcase.direction}`;
  if (characterShowcase.lastUiSignature !== uiSignature) {
    characterShowcase.lastUiSignature = uiSignature;
    stage.setAttribute(
      'aria-label',
      `${c.name}，${showcaseActionLabels[characterShowcase.action]}，${showcaseDirectionLabels[characterShowcase.direction]}。可左右拖曳旋轉角色。`,
    );
    document.querySelectorAll('[data-showcase-action]').forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.showcaseAction === characterShowcase.action,
      );
    });
  }
}

function selectShowcaseAction(action, hold = showcaseCycleDuration) {
  if (!showcaseActionLabels[action]) return;
  const now = performance.now();
  characterShowcase.action = action;
  characterShowcase.actionStartedAt = now;
  characterShowcase.nextCycleAt = now + hold;
  renderCharacterShowcase(now);
}

function rotateShowcase(step) {
  const remaining = Math.max(
    0,
    characterShowcase.nextCycleAt - performance.now(),
  );
  characterShowcase.direction =
    (characterShowcase.direction + step + 8) % 8;
  selectShowcaseAction('stand', remaining);
}

async function loadCharacterShowcase({ preload = true } = {}) {
  if (!characterShowcase.loading && !characterShowcase.manifest) {
    characterShowcase.loading = fetch('/ro/client/showcase/manifest.json', {
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error('角色展示素材讀取失敗');
        return response.json();
      })
      .then((manifest) => {
        characterShowcase.manifest = manifest;
        return manifest;
      })
      .catch(() => null);
  }
  const manifest = characterShowcase.manifest ?? (await characterShowcase.loading);
  if (preload && manifest) await preloadCharacterShowcase();
  return manifest;
}

async function preloadCharacterSelectionFrame(character) {
  if (!characterShowcase.manifest) return false;
  const layers = rankingLayerAsset(
    {
      classId: character.classId,
      appearance: character,
      equipment: character.equipment ?? [],
    },
    'stand',
  );
  if (!layers.body?.src || !layers.hair?.src) return false;
  const sources = new Set();
  for (const asset of Object.values(layers)) {
    for (const source of [asset?.src, asset?.backSrc, asset?.frontSrc])
      if (source) sources.add(source);
  }
  await Promise.all([...sources].map(preloadShowcaseSource));
  return true;
}

function setAuthLoading(visible, message = '登入中，請稍候……') {
  const loading = $('#authLoading');
  if (!loading) return;
  loading.classList.toggle('hidden', !visible);
  loading.setAttribute('aria-busy', String(visible));
  $('#authLoadingMessage').textContent = message;
}

async function prepareCharacterSelectionCore(character) {
  characterShowcase.character = character;
  characterShowcase.equipment = character.equipment ?? [];
  let paperdollReady = false;
  try {
    await loadCharacterSelectionAssets();
    await loadCharacterShowcase({ preload: false });
    paperdollReady = await preloadCharacterSelectionFrame(character);
  } catch {
    paperdollReady = false;
  }
  if (!paperdollReady) await preloadShowcaseSource(bodyAsset(character));
  const selectPaperdoll = $('#selectPaperdoll');
  selectPaperdoll.style.backgroundImage = paperdollReady
    ? ''
    : `url("${bodyAsset(character)}")`;
  selectPaperdoll.style.backgroundPosition = 'center bottom';
  selectPaperdoll.style.backgroundRepeat = 'no-repeat';
  paintRankingCharacter(
    selectPaperdoll,
    {
      classId: character.classId,
      appearance: character,
      equipment: character.equipment ?? [],
    },
    'stand',
    0,
  );
  return true;
}

function renderCharacterSelectionSummary(character) {
  const value = (input, fallback = '未提供') =>
    input === null || input === undefined || input === ''
      ? fallback
      : Number.isFinite(Number(input))
        ? Number(input).toLocaleString()
        : String(input);
  const baseExp = value(character.baseExp);
  const jobExp = value(character.jobExp);
  $('#selectCharacterExp').textContent = baseExp;
  $('#selectCharacterJobExp').textContent = jobExp;
  $('#selectCharacterJobExpDisplay').textContent = jobExp;
  $('#selectCharacterHp').textContent = `${value(character.hp)} / ${value(character.maxHp)}`;
  $('#selectCharacterSp').textContent = `${value(character.sp)} / ${value(character.maxSp)}`;
  const stats = [
    ['STR', character.str],
    ['AGI', character.agi],
    ['VIT', character.vit],
    ['INT', character.int],
    ['DEX', character.dex],
    ['LUK', character.luk],
  ];
  $('#selectCharacterStats').textContent = stats
    .map(([name, stat]) => `${name} ${value(stat)}`)
    .join('　');
  stats.forEach(([name, stat]) => {
    const key = name[0] + name.slice(1).toLowerCase();
    $(`#selectCharacter${key}`).textContent = value(stat);
  });
  $('#selectCharacterMap').textContent = value(character.map);
  const zeny = value(character.zeny);
  $('#selectCharacterZeny').textContent = zeny;
  $('#selectCharacterZenyDisplay').textContent = zeny;
  const weight =
    character.weight === null || character.weight === undefined
      ? '未提供'
      : `${value(character.weight.current)} / ${value(character.weight.max)}`;
  $('#selectCharacterWeight').textContent = weight;
  $('#selectCharacterWeightDisplay').textContent = weight;
}

function setupCharacterShowcase() {
  const stage = $('#paperdollStage');
  if (!stage) return;
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, input, label')) return;
    characterShowcase.dragging = true;
    characterShowcase.lastPointerX = event.clientX;
    stage.classList.add('dragging');
    stage.setPointerCapture(event.pointerId);
    const remaining = Math.max(
      0,
      characterShowcase.nextCycleAt - performance.now(),
    );
    selectShowcaseAction('stand', remaining);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!characterShowcase.dragging) return;
    const delta = event.clientX - characterShowcase.lastPointerX;
    if (Math.abs(delta) < 18) return;
    rotateShowcase(delta > 0 ? 1 : -1);
    characterShowcase.lastPointerX = event.clientX;
  });
  const stopDragging = () => {
    characterShowcase.dragging = false;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', stopDragging);
  stage.addEventListener('pointercancel', stopDragging);
  stage.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    rotateShowcase(event.key === 'ArrowRight' ? 1 : -1);
  });
  $('#paperdollRotateLeft')?.addEventListener('click', () =>
    rotateShowcase(-1),
  );
  $('#paperdollRotateRight')?.addEventListener('click', () =>
    rotateShowcase(1),
  );
  document.querySelectorAll('[data-showcase-action]').forEach((button) => {
    button.addEventListener('click', () =>
      selectShowcaseAction(
        button.dataset.showcaseAction,
        showcaseManualPauseDuration,
      ),
    );
  });
  const equipmentVisible = $('#paperdollEquipmentVisible');
  const storedEquipmentVisibility = localStorage.getItem(
    'ro-showcase-equipment-visible',
  );
  equipmentVisible.checked = storedEquipmentVisibility !== '0';
  stage.classList.toggle(
    'hide-showcase-equipment',
    !equipmentVisible.checked,
  );
  equipmentVisible.addEventListener('change', () => {
    stage.classList.toggle(
      'hide-showcase-equipment',
      !equipmentVisible.checked,
    );
    localStorage.setItem(
      'ro-showcase-equipment-visible',
      equipmentVisible.checked ? '1' : '0',
    );
  });
  const cycle = ['stand', 'sit', 'stand', 'walk', 'attack'];
  let cycleIndex = 0;
  const animate = (now) => {
    if (!characterShowcase.dragging && now >= characterShowcase.nextCycleAt) {
      cycleIndex = (cycleIndex + 1) % cycle.length;
      selectShowcaseAction(cycle[cycleIndex], showcaseCycleDuration);
    }
    renderCharacterShowcase(now);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function rankingLayerAsset(entry, action) {
  const equipment = entry.equipment ?? [];
  const layers = showcaseLayersFor(
    { ...entry.appearance, classId: entry.classId },
    equipment,
  );
  return Object.fromEntries(
    Object.entries(layers).map(([name, layer]) => [
      name,
      showcaseAsset(layer, action, equipment),
    ]),
  );
}

function paintRankingLayer(
  element,
  asset,
  direction,
  frame,
  source = asset?.src,
  anchorReference = null,
) {
  if (!element || !source) {
    if (element) {
      element.style.backgroundImage = '';
      element.style.transform = '';
    }
    return false;
  }
  const count = Math.max(1, Number(asset.frameCounts?.[direction] ?? 1));
  const safeFrame = Math.min(count - 1, Math.max(0, frame % count));
  element.style.backgroundImage = `url("${source}")`;
  element.style.backgroundPosition = `${-safeFrame * 96}px ${-direction * 160}px`;
  const anchor = layerAnchorOffset(
    asset,
    anchorReference,
    direction,
    safeFrame,
    frame,
  );
  element.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`;
  return true;
}

function paintRankingCharacter(card, entry, action, now) {
  const direction = Number(card.dataset.direction ?? 0);
  const layers = rankingLayerAsset(entry, action);
  const frame = ['stand', 'sit'].includes(action)
    ? 0
    : Math.floor(now / Math.max(25, Number(layers.body?.delay ?? 100)));
  const bodyReady = paintRankingLayer(
    card.querySelector('.ranking-body-layer'),
    layers.body,
    direction,
    frame,
  );
  paintRankingLayer(
    card.querySelector('.ranking-weapon-back-layer'),
    layers.weapon,
    direction,
    frame,
    layers.weapon?.backSrc,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-back-layer'),
    layers.headTop,
    direction,
    frame,
    layers.headTop?.backSrc,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-low-back-layer'),
    layers.headLow,
    direction,
    frame,
    layers.headLow?.backSrc,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-mid-back-layer'),
    layers.headMid,
    direction,
    frame,
    layers.headMid?.backSrc,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-hair-back-layer'),
    layers.hair,
    direction,
    frame,
    layers.hair?.backSrc,
    layers.body,
  );
  const hairReady = paintRankingLayer(
    card.querySelector('.ranking-hair-front-layer'),
    layers.hair,
    direction,
    frame,
    layers.hair?.frontSrc ?? layers.hair?.src,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-weapon-front-layer'),
    layers.weapon,
    direction,
    frame,
    layers.weapon?.frontSrc ?? layers.weapon?.src,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-front-layer'),
    layers.headTop,
    direction,
    frame,
    layers.headTop?.frontSrc ?? layers.headTop?.src,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-low-front-layer'),
    layers.headLow,
    direction,
    frame,
    layers.headLow?.frontSrc ?? layers.headLow?.src,
    layers.body,
  );
  paintRankingLayer(
    card.querySelector('.ranking-head-mid-front-layer'),
    layers.headMid,
    direction,
    frame,
    layers.headMid?.frontSrc ?? layers.headMid?.src,
    layers.body,
  );
  card.classList.toggle(
    'ranking-appearance-unavailable',
    !(bodyReady && hairReady),
  );
  card.dataset.action = action;
}

function rotateRankingCard(card, entry, step) {
  const direction = (Number(card.dataset.direction ?? 0) + step + 8) % 8;
  card.dataset.direction = String(direction);
  const viewport = card.querySelector('.ranking-character-viewport');
  if (viewport)
    viewport.setAttribute(
      'aria-label',
      `${entry.name}的角色外觀，${showcaseDirectionLabels[direction]}，可左右拖曳旋轉`,
    );
  paintRankingCharacter(
    card,
    entry,
    card.dataset.action || 'stand',
    performance.now(),
  );
}

function setupRankingCardRotation(viewport, card, entry) {
  let gesture = null;
  viewport.tabIndex = 0;
  viewport.title = '左右拖曳旋轉，共八個方向';
  viewport.addEventListener('pointerdown', (event) => {
    gesture = { pointerId: event.pointerId, x: event.clientX };
    viewport.classList.add('dragging');
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {}
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const delta = event.clientX - gesture.x;
    if (Math.abs(delta) < 18) return;
    event.preventDefault();
    rotateRankingCard(card, entry, delta > 0 ? 1 : -1);
    gesture.x = event.clientX;
  });
  const stopRotation = () => {
    gesture = null;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', stopRotation);
  viewport.addEventListener('pointercancel', stopRotation);
  viewport.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    rotateRankingCard(card, entry, event.key === 'ArrowRight' ? 1 : -1);
  });
}

function rankingCard(entry) {
  const card = document.createElement('article');
  card.className = `ranking-card rank-${entry.rank}${entry.rank <= 3 ? ' animated' : ' compact'}`;
  card.dataset.rank = String(entry.rank);
  card.dataset.direction = String(
    entry.rank === 2 ? 1 : entry.rank === 3 ? 7 : 0,
  );
  const medal = document.createElement('b');
  medal.className = 'ranking-medal';
  medal.textContent = `第 ${entry.rank} 名`;
  const viewport = document.createElement('div');
  viewport.className = 'ranking-character-viewport';
  viewport.setAttribute(
    'aria-label',
    `${entry.name}的角色外觀，${showcaseDirectionLabels[Number(card.dataset.direction)]}，可左右拖曳旋轉`,
  );
  const sprite = document.createElement('div');
  sprite.className = 'ranking-character-sprite';
  const headBack = document.createElement('span');
  headBack.className =
    'ranking-character-layer ranking-head-back-layer';
  const headLowBack = document.createElement('span');
  headLowBack.className =
    'ranking-character-layer ranking-head-low-back-layer';
  const headMidBack = document.createElement('span');
  headMidBack.className =
    'ranking-character-layer ranking-head-mid-back-layer';
  const weaponBack = document.createElement('span');
  weaponBack.className =
    'ranking-character-layer ranking-weapon-back-layer';
  const hairBack = document.createElement('span');
  hairBack.className =
    'ranking-character-layer ranking-hair-back-layer';
  const body = document.createElement('span');
  body.className = 'ranking-character-layer ranking-body-layer';
  const hairFront = document.createElement('span');
  hairFront.className =
    'ranking-character-layer ranking-hair-front-layer';
  const unavailable = document.createElement('span');
  unavailable.className = 'ranking-character-unavailable';
  unavailable.textContent = '職業外觀製作中';
  const weaponFront = document.createElement('span');
  weaponFront.className =
    'ranking-character-layer ranking-weapon-front-layer';
  const headFront = document.createElement('span');
  headFront.className =
    'ranking-character-layer ranking-head-front-layer';
  const headLowFront = document.createElement('span');
  headLowFront.className =
    'ranking-character-layer ranking-head-low-front-layer';
  const headMidFront = document.createElement('span');
  headMidFront.className =
    'ranking-character-layer ranking-head-mid-front-layer';
  sprite.append(
    headBack,
    headMidBack,
    headLowBack,
    weaponBack,
    hairBack,
    body,
    weaponFront,
    hairFront,
    headLowFront,
    headMidFront,
    headFront,
  );
  viewport.append(sprite, unavailable);
  if (entry.rank <= 3 && window.PetShowcaseMode) {
    const petShowcase = document.createElement('span');
    petShowcase.className = 'ranking-pet-showcase';
    petShowcase.setAttribute('aria-hidden', 'true');
    const showcase = window.PetShowcaseMode.createCharacterShowcase({
      characterAppearance: entry.appearance ?? null,
      equipmentAppearance: entry.equipmentAppearance ?? null,
      pet: entry.pet ?? null,
      title: entry.title ?? null,
      seasonInfo: entry.seasonInfo ?? null,
    });
    window.PetShowcaseMode.render(petShowcase, showcase);
    viewport.append(petShowcase);
  }
  const name = document.createElement('strong');
  name.textContent = entry.name;
  const levels = document.createElement('small');
  levels.textContent = `${jobNames[entry.classId] ?? `職業 ${entry.classId}`}　Base ${entry.baseLevel} / Job ${entry.jobLevel}`;
  card.append(medal, viewport, name, levels);
  setupRankingCardRotation(viewport, card, entry);
  paintRankingCharacter(card, entry, 'stand', 0);
  return card;
}

function renderRanking() {
  const podium = $('#rankingPodium');
  const rows = $('#rankingRows');
  podium.replaceChildren(...rankingState.entries.slice(0, 10).map(rankingCard));
  rows.replaceChildren();
  for (const entry of rankingState.entries.slice(10)) {
    const row = document.createElement('tr');
    for (const value of [
      entry.rank,
      entry.name,
      jobNames[entry.classId] ?? `職業 ${entry.classId}`,
      `Lv. ${entry.baseLevel}`,
      `Lv. ${entry.jobLevel}`,
    ]) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    rows.append(row);
  }
  if (!rankingState.entries.length) {
    const empty = document.createElement('p');
    empty.className = 'ranking-empty';
    empty.textContent = '這個職業目前還沒有上榜角色。';
    podium.append(empty);
  } else if (rankingState.entries.length <= 10) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = '第11名後目前沒有角色';
    row.append(cell);
    rows.append(row);
  }
  $('#rankingUpdated').textContent = new Date(
    rankingState.generatedAt,
  ).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  $('#rankingStatus').textContent = `共 ${rankingState.entries.length} 名，資料快取60秒`;
}

async function loadRanking() {
  if (rankingState.loading) return;
  const classId = Number($('#rankingJob').value);
  rankingState.loading = true;
  $('#rankingRefresh').disabled = true;
  $('#rankingStatus').textContent = '正在讀取排行榜';
  try {
    await loadCharacterShowcase();
    const query = new URLSearchParams({ classId: String(classId) });
    const data = await api(`/api/rankings?${query}`);
    rankingState.classId = classId;
    rankingState.loaded = true;
    rankingState.entries = data.ranking.entries;
    rankingState.generatedAt = data.ranking.generatedAt;
    renderRanking();
  } catch (error) {
    $('#rankingStatus').textContent = error.message;
  } finally {
    rankingState.loading = false;
    $('#rankingRefresh').disabled = false;
  }
}

function setupRankings() {
  const select = $('#rankingJob');
  for (const classId of rankingJobIds) {
    const option = document.createElement('option');
    option.value = String(classId);
    option.textContent = jobNames[classId];
    select.append(option);
  }
  select.addEventListener('change', () => void loadRanking());
  $('#rankingRefresh').addEventListener('click', () => void loadRanking());
  const actionTimeline = [
    ['stand', 6000],
    ['walk', 3500],
    ['stand', 4500],
    ['sit', 2500],
    ['stand', 4500],
    ['attack', 1200],
  ];
  const actionCycle = actionTimeline.reduce(
    (total, [, duration]) => total + duration,
    0,
  );
  const actionAt = (now, rank) => {
    let elapsed = (now + (rank - 1) * 900) % actionCycle;
    for (const [action, duration] of actionTimeline) {
      if (elapsed < duration) return action;
      elapsed -= duration;
    }
    return 'stand';
  };
  const animate = (now) => {
    if ($('#rankings').classList.contains('active')) {
      document.querySelectorAll('.ranking-card.animated').forEach((card) => {
        const entry = rankingState.entries[Number(card.dataset.rank) - 1];
        if (!entry) return;
        const action = actionAt(now, entry.rank);
        paintRankingCharacter(card, entry, action, now);
      });
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
// Farm Stats elapsed clock. `end` is an authoritative session end time (ms):
// while a farm session is ACTIVE the clock follows wall time, and once
// STOP_FARM ends it the clock freezes instead of growing against a stale start.
const duration = (s, end) => {
  if (!s) return '00:00:00';
  const n = Math.max(0, Math.floor(((end || Date.now()) - s) / 1000));
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
  $('#damagePreviewResizeHandle').setAttribute(
    'aria-valuenow',
    String(audioPrefs.damageFloatScale),
  );
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
  bgm.muted = !(audioPrefs.musicEnabled && !audioPrefs.muted);
  for (const session of travelCueSessions.values()) session.updateVolume?.();
  const audioToggle = $('#quickAudio');
  if (audioToggle) {
    const muted = Boolean(audioPrefs.muted);
    audioToggle.dataset.audioState = muted ? 'muted' : 'on';
    audioToggle.setAttribute('aria-pressed', String(muted));
    audioToggle.setAttribute(
      'aria-label',
      muted ? '音效已靜音，點擊恢復' : '音效開啟，點擊靜音',
    );
    audioToggle.title = muted ? '音效已靜音' : '音效開啟';
  }
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
    const handle = $('#damagePreviewResizeHandle'),
      previewRect = preview.getBoundingClientRect(),
      referenceRect = reference.getBoundingClientRect();
    handle.style.left = `${Math.min(preview.clientWidth - 16, referenceRect.right - previewRect.left + 9)}px`;
    handle.style.top = `${Math.min(preview.clientHeight - 16, referenceRect.bottom - previewRect.top + 9)}px`;
  }
  void preview.offsetWidth;
  samples.forEach((sample) => sample.classList.add('preview-running'));
}
let damagePreviewGesture = null;
function clampDamagePreviewValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
function updateDamagePreviewGesture(event) {
  const preview = $('#damageFloatPreview'),
    gesture = damagePreviewGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (gesture.mode === 'position') {
    const rect = preview.getBoundingClientRect();
    setAudio({
      damageFloatPositionX: Math.round(
        clampDamagePreviewValue(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      ),
      damageFloatPositionY: Math.round(
        clampDamagePreviewValue(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
      ),
    });
    return;
  }
  const distance =
      ((event.clientX - gesture.startX) + (event.clientY - gesture.startY)) / 2,
    scale = Math.round(
      clampDamagePreviewValue(gesture.startScale + distance * (100 / 28), 10, 1000) /
        10,
    ) * 10;
  setAudio({ damageFloatScale: scale });
}
function stopDamagePreviewGesture(event) {
  if (!damagePreviewGesture || damagePreviewGesture.pointerId !== event.pointerId)
    return;
  damagePreviewGesture = null;
  $('#damageFloatPreview').classList.remove('is-direct-editing');
}
$('#damageFloatPreview').addEventListener('pointerdown', (event) => {
  const position = event.target.closest('.damage-preview-reference'),
    resize = event.target.closest('#damagePreviewResizeHandle');
  if (!position && !resize) return;
  event.preventDefault();
  const preview = $('#damageFloatPreview');
  damagePreviewGesture = {
    pointerId: event.pointerId,
    mode: resize ? 'size' : 'position',
    startX: event.clientX,
    startY: event.clientY,
    startScale: audioPrefs.damageFloatScale,
  };
  preview.classList.add('is-direct-editing');
  preview.setPointerCapture(event.pointerId);
  updateDamagePreviewGesture(event);
});
$('#damageFloatPreview').addEventListener('pointermove', updateDamagePreviewGesture);
for (const type of ['pointerup', 'pointercancel'])
  $('#damageFloatPreview').addEventListener(type, stopDamagePreviewGesture);
$('#damagePreviewPositionHandle').addEventListener('keydown', (event) => {
  const patch = {};
  if (event.key === 'ArrowLeft') patch.damageFloatPositionX = audioPrefs.damageFloatPositionX - 1;
  else if (event.key === 'ArrowRight')
    patch.damageFloatPositionX = audioPrefs.damageFloatPositionX + 1;
  else if (event.key === 'ArrowUp')
    patch.damageFloatPositionY = audioPrefs.damageFloatPositionY - 1;
  else if (event.key === 'ArrowDown')
    patch.damageFloatPositionY = audioPrefs.damageFloatPositionY + 1;
  else return;
  event.preventDefault();
  for (const key of Object.keys(patch))
    patch[key] = clampDamagePreviewValue(patch[key], 0, 100);
  setAudio(patch);
});
$('#damagePreviewResizeHandle').addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key))
    return;
  event.preventDefault();
  const direction = ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : 1;
  setAudio({
    damageFloatScale: clampDamagePreviewValue(
      audioPrefs.damageFloatScale + direction * 10,
      10,
      1000,
    ),
  });
});
function prepareCombatAudio(key) {
  if (!combatAudioContext || !combatSounds[key] || combatAudioBuffers.has(key))
    return Promise.resolve();
  if (combatAudioBufferLoads.has(key)) return combatAudioBufferLoads.get(key);
  const loading = fetch(combatSounds[key], { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`音效讀取失敗：${key}`);
      return response.arrayBuffer();
    })
    .then((bytes) => combatAudioContext.decodeAudioData(bytes))
    .then((buffer) => combatAudioBuffers.set(key, buffer))
    .catch((error) => console.warn('戰鬥音效解碼失敗，改用媒體播放', error))
    .finally(() => combatAudioBufferLoads.delete(key));
  combatAudioBufferLoads.set(key, loading);
  return loading;
}
function unlockAudio(fromUserGesture = false) {
  if (!worldMapTravelPresentation?.isTransitionActive() &&
      audioPrefs.musicEnabled && audioPrefs.musicVolume > 0)
    $('#bgm')
      .play()
      .catch(() => {});
  if (!fromUserGesture) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    combatAudioContext ||= new AudioContextClass();
    if (combatAudioContext.state === 'suspended')
      void combatAudioContext.resume().catch(() => {});
    for (const key of uiSoundKeys) void prepareCombatAudio(key);
  }
}
function setMusicContext(context) {
  if (worldMapTravelPresentation?.isTransitionActive()) return;
  const bgm = $('#bgm');
  const source = musicSources[context];
  if (!source) {
    // The original table has maps without an explicit track. Preserve a real
    // map track across a transition, while preventing the login theme from
    // leaking into a directly loaded gameplay map.
    if (currentMusic !== musicSources.title) return;
    currentMusic = null;
    bgm.pause();
    bgm.removeAttribute('src');
    bgm.load();
    return;
  }
  if (source === currentMusic) {
    if (bgm.paused) unlockAudio();
    return;
  }
  currentMusic = source;
  bgm.src = source;
  bgm.load();
  unlockAudio();
}
function reportCombatSound(detail) {
  if (detail.key === 'uiOriginalButton' || detail.key === 'uiOriginalCancel') {
    const counter = `${detail.key}${detail.started ? 'Started' : 'Failed'}`;
    const value = String(Number(document.documentElement.dataset[counter] ?? 0) + 1);
    document.documentElement.dataset[counter] = value;
    try { sessionStorage.setItem(counter, value); } catch {}
  }
  document.dispatchEvent(new CustomEvent('ro-combat-sound', { detail }));
}
for (const counter of ['uiOriginalButtonStarted', 'uiOriginalButtonFailed', 'uiOriginalCancelStarted', 'uiOriginalCancelFailed']) {
  try {
    document.documentElement.dataset[counter] = sessionStorage.getItem(counter) ?? '0';
  } catch {
    document.documentElement.dataset[counter] = '0';
  }
}
function stopTravelCue(key) {
  travelCueSessions.get(key)?.stop();
}
function playTravelCue(key, { loop = false } = {}) {
  if (!travelCueKeys.has(key)) return Promise.reject(new Error('unknown travel cue'));
  stopTravelCue(key);
  return new Promise((resolve, reject) => {
    const session = { source: null, gain: null, audio: null, settled: false };
    const volume = () => Math.max(0, Math.min(1, audioPrefs.soundVolume / 100));
    const audible = () => audioPrefs.soundEnabled && !audioPrefs.muted;
    const settle = (result, error = null) => {
      if (session.settled) return;
      session.settled = true;
      if (travelCueSessions.get(key) === session) travelCueSessions.delete(key);
      if (session.audio) {
        session.audio.onended = null;
        session.audio.onerror = null;
        session.audio.loop = false;
      }
      if (error) reject(error);
      else resolve(result);
    };
    session.updateVolume = () => {
      if (session.gain) session.gain.gain.value = audible() ? volume() : 0;
      if (session.audio) {
        session.audio.volume = volume();
        session.audio.muted = !audible();
      }
    };
    session.stop = () => {
      if (session.source) {
        session.source.onended = null;
        try { session.source.stop(); } catch {}
      }
      if (session.audio) session.audio.pause();
      settle('cancelled');
    };
    travelCueSessions.set(key, session);
    void prepareCombatAudio(key).then(() => {
      if (session.settled) return;
      const buffer = combatAudioBuffers.get(key);
      if (combatAudioContext?.state === 'running' && buffer) {
        session.source = combatAudioContext.createBufferSource();
        session.gain = combatAudioContext.createGain();
        session.source.buffer = buffer;
        session.source.loop = loop;
        session.source.connect(session.gain);
        session.gain.connect(combatAudioContext.destination);
        session.updateVolume();
        session.source.onended = () => settle('ended');
        session.source.start();
        reportCombatSound({ key, backend: 'web-audio', started: true,
          loop, volume: audible() ? volume() : 0 });
        return;
      }
      session.audio = combatAudio[key]?.at(-1);
      if (!session.audio) throw new Error(`音效不存在：${key}`);
      session.audio.pause();
      session.audio.currentTime = 0;
      session.audio.loop = loop;
      session.updateVolume();
      session.audio.onended = () => settle('ended');
      session.audio.onerror = () => settle(null, new Error(`音效播放失敗：${key}`));
      void session.audio.play().then(() => {
        reportCombatSound({ key, backend: 'html-audio', started: true,
          loop, volume: audible() ? volume() : 0 });
      }).catch((error) => settle(null, error));
    }).catch((error) => settle(null, error));
  });
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
    !(audioPrefs.soundEnabled && !audioPrefs.muted) ||
    audioPrefs.soundVolume <= 0
  )
    return;
  const start = () => {
    const volume = Math.max(
        0,
        Math.min(1, (audioPrefs.soundVolume / 100) * gainScale),
      ),
      buffer = combatAudioBuffers.get(key);
    if (combatAudioContext?.state === 'running' && !buffer)
      void prepareCombatAudio(key);
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
    const available = travelCueKeys.has(key) ? pool.length - 1 : pool.length,
      cursor = combatAudioCursor[key]++ % available,
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
    accountPreferences = data.preferences;
    const localPrefs = (() => {
      try {
        return JSON.parse(localStorage.getItem('ro-audio') || '{}');
      } catch {
        return {};
      }
    })();
    audioPrefs = {
      ...defaultAudio,
      ...data.preferences,
      ...(typeof localPrefs.muted === 'boolean'
        ? { muted: localPrefs.muted }
        : {}),
    };
    window.PetCompanionSettings?.hydrateFromApi(data.preferences);
    localStorage.setItem('ro-audio', JSON.stringify(audioPrefs));
  } catch {}
  syncAudioControls();
  unlockAudio();
}

addEventListener(
  window.PetCompanionSettings?.changeEvent ?? 'petcompanion:settingschange',
  (event) => {
    if (event.detail?.source !== 'user' || !authenticated) return;
    clearTimeout(petSettingsSaveTimer);
    petSettingsSaveTimer = setTimeout(
      () =>
        api('/api/preferences', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(event.detail.api),
        }).catch(() => {}),
      250,
    );
  },
);

function monsterDisplayName(name, mobId) {
  const numericId = Number(mobId);
  const query =
    Number.isFinite(numericId) && numericId > 0
      ? { mobId: numericId, name: name ?? undefined }
      : name;
  if (!query) return name ?? null;
  const resolved = window.roAssetResolver?.resolveMonsterDisplayName?.(query);
  return resolved ?? name ?? null;
}
const hasHan = (value) => /[\u3400-\u9fff]/u.test(String(value ?? ''));
// Single shared map display name for every player-facing surface. Reuses the
// existing project name table first, then the generated map-info index, then
// the canonical Web map-name index exposed by resolveMapDisplayName, and only
// then the raw English/OpenKore label.
function mapDisplayName(mapId, englishName) {
  const id = String(mapId ?? '').trim();
  if (!id) return englishName ?? null;
  if (mapNames[id]) return mapNames[id];
  const info = mapInfoData?.maps?.[id];
  if (info?.name && info.name !== id && hasHan(info.name)) return info.name;
  const canonical = window.roAssetResolver?.resolveMapDisplayName?.(id);
  if (canonical && hasHan(canonical)) return canonical;
  return englishName ?? id;
}
function mapDisplayLabel(mapId, englishName) {
  const id = String(mapId ?? '').trim();
  return `${mapDisplayName(id, englishName)} (${id})`;
}
let mapInfoPrefetch = null;
function prefetchMapInfo() {
  if (mapInfoData?.maps || mapInfoPrefetch) return mapInfoPrefetch;
  mapInfoPrefetch = fetch('/ro/data/map-info.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data?.maps) mapInfoData = data;
      return data;
    })
    .catch(() => null);
  return mapInfoPrefetch;
}
function localize(line) {
  const passiveProc = passiveProcName(line);
  for (const [from, to] of Object.entries(names))
    line = line.replaceAll(from, to);
  line = line
    .replace(/^\[\s*(\d+)\/\s*(\d+)\]\s*/, '[HP $1% · SP $2%] ')
    .replace(
      /Map Change: ([a-z0-9_@-]+)\.gat(?:\s*\((\d+),\s*(\d+)\))?/i,
      (_, mapId, x, y) =>
        `[地圖] 進入 ${mapDisplayLabel(mapId)}${x && y ? ` (${x}, ${y})` : ''}`,
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
    .replace(
      /Calculating random route to: (.+?) \(([a-z0-9_@-]+)\)(?::|：)\s*(\d+,\s*\d+)/i,
      (_, englishName, mapId, coordinates) =>
        `[尋路] 計算路徑：${mapDisplayLabel(mapId, englishName)}：${coordinates}`,
    )
    .replace(
      /Calculating lockMap route to: (.+?)\s*\(([a-z0-9_@-]+)\)/i,
      (_, englishName, mapId) =>
        `[尋路] 目標地圖：${mapDisplayLabel(mapId, englishName)}`,
    )
    .replace(/Moving to /, '[移動] 前往 ')
    .replace(
      /You are now attacking Monster (.+?)(?:\s+\(\d+\))?$/,
      (_, name) => `[索敵] 鎖定 ${monsterDisplayName(name)}`,
    )
    .replace(
      /You attack Monster (.+?)(?:\s+\(\d+\))?(?=\s+\(Dmg:|$)/,
      (_, name) => `[攻擊] 你攻擊 ${monsterDisplayName(name)}`,
    )
    .replace(
      /You use (.+?) \(Lv: (\d+)\) on Monster (.+?)(?:\s+\(\d+\))?(?=\s+\(Dmg:|$)/,
      (_, skill, level, name) =>
        `[主動技能] ${localizedSkillName(skill)} Lv.${level} · 攻擊 ${monsterDisplayName(name)}`,
    )
    .replace(
      /You use (.+?) on Monster (.+?)(?:\s+\(\d+\))? \(Lv: (\d+)\)/,
      (_, skill, name, level) =>
        `[主動技能] ${localizedSkillName(skill)} Lv.${level} · 攻擊 ${monsterDisplayName(name)}`,
    )
    .replace(/You use (.+?) on yourself \(Lv: (\d+)\)/, (_, skill, level) => {
      const definition = localizedSkillDefinition(skill);
      const name = localizedSkillName(skill);
      return definition?.automationMode === 'selfBuff'
        ? `[輔助技能] ${name} Lv.${level} · 自動維持狀態`
        : `[主動技能] ${name} Lv.${level} · 以自身為中心施放`;
    })
    .replace(
      /You use (.+?) on yourself \(Gained: (\d+) hp\)/,
      (_, skill, gained) =>
        `[主動技能] ${localizedSkillName(skill)} · 自身恢復 ${gained} HP`,
    )
    .replace(
      /Monster (.+?)(?:\s+\(\d+\))? attacks you/,
      (_, name) => `[受傷] ${monsterDisplayName(name)} 攻擊你`,
    )
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
    .replace(
      /Target Monster (.+?)(?:\s+\(\d+\))? died/,
      (_, name) => `[擊倒] ${monsterDisplayName(name)}`,
    )
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
  const name = String(englishName ?? '').trim();
  if (!name) return name;
  const definition = localizedSkillDefinition(name);
  const query = definition?.id
    ? { skillId: definition.id, internalName: definition.handle, enName: name }
    : { enName: name };
  const canonical = window.roAssetResolver?.resolveSkillDisplayName?.(query);
  if (canonical && hasHan(canonical)) return canonical;
  return definition?.name ?? name;
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
function shouldRenderPlayerLog(line) {
  const text = String(line ?? '');
  if (!/^You attack Monster /i.test(text)) return true;
  const damage = damageEvent(text);
  return Boolean(damage && Number(damage.total) > 0);
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
  if (/^Fly Wing relocated$/.test(line)) {
    if (worldMapTravelPresentation?.isTransitionActive()) return;
    playCombatSound('flyWing', 0, '', 0, 0.72);
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
  node.dataset.damageText = text;
  node.dataset.damageKind = kind;
  node.dataset.combatEventId = combatEventId;
  node.dataset.hitIndex = String(hitIndex);
  const sequence = damageFloatSequence++;
  node.style.setProperty('--damage-delay', `${delay}ms`);
  node.style.visibility = 'hidden';
  layer.append(node);
  decorateOfficialDamage(node);
  const motion = applyDamageFloatMotion(node, layer, lane, sequence);
  if (kind === 'critical') createOfficialHitRays(layer, motion, delay);
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
  while (eventLines.length > 1000) eventLines.shift();
  const playerLogLines = lines.filter(shouldRenderPlayerLog);
  for (const line of playerLogLines) {
    const row = eventNode(line);
    log.append(row);
    if (!reset || !/^Fly Wing relocated$/.test(line))
      playInterfaceEventSound(line);
    if (!reset) requestAnimationFrame(() => presentCombatEvent(row, line));
  }
  while (log.childElementCount > 220) {
    log.firstElementChild.remove();
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
  const badge = document.createElement('small');
  badge.className = 'chat-channel-badge';
  badge.textContent = chatChannelBadges[channel] ?? '一般';
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
  row.append(time, badge, sender, message);
  return row;
}
function isInternalChatEvent(entry) {
  return (
    entry?.type === 'chat' &&
    /^@web_[a-z0-9_]+(?:\s.*)?$/iu.test(String(entry.message ?? '').trim())
  );
}
function pendingChatKey(channel, target, message) {
  return `${channel}\u0000${target || ''}\u0000${message}`;
}
function applyChatFilter() {
  const feed = $('#chatFeed');
  feed.querySelectorAll('.chat-line').forEach((row) => {
    row.hidden =
      !visibleChatChannels.has(row.dataset.chatChannel) ||
      (currentChatChannel !== 'all' &&
        row.dataset.chatChannel !== currentChatChannel);
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
  events = events.filter((entry) => !isInternalChatEvent(entry));
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
  const interest = currentWebInterest();
  if (!authenticated || interest === ObservationInterest.NO_WEB) return;
  const pollStartedAt = performance.now();
  try {
    const query = socialCursor === null ? '' : `?cursor=${socialCursor}`,
      data = await api(`/api/social${query}`);
    socialCursor = data.cursor;
    renderSocialDelta(data.events, data.reset);
    socialPollFailures = 0;
  } catch (error) {
    socialPollFailures += 1;
    if (!/登入/.test(error.message))
      $('#chatStatus').textContent = '對話重新連線中';
  }
  const socialInterval = policyForInterest(interest).socialPollMs;
  socialTimer = setTimeout(
    pollSocial,
    socialPollFailures
      ? Math.min(
          POLL_RETRY_MAX_MS,
          socialInterval * 2 ** Math.min(socialPollFailures, 3),
        )
      : Math.max(
          0,
          socialInterval - (performance.now() - pollStartedAt),
        ),
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
function originalMinimapApi() {
  return globalThis.roOriginalMinimap ?? null;
}
function ensureOriginalMinimapManager() {
  const api = originalMinimapApi();
  if (!api) return null;
  if (!minimapOriginalManager) {
    minimapOriginalManager = api.createManager({
      onChange: () => {
        minimapTerrain = null;
        minimapTerrainKey = '';
        if (minimapLive && !minimapFrame)
          minimapFrame = requestAnimationFrame(paintMinimap);
      },
    });
    const canvas = $('#minimap');
    canvas?.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const direction = event.deltaY < 0 ? 2 : 0.5;
        minimapOriginalManager.setZoom(
          minimapOriginalManager.getZoom() * direction,
        );
      },
      { passive: false },
    );
    globalThis.RO_MINIMAP_DEBUG = Object.freeze({
      setMode(mode) {
        return minimapOriginalManager.setMode(mode);
      },
      getMode() {
        return minimapOriginalManager.getMode();
      },
      setZoom(zoom) {
        return minimapOriginalManager.setZoom(zoom);
      },
      getZoom() {
        return minimapOriginalManager.getZoom();
      },
      getState(map = minimapLive?.map) {
        return minimapOriginalManager.state(map);
      },
    });
  }
  return minimapOriginalManager;
}
async function ensureMap(name) {
  if (!name) return;
  const originalManager = ensureOriginalMinimapManager();
  void originalManager?.load(name);
  if (mapFieldName === name) return;
  mapFieldName = name;
  mapField = null;
  mapFieldError = '';
  try {
    const response = await fetch(
      '/ro/maps/' + encodeURIComponent(name) + '.fld2.bin?v=2',
      { cache: 'default' },
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
function minimapPresenceApi() {
  return globalThis.minimapPresence ?? null;
}
function compactMinimapViewport() {
  return window.innerWidth <= 600;
}
// Records the authoritative state age carried by the live read model and the
// monotonic time it was received. The banner then grows the age locally.
function noteMinimapFreshness(live) {
  const freshness = live?.freshness;
  if (!freshness || !Number.isFinite(Number(freshness.ageMs))) return;
  minimapFreshness = {
    ageMs: Math.max(0, Number(freshness.ageMs)),
    authoritativeAt: Number(freshness.authoritativeAt) || null,
    statusIntervalMs: Number(live.statusIntervalMs) || 0,
    maxAgeMs: Number(freshness.maxAgeMs) || null,
    atPerf: performance.now(),
  };
}
function renderMinimapFreshness() {
  const element = $('#mapFreshness'),
    presence = minimapPresenceApi();
  if (!element || !presence) return;
  if (!minimapFreshness) {
    element.textContent = '—';
    element.dataset.state = 'unknown';
    element.title = '小地圖資料即時性：等待資料';
    return;
  }
  const ageMs = presence.freshnessAgeMs(minimapFreshness, performance.now()),
    // STALE is defined by the single authority (LIVE_STATUS_MAX_AGE_MS) carried
    // in freshness.maxAgeMs, so the banner never disagrees with the server.
    authorityMaxAgeMs = Number(minimapFreshness.maxAgeMs),
    state = Number.isFinite(authorityMaxAgeMs) && authorityMaxAgeMs > 0
      ? ageMs >= authorityMaxAgeMs
        ? 'stale'
        : ageMs >= 1000
          ? 'slow'
          : 'live'
      : presence.freshnessState(ageMs, minimapFreshness.statusIntervalMs),
    formatted = presence.formatFreshnessMs(ageMs);
  element.dataset.state = state;
  element.textContent = state === 'stale' ? `資料延遲 ${formatted}` : formatted;
  element.title = `小地圖狀態即時性 ${Math.round(ageMs)}ms`;
}
function startMinimapFreshnessClock() {
  if (minimapFreshnessTimer !== null) return;
  minimapFreshnessTimer = setInterval(renderMinimapFreshness, 250);
}
function updateMinimapTargets(live, options = {}) {
  const now = performance.now(),
    presence = minimapPresenceApi(),
    combatObserved = options.combatObserved ?? true,
    staleAgeMs = Number(live?.freshness?.ageMs),
    authorityMaxAgeMs = Number(live?.freshness?.maxAgeMs),
    playerStale =
      combatObserved &&
      Number.isFinite(staleAgeMs) &&
      presence &&
      staleAgeMs >=
        (Number.isFinite(authorityMaxAgeMs) && authorityMaxAgeMs > 0
          ? authorityMaxAgeMs
          : presence.playerStaleThresholdMs(live?.statusIntervalMs));
  minimapCombatObserved = combatObserved;
  minimapPlayerStale = playerStale;
  // MONOTONIC POSITION: the position hot path, the event poll and the state poll
  // can land out of order. An older authoritative frame must never move the
  // marker backwards on the same map, so the displayed position only advances in
  // authoritative time. Interpolation still only smooths received samples.
  const incomingAuthoritativeAt = Number(live?.freshness?.authoritativeAt),
    displayedAuthoritativeAt = Number(
      minimapLive?.freshness?.authoritativeAt ?? minimapLive?.updatedAt,
    );
  if (
    minimapLive?.map &&
    live?.map === minimapLive.map &&
    Number.isFinite(incomingAuthoritativeAt) &&
    Number.isFinite(displayedAuthoritativeAt) &&
    incomingAuthoritativeAt < displayedAuthoritativeAt
  ) {
    live = {
      ...live,
      playerX: minimapLive.playerX,
      playerY: minimapLive.playerY,
      updatedAt: minimapLive.updatedAt,
      freshness: minimapLive.freshness ?? live.freshness,
    };
  }
  const monsters = combatObserved && !playerStale ? live.monsters ?? [] : [],
    players = combatObserved && !playerStale ? live.players ?? [] : [],
    mapMonsterCount = Number(
      live.mapMonsterCount ?? mapInfoData?.maps?.[live.map]?.totalMonsters ?? 0,
    ),
    mapPlayerCount = Number(live.mapPlayerCount ?? 0),
    nextKeys = new Set(['self']);
  if (minimapLive?.map && minimapLive.map !== live.map) {
    minimapTracks.clear();
    minimapPlayerStale = false;
  }
  // STALE: authoritative state is delayed. Keep the last known terrain and
  // marker tracks on screen (the freshness banner shows 資料延遲) instead of
  // blanking the minimap. Only a genuine map change (cleared above) or an
  // unavailable map (OFFLINE) removes markers.
  const mapUnavailable = !live.map;
  if (mapUnavailable) minimapTracks.clear();
  const retainStale = !mapUnavailable
    && Boolean(playerStale)
    && Boolean(minimapLive?.map);
  noteMinimapDeliveryGap(live, now);
  if (!retainStale) {
    updateMinimapTrack('self', live.playerX, live.playerY, now);
    for (const monster of monsters) {
      const key = `monster:${monster.id}`;
      nextKeys.add(key);
      updateMinimapTrack(key, monster.x, monster.y, now);
    }
    for (const player of players) {
      const key = `player:${player.id}`;
      nextKeys.add(key);
      updateMinimapTrack(key, player.x, player.y, now);
    }
    for (const key of minimapTracks.keys())
      if (!nextKeys.has(key)) minimapTracks.delete(key);
  }
  const telemetryPosition = `${live.map ?? ''}:${Number(live.playerX ?? 0)}:${Number(live.playerY ?? 0)}`;
  const telemetryMoved = minimapTelemetryLastPosition !== telemetryPosition;
  if (
    webExperienceTelemetry.enabled &&
    webExperienceTelemetry.eligible &&
    webExperienceTelemetry.actions.has('minimap_marker_update') &&
    (now - minimapTelemetryLastAt >= 1000 || minimapTelemetryLastPosition === null)
  ) {
    sendWebExperienceTelemetry({
      actionId: 'minimap_marker_update',
      success: true,
      authoritySource: 'RATHENA_LIVE_STATUS',
    });
    minimapTelemetryLastAt = now;
    minimapTelemetryLastPosition = telemetryPosition;
  }
  // MINIMAP_FRESHNESS: the rendered marker's data age, not a user click. This
  // is what feeds dataAgeP50/P95/Max for the minimap in the health read model.
  if (
    webExperienceTelemetry.enabled &&
    webExperienceTelemetry.eligible &&
    webExperienceTelemetry.actions.has('minimap_freshness') &&
    telemetryMoved &&
    (now - minimapFreshnessTelemetryLastAt >= 1000 || minimapFreshnessTelemetryLastAt === 0)
  ) {
    const freshnessAgeMs = Number(live.freshness?.ageMs);
    const authorityMaxAgeMs = Number(live.freshness?.maxAgeMs);
    const stale =
      Number.isFinite(authorityMaxAgeMs) &&
      authorityMaxAgeMs > 0 &&
      Number.isFinite(freshnessAgeMs) &&
      freshnessAgeMs >= authorityMaxAgeMs;
    sendWebExperienceTelemetry({
      actionId: 'minimap_freshness',
      success: !stale,
      stale,
      freshnessMs: Number.isFinite(freshnessAgeMs) ? freshnessAgeMs : null,
      durationMs: Number.isFinite(freshnessAgeMs) ? freshnessAgeMs : null,
      visibleDurationMs: Number.isFinite(freshnessAgeMs) ? freshnessAgeMs : null,
      playerPerceivedMs: Number.isFinite(freshnessAgeMs) ? freshnessAgeMs : null,
      errorCode: stale ? 'STALE_AUTHORITATIVE_STATE' : null,
      authoritySource: 'RATHENA_LIVE_STATUS',
    });
    minimapFreshnessTelemetryLastAt = now;
  }
  minimapLive = live;
  if (lastLiveHp !== null && live.hp < lastLiveHp) damageFlashUntil = now + 180;
  lastLiveHp = live.hp;
  $('#mapMonsterCount').textContent = String(
    Number.isFinite(mapMonsterCount) ? mapMonsterCount : 0,
  );
  $('#mapPlayerCount').textContent = String(
    Number.isFinite(mapPlayerCount) ? mapPlayerCount : 0,
  );
  $('#mapPosition').textContent = mapFieldError
    ? `${mapNames[live.map] ?? live.map} · ${mapFieldError}`
    : compactMinimapViewport()
      ? `${mapNames[live.map] ?? live.map} (${live.playerX}, ${live.playerY})`
      : `${mapNames[live.map] ?? live.map} (${live.playerX}, ${live.playerY}) · 視野怪物 ${retainStale ? (minimapLive?.monsters?.length ?? monsters.length) : monsters.length}${retainStale ? ' · 狀態更新延遲' : ''}`;
  noteMinimapFreshness(live);
  startMinimapFreshnessClock();
  renderMinimapFreshness();
  if (!minimapFrame) minimapFrame = requestAnimationFrame(paintMinimap);
}
function syncMinimapCanvas(canvas) {
  const available = Math.floor(canvas.parentElement.clientWidth - 12);
  if (available < 240) return;
  const original = ensureOriginalMinimapManager()?.state(mapFieldName),
    originalWidth = Number(original?.entry?.width),
    originalHeight = Number(original?.entry?.height),
    useOriginal =
      original?.mode === 'RO_ORIGINAL' &&
      Number.isFinite(originalWidth) &&
      Number.isFinite(originalHeight),
    naturalWidth = useOriginal ? originalWidth : mapField?.width,
    naturalHeight = useOriginal ? originalHeight : mapField?.height;
  const width = available,
    ratio = naturalWidth && naturalHeight ? naturalHeight / naturalWidth : 1,
    height = Math.max(240, Math.round(width * ratio));
  canvas.style.height = `${height}px`;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    minimapTerrain = null;
    minimapTerrainKey = '';
  }
}
function terrainLayer() {
  const key = `${mapFieldName}:${mapField?.width}:${mapField?.height}`;
  if (minimapTerrain && minimapTerrainKey === key) return minimapTerrain;
  const layer = document.createElement('canvas');
  layer.width = mapField.width;
  layer.height = mapField.height;
  const ctx = layer.getContext('2d');
  ctx.fillStyle = '#050805';
  ctx.fillRect(0, 0, layer.width, layer.height);
  ctx.fillStyle = '#617365';
  for (let y = 0; y < mapField.height; y++)
    for (let x = 0; x < mapField.width; x++)
      if (mapField.cells[y * mapField.width + x] & 1)
        ctx.fillRect(x, mapField.height - 1 - y, 1, 1);
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
    const originalApi = originalMinimapApi(),
      originalManager = ensureOriginalMinimapManager(),
      background = originalManager?.state(mapFieldName),
      sourceWidth =
        background?.mode === 'RO_ORIGINAL'
          ? Number(background.entry?.width)
          : mapField.width,
      sourceHeight =
        background?.mode === 'RO_ORIGINAL'
          ? Number(background.entry?.height)
          : mapField.height,
      baseRect = originalApi
        ? originalApi.fitRect(width, height, sourceWidth, sourceHeight)
        : { x: 0, y: 0, width, height },
      rect = originalApi
        ? originalApi.viewportRect(
            baseRect,
            mapField,
            { x: live.playerX, y: live.playerY },
            originalManager?.getZoom() ?? 1,
            { width, height },
          )
        : baseRect;
    if (background?.mode === 'RO_ORIGINAL' && background.image)
      ctx.drawImage(background.image, rect.x, rect.y, rect.width, rect.height);
    else
      ctx.drawImage(terrainLayer(), rect.x, rect.y, rect.width, rect.height);
    canvas.dataset.backgroundMode = background?.mode ?? 'COLLISION_MAP';
    canvas.dataset.fallbackReason = background?.reason ?? '';
    canvas.title =
      background?.mode === 'RO_ORIGINAL'
        ? 'RO 原廠彩色小地圖'
        : `碰撞地圖${background?.reason ? `：${background.reason}` : ''}`;
    const projected = (x, y) =>
      originalApi
        ? originalApi.worldMapCoordinate({ x, y }, mapField, rect)
        : { x: rect.x + x, y: rect.y + mapField.height - y };
    const point = (x, y, size, color) => {
      const pixel = projected(x, y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    const route = Array.isArray(live.route) ? live.route : [];
    for (const step of route) point(step.x, step.y, 2, '#fff2a8');
    for (const portal of live.portals ?? [])
      point(portal.x ?? portal.pos?.x, portal.y ?? portal.pos?.y, 6, '#ff9854');
    for (const npc of live.npcs ?? [])
      point(npc.x ?? npc.pos?.x, npc.y ?? npc.pos?.y, 5, '#c873ff');
    if (minimapCombatObserved) {
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
    }
    const self = sampleMinimapTrack(minimapTracks.get('self'), now);
    const selfPixel = projected(self.x, self.y),
      selfX = selfPixel.x,
      selfY = selfPixel.y,
      presence = minimapPresenceApi();
    if (
      minimapCombatObserved &&
      !minimapPlayerStale &&
      presence &&
      Array.isArray(live.players)
    ) {
      const compact = compactMinimapViewport(),
        fontSize = compact ? 10 : 11,
        labelCandidates = [];
      for (const player of live.players) {
        const position = sampleMinimapTrack(
          minimapTracks.get(`player:${player.id}`),
          now,
        );
        const playerPixel = projected(position.x, position.y),
          playerX = playerPixel.x,
          playerY = playerPixel.y;
        ctx.fillStyle = '#70b8ff';
        ctx.strokeStyle = '#0b2a45';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(playerX - 3, playerY - 3, 6, 6);
        ctx.fill();
        ctx.stroke();
        const name = String(player.name ?? '').trim();
        if (!name) continue;
        labelCandidates.push({
          key: `player:${player.id}`,
          text: name,
          x: playerX,
          y: playerY,
          distance: Math.hypot(playerX - selfX, playerY - selfY),
          markerSize: 6,
        });
      }
      const placements = presence.placePlayerLabels(labelCandidates, {
        width,
        height,
        fontSize,
        maxLabels: presence.maxPlayerLabels(window.innerWidth),
        margin: 2,
      });
      ctx.font = `${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
      ctx.textBaseline = 'middle';
      for (const placement of placements) {
        ctx.fillStyle = '#04121fdd';
        ctx.fillRect(placement.x, placement.y, placement.w, placement.h);
        ctx.strokeStyle = '#2f6ea5';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          placement.x + 0.5,
          placement.y + 0.5,
          placement.w - 1,
          placement.h - 1,
        );
        ctx.fillStyle = '#dff0ff';
        ctx.fillText(placement.text, placement.x + 3, placement.y + placement.h / 2);
      }
    }
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
function renderMinimap(live, options = {}) {
  if (!live) return;
  ensureMap(live.map);
  updateMinimapTargets(live, options);
  syncMapInfoToLive(live);
}

function applyObservationPolicy(policy) {
  const incoming = policy?.interests;
  if (!incoming) return;
  observationPolicy = Object.fromEntries(
    Object.values(ObservationInterest).map((interest) => [
      interest,
      { ...DEFAULT_OBSERVATION_POLICY[interest], ...(incoming[interest] ?? {}) },
    ]),
  );
}

function applyCombatStreamState(state) {
  if (!state) return;
  const wasEligible = Boolean(combatStreamConfig.eligible);
  combatStreamConfig = { ...combatStreamConfig, ...state };
  if (Number.isInteger(Number(state.cursor)))
    combatStreamSnapshotCursor = Number(state.cursor);
  if (Number.isFinite(Number(state.combatRevision)))
    combatStreamRevision = Number(state.combatRevision);
  if (wasEligible !== Boolean(combatStreamConfig.eligible) && authenticated)
    restartCombatDelivery();
}

function combatStreamAvailable() {
  return (
    combatStreamConfig.enabled &&
    combatStreamConfig.eligible &&
    typeof EventSource === 'function'
  );
}

function closeCombatStream() {
  clearTimeout(combatStreamReconnectTimer);
  combatStreamReconnectTimer = null;
  if (combatStream) combatStream.close();
  combatStream = null;
  combatStreamActive = false;
}

function mergeCombatLive(live) {
  if (!live || !lastState?.character) return;
  const mergedLive = mergeProjectedDerived(
    lastState.derived,
    live,
    'combat-stream',
  );
  lastState = { ...lastState, derived: mergedLive };
  setCharacterHeader(lastState.character, mergedLive);
  renderJobChange(lastState.character, mergedLive);
  renderTaskActionLog(mergedLive);
  renderMinimap(mergedLive);
}

async function recoverCombatStream(reason = 'revision_gap', latencyTrace = null) {
  if (combatStreamRecoveryPromise) return await combatStreamRecoveryPromise;
  const recovery = (async () => {
    closeCombatStream();
    combatStreamLastEventId = '';
    combatStreamSeenIds.clear();
    eventCursor = null;
    $('#logLatency').textContent = '同步戰鬥快照';
    const snapshot = await api('/api/combat-snapshot', { latencyTrace });
    applyCombatStreamState(snapshot.combatStream);
    combatStreamSnapshotCursor = Number(snapshot.cursor ?? 0);
    combatStreamRevision = Number(snapshot.combatRevision ?? 0);
    eventCursor = combatStreamSnapshotCursor;
    mergeCombatLive(snapshot.live);
    if (
      authenticated &&
      currentWebInterest() === ObservationInterest.COMBAT_PAGE &&
      document.visibilityState === 'visible'
    )
      startCombatStream(reason);
  })();
  combatStreamRecoveryPromise = recovery;
  try {
    return await recovery;
  } finally {
    if (combatStreamRecoveryPromise === recovery)
      combatStreamRecoveryPromise = null;
  }
}

function rememberCombatEventId(eventId) {
  if (!eventId || combatStreamSeenIds.has(eventId)) return false;
  combatStreamSeenIds.add(eventId);
  while (combatStreamSeenIds.size > 256)
    combatStreamSeenIds.delete(combatStreamSeenIds.values().next().value);
  return true;
}

function scheduleCombatStreamReconnect() {
  if (
    !authenticated ||
    currentWebInterest() !== ObservationInterest.COMBAT_PAGE ||
    document.visibilityState !== 'visible' ||
    !combatStreamAvailable()
  )
    return;
  const now = Date.now();
  combatStreamReconnects = combatStreamReconnects.filter(
    (at) => now - at < 10_000,
  );
  const stormDelay = combatStreamReconnects.length >= 8 ? 10_000 : 0;
  const exponential = Math.min(
    15_000,
    500 * 2 ** Math.min(combatStreamFailures, 5),
  );
  const jitter = 0.7 + Math.random() * 0.6;
  const delay = Math.max(stormDelay, Math.round(exponential * jitter));
  combatStreamReconnectTimer = setTimeout(() => {
    combatStreamReconnectTimer = null;
    combatStreamReconnects.push(Date.now());
    startCombatStream('reconnect');
  }, delay);
}

function startCombatStream() {
  if (
    combatStream ||
    !combatStreamAvailable() ||
    currentWebInterest() !== ObservationInterest.COMBAT_PAGE ||
    document.visibilityState !== 'visible'
  )
    return;
  const cursor = Number.isInteger(eventCursor)
      ? eventCursor
      : Number(combatStreamSnapshotCursor ?? 0),
    parameters = new URLSearchParams({
      viewer: webViewerId,
      interest: ObservationInterest.COMBAT_PAGE,
      cursor: String(cursor),
      revision: String(combatStreamRevision),
    });
  if (combatStreamLastEventId)
    parameters.set('lastEventId', combatStreamLastEventId);
  const source = new EventSource(
    `${combatStreamConfig.endpoint ?? '/api/combat-stream'}?${parameters}`,
  );
  combatStream = source;
  source.addEventListener('ready', (event) => {
    if (source !== combatStream) return;
    const data = JSON.parse(event.data);
    combatStreamActive = true;
    combatStreamFailures = 0;
    globalThis.playerWebObservability?.record('SSE', 'reconnect_count', combatStreamFailures, 'count', { event: 'ready' });
    eventCursor = Number(data.cursor);
    combatStreamRevision = Number(data.combatRevision ?? combatStreamRevision);
    clearTimeout(eventTimer);
    eventTimer = null;
    $('#logLatency').textContent = '即時連線';
  });
  source.addEventListener('combat_delta', (event) => {
    if (source !== combatStream) return;
    const data = JSON.parse(event.data);
    const deliveryDelay = Date.now() - Number(data.timestamp ?? Date.now());
    globalThis.playerWebObservability?.record('SSE', 'event_gap_ms', Math.max(0, deliveryDelay), 'ms', { eventId: data.eventId ?? null });
    globalThis.playerWebObservability?.record('COMBAT_PRESENTATION', 'event_delivery_latency_ms', Math.max(0, deliveryDelay), 'ms', { event: 'combat_delta' });
    if (!rememberCombatEventId(data.eventId)) return;
    if (
      Number(data.characterId) !== Number(lastState?.character?.charId) ||
      (Number.isInteger(eventCursor) && Number(data.fromCursor) !== eventCursor)
    ) {
      void recoverCombatStream('revision_gap');
      return;
    }
    eventCursor = Number(data.cursor);
    combatStreamSnapshotCursor = eventCursor;
    combatStreamRevision = Number(data.combatRevision ?? combatStreamRevision);
    combatStreamLastEventId = data.eventId;
    renderEventDelta(data.lines ?? [], false);
    mergeCombatLive(data.live);
    $('#logLatency').textContent = `${Math.max(0, Date.now() - Number(data.timestamp ?? Date.now()))}ms`;
  });
  source.addEventListener('resnapshot_required', () => {
    if (source === combatStream) void recoverCombatStream('server_resnapshot');
  });
  source.onerror = () => {
    if (source !== combatStream) return;
    source.close();
    combatStream = null;
    combatStreamActive = false;
    combatStreamFailures += 1;
    globalThis.playerWebObservability?.record('SSE', 'reconnect_count', combatStreamFailures, 'count', { event: 'error' });
    $('#logLatency').textContent = '即時連線恢復中';
    restartEventPolling();
    scheduleCombatStreamReconnect();
  };
}

function restartCombatDelivery() {
  if (
    currentWebInterest() === ObservationInterest.COMBAT_PAGE &&
    document.visibilityState === 'visible' &&
    combatStreamAvailable()
  ) {
    startCombatStream();
    if (!combatStreamActive) restartEventPolling();
    return;
  }
  closeCombatStream();
  restartEventPolling();
}

function currentWebInterest() {
  if (!authenticated || $('#game').classList.contains('hidden'))
    return ObservationInterest.NO_WEB;
  if (document.visibilityState !== 'visible') return ObservationInterest.HIDDEN;
  const activeTab = document.querySelector('[data-tab].active')?.dataset.tab;
  if (activeTab === 'hunt' && $('#worldMapOverlay').classList.contains('hidden'))
    return ObservationInterest.COMBAT_PAGE;
  if (activeTab === 'quests') return ObservationInterest.QUEST_PAGE;
  if (['character', 'skills', 'equipment', 'inventory'].includes(activeTab))
    return ObservationInterest.INVENTORY_PAGE;
  if (activeTab) return ObservationInterest.OTHER_GAME_PAGE;
  return ObservationInterest.IDLE_PAGE;
}

function currentWebViewMode(interest = currentWebInterest()) {
  if (interest === ObservationInterest.NO_WEB) return 'hidden';
  if (interest === ObservationInterest.HIDDEN) return 'hidden';
  return interest === ObservationInterest.COMBAT_PAGE ? 'high' : 'low';
}

function policyForInterest(interest = currentWebInterest()) {
  return observationPolicy[interest] ?? observationPolicy.IDLE_PAGE;
}

function eventPollInterval(interest = currentWebInterest()) {
  return policyForInterest(interest).eventPollMs;
}

function eventApiUrl({ cursor = eventCursor, forceHigh = false } = {}) {
  const parameters = new URLSearchParams();
  const interest = forceHigh
    ? ObservationInterest.COMBAT_PAGE
    : currentWebInterest();
  if (cursor !== null) parameters.set('cursor', String(cursor));
  parameters.set('viewer', webViewerId);
  parameters.set('interest', interest);
  parameters.set('view', currentWebViewMode(interest));
  return `/api/events?${parameters}`;
}

function reportWebPresence(interest = currentWebInterest(), keepalive = false) {
  if (!authenticated) return Promise.resolve();
  return fetch('/api/web-presence', {
    method: 'POST',
    cache: 'no-store',
    keepalive,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      viewerId: webViewerId,
      interest,
      mode: currentWebViewMode(interest),
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Web presence update failed');
    })
    .catch(() => {});
}

const webActivityHeartbeatMs = 25000;
function reportWebActivityPresence() {
  if (!authenticated) return Promise.resolve();
  const visibility =
    document.visibilityState === 'hidden' ? 'hidden' : 'visible';
  const interest = currentWebInterest();
  return fetch('/api/web-presence', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      visibility,
      viewerId: webViewerId,
      interest,
      mode: currentWebViewMode(interest),
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Web activity heartbeat failed');
    })
    .catch(() => {});
}
function stopWebActivityHeartbeat() {
  if (webActivityHeartbeatTimer !== null)
    clearInterval(webActivityHeartbeatTimer);
  webActivityHeartbeatTimer = null;
}
function restartWebActivityHeartbeat() {
  stopWebActivityHeartbeat();
  if (!authenticated) return;
  void reportWebActivityPresence();
  webActivityHeartbeatTimer = setInterval(
    () => void reportWebActivityPresence(),
    webActivityHeartbeatMs,
  );
}

function restartEventPolling() {
  clearTimeout(eventTimer);
  eventTimer = null;
  if (!authenticated) return;
  if (eventPollActive) {
    eventPollRestartRequested = true;
    return;
  }
  eventTimer = setTimeout(pollEvents, 0);
}

// MINIMAP POSITION DELIVERY. The authoritative position is projected by the
// server to a single-row shape and delivered on the Web interest cadence
// (`positionPollMs`). The marker is only repainted when the authoritative
// sample actually changed, and an older sample can never move it backwards.
function positionPollInterval(interest = currentWebInterest()) {
  return Number(policyForInterest(interest).positionPollMs) || 0;
}
function positionSampleUnchanged(position) {
  const current = minimapLive;
  if (!current) return false;
  return (
    current.map === position.map &&
    Number(current.playerX) === Number(position.x) &&
    Number(current.playerY) === Number(position.y) &&
    Number(current.updatedAt ?? current.freshness?.authoritativeAt ?? 0) ===
      Number(position.updatedAt)
  );
}
function applyLivePosition(position) {
  if (!position?.available || !Number.isFinite(Number(position.x))) return;
  if (positionSampleUnchanged(position)) return;
  const displayedAt = Number(
    minimapLive?.freshness?.authoritativeAt ?? minimapLive?.updatedAt ?? 0,
  );
  const incomingAt = Number(position.updatedAt);
  if (
    minimapLive?.map &&
    position.map === minimapLive.map &&
    Number.isFinite(displayedAt) &&
    Number.isFinite(incomingAt) &&
    incomingAt < displayedAt
  )
    return;
  const base = lastState?.derived ?? {};
  const combatObserved = Object.hasOwn(base, 'players');
  const merged = {
    ...base,
    map: position.map ?? base.map,
    playerX: position.x,
    playerY: position.y,
    updatedAt: Number.isFinite(incomingAt) ? incomingAt : base.updatedAt,
  };
  if (position.freshness) merged.freshness = position.freshness;
  if (Number.isFinite(Number(position.statusIntervalMs)))
    merged.statusIntervalMs = Number(position.statusIntervalMs);
  if (lastState) lastState = { ...lastState, derived: merged };
  renderMinimap(merged, { combatObserved });
}
async function pollLivePosition() {
  positionTimer = null;
  if (!authenticated) return;
  const interval = positionPollInterval();
  if (!interval) return;
  const id = Number(lastState?.character?.charId ?? controllerState?.charId);
  if (
    !positionInFlight &&
    Number.isSafeInteger(id) &&
    id > 0
  ) {
    positionInFlight = true;
    try {
      const position = await api(`/api/live-position?characterId=${id}`);
      applyLivePosition(position);
    } catch {
      // A failed position probe never disturbs the minimap; the slower polls
      // remain the fallback and the next tick retries.
    } finally {
      positionInFlight = false;
    }
  }
  if (authenticated && positionPollInterval())
    positionTimer = setTimeout(() => void pollLivePosition(), interval);
}
function restartPositionPolling() {
  if (positionTimer !== null) clearTimeout(positionTimer);
  positionTimer = null;
  if (!authenticated || $('#game').classList.contains('hidden')) return;
  if (!positionPollInterval()) return;
  void pollLivePosition();
}

function restartStatePolling({ immediate = false } = {}) {
  restartPositionPolling();
  clearInterval(statePoll);
  statePoll = null;
  if (!authenticated || $('#game').classList.contains('hidden')) return;
  const interval = policyForInterest().statePollMs;
  if (!interval) return;
  statePoll = setInterval(
    () =>
      void refresh({
        full:
          currentWebInterest() === ObservationInterest.QUEST_PAGE &&
          lastState?.derived?.domainRevisions?.quest === undefined,
      }),
    interval,
  );
  if (immediate) void refresh({ full: false });
}

async function pollEvents() {
  const interest = currentWebInterest();
  if (!authenticated || interest === ObservationInterest.NO_WEB) return;
  if (eventPollActive) {
    eventPollRestartRequested = true;
    return;
  }
  eventPollActive = true;
  const pollStartedAt = performance.now();
  try {
    const data = await api(eventApiUrl());
    eventCursor = data.cursor;
    renderEventDelta(data.lines, data.reset);
    if (data.interest === ObservationInterest.COMBAT_PAGE)
      renderMinimap(data.live);
    if (data.live && lastState?.character) {
      const mergedLive = mergeProjectedDerived(
        lastState.derived,
        data.live,
        'event-poll',
      );
      lastState = { ...lastState, derived: mergedLive };
      setCharacterHeader(lastState.character, mergedLive);
      renderJobChange(lastState.character, mergedLive);
      renderTaskActionLog(mergedLive);
      const questRevision = mergedLive.domainRevisions?.quest;
      if (
        interest === ObservationInterest.QUEST_PAGE &&
        questRevision !== undefined &&
        String(questRevision) !== String(lastQuestFullRevision)
      ) {
        lastQuestFullRevision = questRevision;
        void refresh({ full: true });
      }
    }
    eventPollFailures = 0;
  } catch (error) {
    eventPollFailures += 1;
    if (/登入/.test(error.message)) return;
    $('#logLatency').textContent = '重新連線中';
  } finally {
    eventPollActive = false;
  }
  if (combatStreamActive) return;
  const modeInterval = eventPollInterval();
  const restartImmediately = eventPollRestartRequested;
  eventPollRestartRequested = false;
  eventTimer = setTimeout(
    pollEvents,
    restartImmediately
      ? 0
      : eventPollFailures
      ? Math.min(
          POLL_RETRY_MAX_MS,
          modeInterval * 2 ** Math.min(eventPollFailures, 4),
        )
      : Math.max(
          0,
          modeInterval - (performance.now() - pollStartedAt),
        ),
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
    baseExp = finiteNumber(derived?.baseExp ?? c.baseExp)
      ? Number(derived?.baseExp ?? c.baseExp)
      : null,
    jobExp = finiteNumber(derived?.jobExp ?? c.jobExp)
      ? Number(derived?.jobExp ?? c.jobExp)
      : null,
    baseExpMax = finiteNumber(derived?.baseExpMax)
      ? Number(derived.baseExpMax)
      : null,
    jobExpMax = finiteNumber(derived?.jobExpMax)
      ? Number(derived.jobExpMax)
      : null,
    hp = finiteNumber(derived?.hp ?? c.hp)
      ? Number(derived?.hp ?? c.hp)
      : null,
    maxHp = finiteNumber(derived?.maxHp ?? c.maxHp)
      ? Number(derived?.maxHp ?? c.maxHp)
      : null,
    sp = finiteNumber(derived?.sp ?? c.sp)
      ? Number(derived?.sp ?? c.sp)
      : null,
    maxSp = finiteNumber(derived?.maxSp ?? c.maxSp)
      ? Number(derived?.maxSp ?? c.maxSp)
      : null,
    zeny = finiteNumber(derived?.zeny ?? c.zeny)
      ? Number(derived?.zeny ?? c.zeny)
      : null,
    map = derived?.map || c.map,
    x = finiteNumber(derived?.playerX ?? c.x)
      ? Number(derived?.playerX ?? c.x)
      : null,
    y = finiteNumber(derived?.playerY ?? c.y)
      ? Number(derived?.playerY ?? c.y)
      : null,
    job = jobNames[classId] ?? `職業 ${classId}`;
  $('#name').textContent = c.name;
  $('#jobName').textContent = job;
  $('#base').textContent = baseLevel;
  $('#jobLevel').textContent = jobLevel;
  $('#baseExp').textContent = expProgressText(baseExp, baseExpMax);
  $('#jobExp').textContent = expProgressText(jobExp, jobExpMax);
  $('#baseExp').title = expProgressDetail(baseExp, baseExpMax);
  $('#jobExp').title = expProgressDetail(jobExp, jobExpMax);
  $('#hpText').textContent =
    hp === null || maxHp === null ? '—' : `${hp} / ${maxHp}`;
  $('#spText').textContent =
    sp === null || maxSp === null ? '—' : `${sp} / ${maxSp}`;
  $('#hpBar').style.width = pct(hp ?? 0, maxHp ?? 0);
  $('#spBar').style.width = pct(sp ?? 0, maxSp ?? 0);
  $('#baseBar').style.width = pct(baseExp ?? 0, baseExpMax ?? 0);
  $('#jobBar').style.width = pct(jobExp ?? 0, jobExpMax ?? 0);
  $('#weight').textContent =
    String(derived?.weight ?? 0) + ' / ' + String(derived?.maxWeight ?? 0);
  $('#zeny').textContent = zeny === null ? '—' : zeny.toLocaleString();
  $('#location').textContent = `${mapNames[map] ?? map ?? '—'} (${x ?? '—'}, ${y ?? '—'})`;
}

function expProgressText(current, required) {
  if (!finiteNumber(current)) return '—';
  if (!(required > 0)) return `${current.toLocaleString()} EXP · 同步中`;
  const progress = Math.min(100, Math.max(0, (current / required) * 100));
  return `${current.toLocaleString()} / ${required.toLocaleString()} EXP · ${progress.toFixed(1)}%`;
}
function expProgressDetail(current, required) {
  if (!finiteNumber(current)) return '經驗資料未同步';
  if (!(required > 0)) return '需求經驗同步中';
  const progress = Math.min(100, Math.max(0, (current / required) * 100));
  const remaining = Math.max(0, required - current);
  return `${current.toLocaleString()} / ${required.toLocaleString()} EXP · ${progress.toFixed(2)}% · 尚差 ${remaining.toLocaleString()}`;
}

function setCharacter(c, derived) {
  if (!c) return;
  currentCharacterName = c.name;
  setCharacterHeader(c, derived);
  const payloadValid = reportInvalidCharacterStatPayload(
      c,
      derived,
      'character-render',
    ),
    rawStatusPoints = derived?.statusPoint ?? c.statusPoint,
    availableStatusPoints = finiteNumber(rawStatusPoints)
      ? Number(rawStatusPoints)
      : null;
  $('#points').textContent = `Status Point ${availableStatusPoints ?? '—'}`;
  $('#statusPointValue').textContent = `${availableStatusPoints ?? '—'}`;
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
      const rawBaseValue = derived?.[key] ?? c[key],
        baseValue =
          finiteNumber(rawBaseValue) && Number(rawBaseValue) >= 1
            ? Number(rawBaseValue)
            : null,
        cost = baseValue === null ? null : statCost(baseValue),
        bonus = finiteNumber(bonuses[key]) ? Number(bonuses[key]) : null,
        row = document.createElement('div');
      row.dataset.statRow = key;
      const name = document.createElement('span');
      name.className = 'ro-status-label';
      name.textContent = label;
      const value = document.createElement('b');
      value.className = 'ro-status-value';
      value.textContent = baseValue === null ? '—' : String(baseValue);
      const bonusValue = document.createElement('span');
      bonusValue.className = 'ro-status-bonus';
      bonusValue.textContent = bonus ? `+${bonus}` : '';
      const requirement = document.createElement('small');
      requirement.className = 'ro-status-cost';
      requirement.textContent = cost === null ? '資料未同步' : `需要 ${cost}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.stat = key;
      button.dataset.roPrimitive = 'RoIconButton';
      button.dataset.roSourceState = 'SOURCE_VERIFIED';
      button.className = 'ro-status-increase';
      button.setAttribute('aria-label', `增加 ${label}`);
      button.title = cost === null ? '資料未同步' : `增加 ${label}，需要 ${cost} 點`;
      button.disabled =
        !payloadValid ||
        availableStatusPoints === null ||
        cost === null ||
        availableStatusPoints < cost;
      button.textContent = '增加';
      row.title = button.title;
      row.append(name, value, bonusValue, requirement, button);
      return row;
    }),
  );
  const statNumber = (field) =>
      finiteNumber(derived?.[field]) ? Number(derived[field]) : null,
    pair = (left, right, separator = ' + ') =>
      left === null || right === null ? '—' : `${left}${separator}${right}`,
    details = derived
      ? [
          ['attack', 'Atk', pair(statNumber('attack'), statNumber('attackBonus'))],
          ['def', 'Def', pair(statNumber('def'), statNumber('defBonus'))],
          ['matk', 'Matk', pair(statNumber('matkMin'), statNumber('matkMax'), ' ~ ')],
          ['mdef', 'Mdef', pair(statNumber('mdef'), statNumber('mdefBonus'))],
          ['hit', 'Hit', statNumber('hit') ?? '—'],
          ['flee', 'Flee', pair(statNumber('flee'), statNumber('fleeBonus'))],
          ['critical', 'Critical', statNumber('critical') ?? '—'],
          ['aspd', 'Aspd', statNumber('aspd') ?? '—'],
        ]
      : null;
  $('#derivedStats').replaceChildren(
    ...(
      details ?? [
        ['attack', 'Atk', '同步中'],
        ['def', 'Def', '同步中'],
        ['matk', 'Matk', '同步中'],
        ['mdef', 'Mdef', '同步中'],
        ['hit', 'Hit', '同步中'],
        ['flee', 'Flee', '同步中'],
        ['critical', 'Critical', '同步中'],
        ['aspd', 'Aspd', '同步中'],
      ]
    ).map(([key, label, value]) => {
      const row = document.createElement('div');
      row.dataset.derivedRow = key;
      const name = document.createElement('span');
      name.className = 'ro-derived-label';
      name.textContent = label;
      const amount = document.createElement('b');
      amount.className = 'ro-derived-value';
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
  Dagger: '飛刀',
  Bullet: '子彈',
  Shell: '彈殼',
  Grenade: '榴彈',
  Shuriken: '飛鏢',
  Kunai: '苦無',
  Cannonball: '砲彈',
  Throwweapon: '投擲武器',
});
// rAthena exports every Type: Ammo item as IT_AMMO (10) in the live inventory.
const skillAmmoItemTypes = Object.freeze({
  Arrow: 10,
  Dagger: 10,
  Bullet: 10,
  Shell: 10,
  Grenade: 10,
  Shuriken: 10,
  Kunai: 10,
  Cannonball: 10,
  Throwweapon: 10,
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

const firstSkillLayout = {
  1: 'SWORDMAN', 2: 'MAGICIAN', 3: 'ARCHER', 4: 'ACOLYTE',
  5: 'MERCHANT', 6: 'THIEF',
};
const advancedSkillLayout = {
  7: [1, 'KNIGHT'], 8: [4, 'PRIEST'], 9: [2, 'WIZARD'],
  10: [5, 'BLACKSMITH'], 11: [3, 'HUNTER'], 12: [6, 'ASSASSIN'],
  14: [1, 'CRUSADER'], 15: [4, 'MONK'], 16: [2, 'SAGE'],
  17: [6, 'ROGUE'], 18: [5, 'ALCHEMIST'], 19: [3, 'BARD'],
  20: [3, 'DANCER'],
};
const expandedSkillLayout = {
  23: 'SUPERNOVICE', 24: 'GUNSLINGER', 25: 'NINJA', 4046: 'TAEKWON',
};
function skillLayoutSections(classId) {
  if (classId === 0) return [{ key: 'JT_NOVICE', name: '初心者' }];
  if (firstSkillLayout[classId]) return [
    { key: 'JT_NOVICE', name: '初心者' },
    { key: `JT_${firstSkillLayout[classId]}`, name: skillTreeData.jobs[String(classId)].name },
  ];
  if (advancedSkillLayout[classId]) {
    const [firstId, advanced] = advancedSkillLayout[classId];
    return [
      { key: 'JT_NOVICE', name: '初心者' },
      { key: `JT_${firstSkillLayout[firstId]}`, name: skillTreeData.jobs[String(firstId)].name },
      { key: `JT_${advanced}`, name: skillTreeData.jobs[String(classId)].name },
    ];
  }
  if (expandedSkillLayout[classId]) return [
    { key: `JT_${expandedSkillLayout[classId]}`, name: skillTreeData.jobs[String(classId)].name },
  ];
  return [];
}
function fillSkillDetail(target, skill, level, liveSkills, derived) {
  const heading = document.createElement('strong');
  heading.className = 'skill-detail-heading';
  heading.textContent = `${skill.name}${skill.englishName ? ` (${skill.englishName})` : ''}`;
  const maximum = document.createElement('span');
  maximum.textContent = `目前 Lv.${level} / MAX Lv.${skill.maxLevel}`;
  const requirements = document.createElement('div');
  requirements.className = 'skill-detail-requirements';
  if (skill.requires?.length) {
    const label = document.createElement('b');
    label.textContent = '前置技能';
    requirements.append(label);
    for (const required of skill.requires) {
      const owned = Number(liveSkills.get(required.handle)?.level ??
        (required.handle === 'NV_BASIC' ? derived?.basicSkillLevel : 0) ?? 0);
      const line = document.createElement('span');
      line.className = owned >= required.level ? 'met' : 'unmet';
      line.textContent = `${required.name} Lv.${required.level}（目前 Lv.${owned}）`;
      requirements.append(line);
    }
  } else {
    requirements.textContent = '無前置技能';
  }
  const description = document.createElement('p');
  description.className = 'skill-detail-description';
  description.textContent = skill.description || '目前沒有此技能說明。';
  target.replaceChildren(heading, maximum, requirements, description);
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
  const oldDialog = $('#skillDetailDialog');
  if (oldDialog?.open) oldDialog.close();
  const controlEntries = job.skills.map((skill) => {
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
      const resolvedSkill = window.roAssetResolver?.resolveSkillAsset({
        skillId: skill.id,
        internalName: skill.handle,
      });
      if (resolvedSkill?.asset?.webPath) {
        const icon = document.createElement('img');
        icon.className = 'skill-icon';
        icon.src = resolvedSkill.asset.webPath;
        icon.alt = '';
        icon.title = roAssetTooltip(resolvedSkill, skill);
        icon.dataset.assetStatus = resolvedSkill.assetStatus;
        icon.onerror = () => {
          icon.dataset.assetStatus = 'load-error';
          icon.remove();
          console.debug('MISSING_RO_ASSET', { kind: 'skill', skillId: skill.id });
        };
        information.append(icon);
      }
      const name = document.createElement('b');
      name.textContent = resolvedSkill?.name ?? skill.name;
      const meta = document.createElement('small');
      const requirements = skill.requires
        .map((requirement) => `${requirement.name} Lv.${requirement.level}`)
        .join('、');
      meta.textContent = `${roAssetDebug ? `${skill.handle} · ` : ''}最高 Lv.${skill.maxLevel}${requirements ? ` · 前置 ${requirements}` : ''}`;
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
      if (skill.quest && level > 0) {
        const granted = document.createElement('span');
        granted.className = 'skill-quest-granted';
        granted.textContent = '轉職自動取得';
        information.append(granted);
      }
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
    });

  const tree = document.createElement('div');
  tree.className = 'skill-tree-sections';
  tree.dataset.layoutSource = skillTreeLayouts?.sourceSha256 ?? 'unavailable';
  const tooltip = document.createElement('div');
  tooltip.className = 'skill-tree-tooltip';
  tooltip.id = 'skillTreeTooltip';
  tooltip.role = 'tooltip';
  tooltip.hidden = true;
  tooltip.addEventListener('pointerleave', () => {
    tooltip.hidden = true;
    clearSkillHighlight();
  });
  const dialog = document.createElement('dialog');
  dialog.id = 'skillDetailDialog';
  dialog.className = 'skill-detail-dialog';
  dialog.setAttribute('aria-label', '技能詳細說明');
  const dialogBody = document.createElement('div');
  dialogBody.className = 'skill-detail-body';
  const dialogActions = document.createElement('div');
  dialogActions.className = 'skill-detail-actions';
  const detailAdd = document.createElement('button');
  detailAdd.type = 'button';
  detailAdd.id = 'skillDetailAdd';
  detailAdd.className = 'skill-detail-add';
  detailAdd.textContent = '提升技能 1 點';
  const detailClose = document.createElement('button');
  detailClose.type = 'button';
  detailClose.className = 'official-skin-button official-cancel';
  detailClose.setAttribute('aria-label', '關閉技能說明');
  detailClose.addEventListener('click', () => dialog.close());
  dialogActions.append(detailAdd, detailClose);
  dialog.append(dialogBody, dialogActions);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  const skillByHandle = new Map(job.skills.map((skill) => [skill.handle, skill]));
  const nodesByHandle = new Map();
  const placed = new Set();
  function clearSkillHighlight() {
    for (const node of nodesByHandle.values()) {
      node.classList.remove('is-selected', 'is-prerequisite');
    }
  }
  dialog.addEventListener('close', clearSkillHighlight);
  function highlightSkill(skill) {
    clearSkillHighlight();
    nodesByHandle.get(skill.handle)?.classList.add('is-selected');
    for (const required of skill.requires ?? []) {
      nodesByHandle.get(required.handle)?.classList.add('is-prerequisite');
    }
  }
  function showTooltip(trigger, skill, level) {
    if (dialog.open) return;
    highlightSkill(skill);
    fillSkillDetail(tooltip, skill, level, liveSkills, derived);
    tooltip.hidden = false;
    const bounds = trigger.getBoundingClientRect();
    const width = tooltip.getBoundingClientRect().width;
    const height = tooltip.getBoundingClientRect().height;
    const left = bounds.right + width <= window.innerWidth - 8
      ? bounds.right : Math.max(8, bounds.left - width);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, Math.min(bounds.top, window.innerHeight - height - 8))}px`;
  }
  function createNode(skill) {
    const live = liveSkills.get(skill.handle);
    const level = Number(live?.level ??
      (skill.handle === 'NV_BASIC' ? derived?.basicSkillLevel : 0) ?? 0);
    const upgradable = Number(live?.upgradable ??
      (skill.handle === 'NV_BASIC' ? derived?.basicSkillUpgradable : 0) ?? 0);
    const canAdd = Boolean(skill.id && availablePoints >= 1 &&
      upgradable === 1 && level < skill.maxLevel);
    const resolved = window.roAssetResolver?.resolveSkillAsset({
      skillId: skill.id, internalName: skill.handle,
    });
    const tile = document.createElement('div');
    tile.className = 'skill-tree-node';
    tile.dataset.skillHandle = skill.handle;
    nodesByHandle.set(skill.handle, tile);
    const name = document.createElement('span');
    name.className = 'skill-tree-name';
    name.textContent = resolved?.name ?? skill.name;
    const iconButton = document.createElement('button');
    iconButton.type = 'button';
    iconButton.className = 'skill-tree-icon-button';
    iconButton.setAttribute('aria-label', `查看${name.textContent}技能說明`);
    iconButton.setAttribute('aria-describedby', tooltip.id);
    if (resolved?.asset?.webPath) {
      const icon = document.createElement('img');
      icon.src = resolved.asset.webPath;
      icon.alt = '';
      icon.dataset.assetStatus = resolved.assetStatus;
      icon.onerror = () => {
        icon.replaceWith(document.createTextNode('缺圖'));
        iconButton.dataset.assetStatus = 'load-error';
      };
      iconButton.append(icon);
    } else {
      iconButton.textContent = '缺圖';
      iconButton.dataset.assetStatus = 'missing';
    }
    iconButton.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') showTooltip(iconButton, skill, level);
    });
    iconButton.addEventListener('pointerleave', (event) => {
      if (event.relatedTarget === tooltip || tooltip.contains(event.relatedTarget)) return;
      tooltip.hidden = true;
      if (!dialog.open) clearSkillHighlight();
    });
    iconButton.addEventListener('focus', () => showTooltip(iconButton, skill, level));
    iconButton.addEventListener('blur', () => {
      tooltip.hidden = true;
      if (!dialog.open) clearSkillHighlight();
    });
    iconButton.addEventListener('click', () => {
      tooltip.hidden = true;
      highlightSkill(skill);
      fillSkillDetail(dialogBody, skill, level, liveSkills, derived);
      detailAdd.dataset.skillId = skill.id;
      detailAdd.disabled = !canAdd;
      detailAdd.title = canAdd ? `提升${skill.name}` : '目前無法提升';
      dialog.showModal();
      detailClose.focus();
    });
    const current = document.createElement('strong');
    current.className = 'skill-tree-level';
    current.textContent = String(level);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'skill-tree-add';
    add.dataset.skillId = skill.id;
    add.disabled = !canAdd;
    add.setAttribute('aria-label', `提升${skill.name}`);
    add.title = canAdd ? `提升${skill.name}` : '目前無法提升';
    tile.append(name, iconButton, current, add);
    return tile;
  }
  function appendSection(label, positions) {
    if (!positions.length) return;
    const section = document.createElement('section');
    section.className = 'skill-tree-section';
    const heading = document.createElement('h3');
    heading.textContent = `${label} · 技能樹`;
    const grid = document.createElement('div');
    grid.className = 'skill-tree-grid';
    const byPosition = new Map(positions.map(([position, skill]) => [Number(position), skill]));
    const last = Math.max(...byPosition.keys());
    const count = Math.ceil((last + 1) / 7) * 7;
    for (let position = 0; position < count; position++) {
      const skill = byPosition.get(position);
      if (skill) grid.append(createNode(skill));
      else {
        const blank = document.createElement('span');
        blank.className = 'skill-tree-empty';
        blank.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.src = skillUiAssets.emptySlot.dataUrl;
        image.alt = '';
        blank.append(image);
        grid.append(blank);
      }
    }
    section.append(heading, grid);
    tree.append(section);
  }
  for (const section of skillLayoutSections(classId)) {
    const positions = Object.entries(skillTreeLayouts?.jobs?.[section.key] ?? {})
      .filter(([, handle]) => skillByHandle.has(handle) && !placed.has(handle))
      .map(([position, handle]) => {
        placed.add(handle);
        return [position, skillByHandle.get(handle)];
      });
    appendSection(section.name, positions);
  }
  const extras = job.skills.filter((skill) => !placed.has(skill.handle));
  if (extras.length) {
    appendSection('特殊技能（原廠座標未收錄）', extras.map((skill, index) => [index, skill]));
  }
  const controls = document.createElement('details');
  controls.className = 'skill-tree-controls';
  controls.open = skillControlsOpen;
  controls.addEventListener('toggle', () => { skillControlsOpen = controls.open; });
  const controlsLabel = document.createElement('summary');
  controlsLabel.textContent = '自動施放與進階設定';
  const controlsList = document.createElement('div');
  controlsList.className = 'skill-control-list';
  controlsList.append(...controlEntries);
  controls.append(controlsLabel, controlsList);
  $('#skillList').replaceChildren(tree, controls, tooltip, dialog);
}

async function loadSkillTrees() {
  if (!skillTreeData || !skillTreeLayouts || !skillUiAssets) {
    const [treeResponse, layoutResponse, assetResponse] = await Promise.all([
      fetch('/ro/data/skill-trees.json', { cache: 'no-store' }),
      fetch('/skill-tree-layouts.json', { cache: 'no-store' }),
      fetch('/skill-ui-assets.json', { cache: 'no-store' }),
    ]);
    if (!treeResponse.ok) throw new Error('技能資料讀取失敗');
    if (!layoutResponse.ok) throw new Error('原廠技能樹座標讀取失敗');
    if (!assetResponse.ok) throw new Error('原廠技能格圖檔讀取失敗');
    [skillTreeData, skillTreeLayouts, skillUiAssets] = await Promise.all([
      treeResponse.json(), layoutResponse.json(), assetResponse.json(),
    ]);
    lastSkillTreeSignature = '';
  }
  renderSkillTree(lastState?.character, lastState?.derived);
}

function renderJobChange(character, live) {
  if (!character) return;
  const classId = Number(live?.jobId ?? character.classId ?? 0),
    jobLevel = Number(live?.jobLevel ?? character.jobLevel ?? 0),
    baseLevel = Number(live?.baseLevel ?? character.baseLevel ?? 0),
    basicLevel = Number(live?.basicSkillLevel ?? 0),
    route = live?.jobRoute,
    dialog = live?.npcDialog,
    routeJob = route ? firstJobs[route.job] : null,
    targetJob = character.targetJob || null,
    targetNeedsBase45 = targetJob === 'supernovice',
    baseEligible = !targetNeedsBase45 || baseLevel >= 45,
    eligible =
      classId === 0 && jobLevel >= 10 && basicLevel >= 9 && baseEligible;
  $('#jobChangeState').textContent =
    classId !== 0
      ? `已轉職：${jobNames[classId] ?? `職業 ${classId}`}`
      : eligible
        ? '可以轉職'
        : '尚未符合資格';
  $('#jobEligibility').textContent =
    classId !== 0
      ? `角色已完成一轉，Job Lv.${jobLevel}。`
      : `${targetJob ? `創角志願：${firstJobs[targetJob]?.name ?? targetJob}。` : '舊角色請先選擇一轉志願。'} 一轉資格：初心者 Job Lv.10、基本技能 Lv.9${targetNeedsBase45 ? '、超級初心者另需 Base Lv.45' : ''}。目前為 Base Lv.${baseLevel}、Job Lv.${jobLevel}、基本技能 Lv.${basicLevel}。`;
  document.querySelectorAll('[data-job-route]').forEach((button) => {
    show(button, !targetJob || button.dataset.jobRoute === targetJob);
    button.disabled = !eligible || Boolean(route);
  });
  document
    .querySelectorAll('.first-job-choices .job-group-heading')
    .forEach((heading) => {
      show(heading, !targetJob);
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

async function jobChangeAction(body, pendingText, experienceTrace = null) {
  $('#jobChangeNotice').textContent = pendingText;
  markExperienceRequest(experienceTrace);
  try {
    await api('/api/job-change', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      latencyTrace: experienceTrace,
      body: JSON.stringify(body),
    });
    markExperienceResponse(experienceTrace);
    $('#jobChangeNotice').textContent = '指令已接受，等待遊戲伺服器確認。';
    if (experienceTrace) {
      // NPC_DIALOG_ACTION visible success = the next dialog state is actually
      // rendered, not merely that the command POST resolved.
      const observed = await observeVisibleChange($('#npcDialog'), 3000);
      if (observed) markExperienceAuthoritative(experienceTrace);
      await settleExperienceTrace(experienceTrace, {
        success: observed,
        errorCode: observed ? null : 'VISIBLE_UPDATE_TIMEOUT',
      });
    }
  } catch (error) {
    $('#jobChangeNotice').textContent = error.message;
    await settleExperienceTrace(experienceTrace, { success: false, errorCode: 'ACTION_FAILED' });
  }
}
function setEquipment(c, items = []) {
  if (!c) return;
  const job = jobNames[c.classId] ?? `職業 ${c.classId}`;
  $('#paperdollBody').src = paperdollAsset(c.sex, c.hair);
  characterShowcase.character = c;
  characterShowcase.equipment = items;
  void preloadCharacterShowcase();
  $('#paperdollName').textContent = c.name;
  $('#appearanceMeta').textContent =
    `${job} · ${c.sex === 'F' ? '女性' : '男性'}`;
  $('#paperdollDetails').textContent =
    `已裝備 ${items.length} 件 · 髮型 ${c.hair} · 髮色 ${c.hairColor}`;
  document.querySelectorAll('.equip-slot').forEach((slot) => {
    slot.classList.remove('equipped');
    delete slot.dataset.binId;
    delete slot.dataset.itemKey;
    delete slot.dataset.inventoryIndex;
    delete slot.dataset.inventoryGeneration;
    delete slot.dataset.action;
    delete slot.dataset.category;
    delete slot.dataset.iconFallback;
    slot.removeAttribute('title');
    slot.removeAttribute('tabindex');
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
      Number.isInteger(item.inventoryIndex)
        ? Number(candidate.inventoryIndex) === Number(item.inventoryIndex)
        : Number.isInteger(item.binId)
          ? candidate.binId === item.binId
          : candidate.itemId === item.itemId && candidate.equipped,
    );
    const liveIdentity = inventoryIdentityOf(live);
    if (hasInventoryIdentity(liveIdentity)) {
      slot.dataset.binId = live.binId ?? '';
      slot.dataset.itemKey = live.itemKey ?? '';
      slot.dataset.inventoryIndex = liveIdentity.inventoryIndex !== null
        ? String(liveIdentity.inventoryIndex)
        : '';
      slot.dataset.inventoryGeneration = Number.isInteger(live.inventoryGeneration)
        ? String(live.inventoryGeneration)
        : '';
      slot.dataset.action = 'unequip';
      slot.dataset.category = 'equipment';
      slot.tabIndex = 0;
    }
    const resolved = window.roAssetResolver?.resolveEquipmentAsset(item);
    const displayName = resolved?.name ?? item.name;
    slot.querySelector('b').textContent =
      `${item.refine > 0 ? `+${item.refine} ` : ''}${displayName}`;
    slot.title = `${equipmentTooltip(resolved, item, item.slot)}\n\n雙擊卸下`;
    slot.dataset.assetStatus = resolved?.assetStatus ?? 'missing';
    if (resolved?.assetStatus === 'ready' && resolved?.asset?.webPath) {
      const icon = document.createElement('img');
      icon.src = resolved.asset.webPath;
      icon.alt = displayName;
      icon.title = equipmentTooltip(resolved, item, item.slot);
      icon.onerror = () => {
        slot.dataset.assetStatus = 'missing';
        icon.remove();
      };
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
        name.textContent = localizedItemDisplayName(item);
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
// Authoritative PA runtime phase -> Supply window label. Only the phases that
// actually change the supply-cycle display are mapped; every other
// authoritative phase (AUTO_FARM, IDLE, ...) and every unknown/absent phase
// keeps the existing neutral label instead of inventing supply activity.
const supplyPhaseLabels = Object.freeze({
  SUPPLY: '補給中',
  RETURN_TO_FARM: '返回練功地圖',
});
function setSupplyCycle(settings, live, inventory = []) {
  supplyCycleSettings = settings;
  const runtime = live?.supplyCycle,
    enabled = Boolean(settings?.enabled),
    stage = runtime?.stage,
    phaseLabel = supplyPhaseLabels[live?.runtimePhase];
  $('#supplyStage').textContent = enabled
    ? (phaseLabel ?? supplyStageLabels[stage] ?? '掛機循環待命')
    : '尚未啟用';
  if (!$('#supplyForm')) return;
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
      .filter((item) => ![601, 602].includes(Number(item.itemId)))
      .filter(
        (item, index, list) =>
          list.findIndex(
            (candidate) => Number(candidate.itemId) === Number(item.itemId),
          ) === index,
      )
      .sort((a, b) =>
        localizedItemDisplayName(a).localeCompare(
          localizedItemDisplayName(b),
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
      label.textContent = `${localizedItemDisplayName(item)} #${item.itemId}`;
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
function currentMapInfoId() {
  return (
    minimapLive?.map ??
    lastState?.derived?.map ??
    lastState?.character?.map ??
    ''
  );
}
async function loadFarmMapAvailability() {
  if (farmMapAvailabilityData) return farmMapAvailabilityData;
  if (!farmMapAvailabilityPromise) {
    farmMapAvailabilityPromise = fetch('/api/farm-map-availability', {
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('掛機地圖開放資料讀取失敗');
      const data = await response.json();
      if (!Array.isArray(data?.maps))
        throw new Error('掛機地圖開放資料格式錯誤');
      farmMapAvailabilityData = data;
      if (mapInfoData?.maps)
        for (const row of data.maps)
          if (row.summary && !mapInfoData.maps[row.map])
            mapInfoData.maps[row.map] = row.summary;
      return data;
    });
  }
  return farmMapAvailabilityPromise;
}
function farmMapAvailabilityFor(mapId) {
  return (
    farmMapAvailabilityData?.maps?.find((row) => row.map === mapId) ?? null
  );
}
function farmMapSelectionAvailable(mapId, summary = mapInfoData?.maps?.[mapId]) {
  return (
    Boolean(summary) &&
    isFarmableMapSummary(summary) &&
    farmMapAvailabilityFor(mapId)?.farmSelectionAvailable === true
  );
}
// Player-facing reason when the server refuses a farm-map selection because the
// relocation planner cannot reach it. Internal reason codes never reach the UI.
const farmTargetRouteBlockerMessages = {
  farm_route_unavailable: '目前無法自動前往此掛機地圖',
  farm_target_invalid: '目前無法自動前往此掛機地圖',
  hub_unreachable: '目前無法自動前往此掛機地圖',
  route_unavailable: '目前無法自動前往此掛機地圖',
  no_direct_route: '目前無法自動前往此掛機地圖',
  route_unrepresentable: '目前無法自動前往此掛機地圖',
  service_destination_unavailable: '目前無法自動前往此掛機地圖',
  post_service_route_unreachable: '目前無法自動前往此掛機地圖',
  SUPPLY_REQUIRED: '角色需要先完成補給，所選掛機地圖已保留',
  SUPPLY_PREFLIGHT_UNAVAILABLE: '補給狀態暫時無法確認，所選掛機地圖已保留',
  SUPPLY_HOME_REQUIRED: '請先設定有效的儲存主城；所選掛機地圖已保留',
  SUPPLY_SERVICE_UNAVAILABLE: '城內服務暫時無法使用；所選掛機地圖已保留',
  SUPPLY_POLICY_UNAVAILABLE: '補給規則暫時無法確認；所選掛機地圖已保留',
  SUPPLY_NOT_REQUIRED: '補給需求已解除；正在重新確認切圖',
  farm_map_not_released: '此地圖尚未開放自動掛機',
};
function farmTargetBlockedMessage(reason) {
  return farmTargetRouteBlockerMessages[reason] ?? reason;
}
function renderMapInfo(mapId, map = mapInfoCache.get(mapId)) {
  const summary = mapInfoData?.maps?.[mapId];
  const resolvedMap = window.roAssetResolver?.resolveMapAsset(mapId);
  const mapNpcs = window.roAssetResolver?.resolveNpcAssetsForMap(mapId) ?? [];
  mapInfoRenderedId = mapId;
  $('#mapInfoTitle').textContent =
    resolvedMap?.name ?? summary?.name ?? mapNames[mapId] ?? mapId ?? '地圖情報';
  if (!map) {
    $('#mapInfoTotal').textContent = '無資料';
    $('#mapInfoSource').textContent = mapId
      ? `目前地圖 ${mapId} 尚無已查核的固定怪物資料`
      : '角色地圖尚未同步';
    $('#mapMonsterList').replaceChildren();
    return;
  }
  $('#mapInfoTitle').textContent = resolvedMap?.name ?? map.name;
  $('#mapInfoTotal').textContent =
    `${map.monsters.length} 種／${map.totalMonsters} 隻`;
  $('#mapInfoSource').textContent =
    '怪物、重生與掉落資料以目前遊戲世界的設定為準';
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
      const resolvedMonster = window.roAssetResolver?.resolveMonsterAsset({
        mobId: monster.id,
        name: monster.name,
      });
      const portraitSlot = document.createElement('span');
      portraitSlot.className = 'monster-icon-slot';
      if (resolvedMonster?.asset?.webPath) {
        const portrait = document.createElement('img');
        portrait.className = 'monster-icon';
        portrait.src = resolvedMonster.asset.webPath;
        portrait.alt = '';
        portrait.title = roAssetTooltip(resolvedMonster, monster);
        portrait.onerror = () => portrait.remove();
        portraitSlot.append(portrait);
      } else {
        portraitSlot.textContent = '?';
        portraitSlot.dataset.assetDiagnostic = 'MISSING_RO_ASSET';
      }
      summary.append(portraitSlot);
      const name = document.createElement('b');
      name.textContent = resolvedMonster?.name ?? monster.name;
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
        const resolvedDrop = window.roAssetResolver?.resolveItemAsset(drop);
        const icon = createItemIcon(drop, resolvedDrop);
        const cardArt = attachCardArtPreviewData(
          dropSummary,
          drop,
          resolvedDrop,
        );
        if (cardArt) {
          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.className = 'card-art-trigger';
          trigger.setAttribute(
            'aria-label',
            `查看${resolvedDrop.name ?? drop.name}原廠卡片美術`,
          );
          trigger.setAttribute('aria-haspopup', 'dialog');
          attachCardArtPreviewData(trigger, drop, resolvedDrop);
          trigger.append(icon);
          dropSummary.append(trigger);
        } else dropSummary.append(icon);
        const dropName = document.createElement('b');
        dropName.textContent = resolvedDrop?.name ?? drop.name;
        const rate = document.createElement('span');
        rate.className = 'drop-rate';
        rate.textContent = percentage(drop.ratePerTenThousand);
        dropSummary.append(dropName, rate);
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
    ...mapNpcs.map((npc) => {
      const details = document.createElement('details');
      details.className = 'monster-entry map-npc-entry';
      const summary = document.createElement('summary');
      const portraitSlot = document.createElement('span');
      portraitSlot.className = 'monster-icon-slot';
      if (npc.asset?.webPath) {
        const portrait = document.createElement('img');
        portrait.className = 'monster-icon';
        portrait.src = npc.asset.webPath;
        portrait.alt = '';
        portrait.title = roAssetTooltip(npc);
        portrait.onerror = () => portrait.remove();
        portraitSlot.append(portrait);
      } else {
        portraitSlot.textContent = '?';
        portraitSlot.dataset.assetDiagnostic = 'MISSING_RO_ASSET';
      }
      const name = document.createElement('b');
      name.textContent = npc.name;
      const kind = document.createElement('small');
      kind.textContent = 'NPC';
      const role = document.createElement('span');
      role.textContent = npc.function ?? '地圖服務角色';
      summary.append(portraitSlot, name, kind, role);
      const information = document.createElement('div');
      information.className = 'monster-stats';
      information.textContent = `${npc.map} (${npc.position?.x ?? '?'}, ${npc.position?.y ?? '?'})`;
      details.append(summary, information);
      return details;
    }),
  );
}
async function loadMapInfo(mapId = currentMapInfoId()) {
  if (!mapInfoData) {
    const response = await fetch('/ro/data/map-info.json', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('地圖情報讀取失敗');
    mapInfoData = await response.json();
  }
  const targetMap = mapId || currentMapInfoId();
  const requestId = ++mapInfoRequestId;
  const summary = mapInfoData?.maps?.[targetMap];
  if (!summary) {
    mapInfoLoadingId = '';
    renderMapInfo(targetMap);
    return;
  }
  if (mapInfoCache.has(targetMap)) {
    mapInfoLoadingId = '';
    renderMapInfo(targetMap);
    return;
  }
  mapInfoLoadingId = targetMap;
  $('#mapInfoTitle').textContent = summary.name ?? mapNames[targetMap] ?? targetMap;
  $('#mapInfoTotal').textContent = '讀取中';
  $('#mapInfoSource').textContent = `正在讀取 ${targetMap} 地圖資料`;
  try {
    const response = await fetch(summary.detail, { cache: 'no-store' });
    if (!response.ok) throw new Error('地圖詳細情報讀取失敗');
    const map = await response.json();
    mapInfoCache.set(targetMap, map);
    if (requestId === mapInfoRequestId) renderMapInfo(targetMap, map);
  } finally {
    if (mapInfoLoadingId === targetMap) mapInfoLoadingId = '';
  }
  if (minimapLive)
    updateMinimapTargets(minimapLive, {
      combatObserved: minimapCombatObserved,
    });
}
function levelRangeText(range) {
  return range ? `Lv. ${range.min}～${range.max}` : '無一般怪物等級資料';
}
// MOB_SELECTION_REMOVED: farm-selectable is decided by spawn presence, not by
// town name, region unlock, fog or a rollout/static allowlist. Every canonical
// map stays visible; only maps with at least one monster spawn are selectable.
function isFarmableMapSummary(summary) {
  if (!summary) return false;
  return (
    Number(summary.normalMonsterCount ?? 0) > 0 ||
    Number(summary.combatMonsterCount ?? 0) > 0 ||
    Number(summary.bossCount ?? 0) > 0 ||
    (summary.primaryMonsters?.length ?? 0) > 0
  );
}
function syncGrindTargetSummary(target = lastState?.grindTarget) {
  const transition = lastState?.grindHubTransition ?? target?.hubTransition;
  if (transition?.active) {
    $('#grindTargetSummary').textContent =
      `掛機據點遷移中：前往${transition.hubName ?? transition.hubId}登記儲存點`;
    return;
  }
  const summary = target?.mapId ? mapInfoData?.maps?.[target.mapId] : null;
  $('#grindTargetSummary').textContent = target?.mapId
    ? `掛機目標：${summary?.name ?? target.name ?? target.mapId}（${target.mapId}）`
    : '掛機目標：尚未設定';
}
// The persisted grind target is the player's last selection and is the only
// farm target: there is no silent fallback or normalization. Always render the
// authoritative resolved target map so the UI never advertises another map.
function syncAuthoritativeFarmTarget(status) {
  const targetMap = String(status?.farmTarget?.targetMap ?? '');
  if (!/^[a-z0-9_]{1,31}$/.test(targetMap)) return;
  const summary = mapInfoData?.maps?.[targetMap];
  const name =
    summary?.name ?? lastState?.grindTarget?.name ?? targetMap;
  $('#grindTargetSummary').textContent = `掛機目標：${name}（${targetMap}）`;
}
async function reconcileFarmTargetAfterNonJsonResponse(mapId, timeoutMs = 4000) {
  const targetMap = String(mapId ?? ''),
    deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await refresh({ full: false });
    if (String(lastState?.grindTarget?.mapId ?? '') === targetMap)
      return lastState.grindTarget;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}
function renderWorldMapNodes() {
  const regions = mapInfoData?.worldMap?.regions ?? [],
    mapSummaries = mapInfoData?.maps ?? {},
    selectableMapCount = farmMapAvailabilityData?.maps?.filter(
      (row) => row.farmSelectionAvailable === true && mapSummaries[row.map],
    ).length ?? 0;
  $('#worldMapStatus').textContent =
    `原廠地圖座標，${regions.length} 個區域、${selectableMapCount} 張可掛機地圖；跨地圖選擇使用直達傳送`;
  renderWorldMapTowns();
  $('#worldMapNodes').replaceChildren(
    ...regions.map((region) => {
      const hitArea = document.createElement('button'),
        position = region.position,
        selectableMapIds = (region.mapIds ?? []).filter((mapId) =>
          farmMapSelectionAvailable(mapId, mapSummaries[mapId]),
        ),
        selectable = selectableMapIds.length > 0,
        currentTarget = region.mapIds.includes(lastState?.grindTarget?.mapId),
        currentLocation = region.mapIds.includes(lastState?.derived?.map);
      hitArea.type = 'button';
      hitArea.className = `world-map-region selectable ${selectable ? 'farmable' : 'inspection-only'}`;
      hitArea.dataset.regionId = region.regionId;
      hitArea.dataset.labelKind = region.labelKind ?? 'normal';
      hitArea.dataset.mapId = region.mapId;
      hitArea.dataset.mapIds = region.mapIds.join(' ');
      hitArea.dataset.mapSelectable = 'true';
      hitArea.dataset.farmAvailable = String(selectable);
      hitArea.dataset.mapSelected = String(
        region.mapIds.includes(selectedWorldMapId),
      );
      hitArea.setAttribute('aria-disabled', 'false');
      hitArea.style.left = `${(position.x1 / mapInfoData.worldMap.width) * 100}%`;
      hitArea.style.top = `${(position.y1 / mapInfoData.worldMap.height) * 100}%`;
      hitArea.style.width = `${((position.x2 - position.x1) / mapInfoData.worldMap.width) * 100}%`;
      hitArea.style.height = `${((position.y2 - position.y1) / mapInfoData.worldMap.height) * 100}%`;
      const hitAreaSize = (position.x2 - position.x1) * (position.y2 - position.y1);
      hitArea.style.zIndex = String(region.labelKind === 'red'
        ? 1000 : Math.max(1, 900 - Math.ceil(hitAreaSize / 50)));
      hitArea.classList.toggle('current-target', currentTarget);
      hitArea.classList.toggle('current-location', currentLocation);
      hitArea.classList.toggle(
        'selected',
        region.mapIds.includes(selectedWorldMapId),
      );
      const primarySummary = mapSummaries[selectableMapIds[0] ?? region.mapId];
      hitArea.title = selectable
        ? `${region.name}（${region.mapId}） ${levelRangeText(primarySummary?.levelRange ?? region.levelRange)}`
        : `${region.name}（${region.mapId}） 點選查看地圖與限制`;
      hitArea.setAttribute('aria-label', hitArea.title);
      const crop = document.createElement('span'),
        preview = document.createElement('img'),
        regionWidth = position.x2 - position.x1,
        regionHeight = position.y2 - position.y1;
      crop.className = 'world-map-region-crop';
      preview.className = 'world-map-region-preview';
      preview.src = mapInfoData.worldMap.image;
      preview.alt = '';
      preview.draggable = false;
      preview.setAttribute('aria-hidden', 'true');
      preview.style.left = `${(-position.x1 / regionWidth) * 100}%`;
      preview.style.top = `${(-position.y1 / regionHeight) * 100}%`;
      preview.style.width = `${(mapInfoData.worldMap.width / regionWidth) * 100}%`;
      preview.style.height = `${(mapInfoData.worldMap.height / regionHeight) * 100}%`;
      crop.append(preview);
      hitArea.append(crop);
      return hitArea;
    }),
  );
  $('#worldMapCanvas').onclick = (event) => {
    const keyboardRegion = event.detail === 0 &&
      event.target.closest('.world-map-region');
    if (keyboardRegion) void selectWorldMap(keyboardRegion.dataset.mapId);
    else void selectWorldMapRegionAtPoint(event, regions);
  };
  renderWorldMapRegionIndex(regions);
}
function worldMapRegionsAtPoint(event, regions) {
  const bounds = $('#worldMapNodes').getBoundingClientRect();
  const x = bounds.width > 0
    ? (event.clientX - bounds.left) / bounds.width * mapInfoData.worldMap.width : -1;
  const y = bounds.height > 0
    ? (event.clientY - bounds.top) / bounds.height * mapInfoData.worldMap.height : -1;
  return regions.filter((candidate) => x >= candidate.position.x1 &&
    x <= candidate.position.x2 && y >= candidate.position.y1 &&
    y <= candidate.position.y2);
}
function renderWorldMapOverlapChoices(choices, selectedMapId) {
    if (choices.length < 2) return;
    const picker = document.createElement('section');
    picker.className = 'world-map-overlap-picker';
    const title = document.createElement('b');
    title.textContent = '此位置的地圖';
    picker.append(title);
    for (const candidate of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mapId = candidate.mapId;
      button.className = 'world-map-overlap-choice';
      button.textContent = `${candidate.name}（${candidate.mapId}）`;
      button.setAttribute('aria-pressed', String(candidate.mapId === selectedMapId));
      button.onclick = async () => {
        if (candidate.kind === 'town') selectTownWorldMap(candidate.mapId);
        else await selectWorldMap(candidate.mapId);
        renderWorldMapOverlapChoices(choices, candidate.mapId);
      };
      picker.append(button);
    }
    $('#worldMapDetail').prepend(picker);
}
async function selectWorldMapRegionAtPoint(event, regions) {
  const choices = worldMapRegionsAtPoint(event, regions);
  if (!choices.length) return;
  await selectWorldMap(choices[0].mapId);
  renderWorldMapOverlapChoices(choices, choices[0].mapId);
}
function setSelectedWorldMap(mapId) {
  selectedWorldMapId = mapId;
  document.querySelectorAll('.world-map-region').forEach((region) => {
    const selected = region.dataset.mapIds.split(' ').includes(mapId);
    region.classList.toggle('selected', selected);
    region.dataset.mapSelected = String(selected);
  });
}
function selectLockedWorldMap(region) {
  setSelectedWorldMap(region.mapId);
  const detail = $('#worldMapDetail');
  const title = document.createElement('h3');
  title.textContent = region.name;
  const status = document.createElement('p');
  status.className = 'world-map-meta locked';
  status.textContent =
    `Map ID：${region.mapId}\n此地圖尚未開放\n解鎖條件：${region.unlockCondition ?? '尚未公布'}`;
  status.style.whiteSpace = 'pre-line';
  const note = document.createElement('p');
  note.textContent = '未開放地圖無法設為掛機地圖。';
  detail.replaceChildren(title, status, note);
}
async function selectWorldMap(mapId) {
  const summary = mapInfoData?.maps?.[mapId];
  if (!summary) {
    const region = mapInfoData?.worldMap?.regions?.find((candidate) =>
      candidate.mapIds?.includes(mapId));
    if (region) selectLockedWorldMap({ ...region,
      unlockCondition: '地圖詳細資料未收錄' });
    return;
  }
  setSelectedWorldMap(mapId);
  let map = mapInfoCache.get(mapId);
  if (!map) {
    if (summary.detail) {
      const response = await fetch(summary.detail, { cache: 'no-store' });
      if (!response.ok) throw new Error('地圖詳細情報讀取失敗');
      map = await response.json();
    } else map = summary;
    mapInfoCache.set(mapId, map);
  }
  if (selectedWorldMapId !== mapId) return;
  const detail = $('#worldMapDetail');
  const title = document.createElement('h3');
  title.textContent = map.name;
  const floorPicker = document.createElement('section');
  floorPicker.className = 'world-map-floor-picker';
  const region = mapInfoData.worldMap?.regions?.find((candidate) =>
    candidate.mapIds?.includes(mapId),
  );
  const relatedMaps = (summary.dungeon
    ? Object.values(mapInfoData.maps).filter(
        (candidate) => candidate.dungeon?.id === summary.dungeon.id,
      )
    : (region?.mapIds ?? [])
        .map((candidateMapId) => mapInfoData.maps[candidateMapId])
        .filter(Boolean)
  ).sort(
    (a, b) =>
      (a.dungeon?.order ?? Number.MAX_SAFE_INTEGER) -
        (b.dungeon?.order ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
  );
  if (relatedMaps.length > 1) {
    const floorTitle = document.createElement('b');
    floorTitle.textContent = summary.dungeon
      ? `${summary.dungeon.name}樓層`
      : region?.labelKind === 'red' ? `${region.name}樓層` : '同區域地圖';
    const floorButtons = document.createElement('div');
    floorButtons.className = 'world-map-floor-buttons';
    for (const floor of relatedMaps) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'world-map-floor-button';
      button.dataset.mapId = floor.id;
      button.classList.toggle('selected', floor.id === mapId);
      button.setAttribute('aria-pressed', String(floor.id === mapId));
      const available = farmMapSelectionAvailable(floor.id, floor);
      button.textContent = `${floor.dungeon?.floorLabel ?? floor.name}　${levelRangeText(floor.levelRange)}${available ? '' : '　可檢視'}`;
      button.onclick = () => void selectWorldMap(floor.id);
      floorButtons.append(button);
    }
    floorPicker.append(floorTitle, floorButtons);
  }
  const mapIdLine = document.createElement('p');
  mapIdLine.className = 'world-map-meta';
  mapIdLine.textContent = `Map ID：${map.id}\n主要掛機怪物：${levelRangeText(map.levelRange)}\n完整可戰鬥怪物：${levelRangeText(map.fullLevelRange)}\n非 Boss 出生數：${map.normalMonsterCount} 隻`;
  mapIdLine.style.whiteSpace = 'pre-line';
  const monsterTitle = document.createElement('b');
  monsterTitle.textContent = '主要怪物';
  const monsters = document.createElement('ul');
  for (const monster of map.primaryMonsters ?? []) {
    const row = document.createElement('li');
    row.textContent = `${monster.name}　Lv.${monster.level}　${monster.count} 隻`;
    monsters.append(row);
  }
  const boss = document.createElement('p');
  boss.textContent = map.bossMonsters?.length
    ? `Boss／MVP：${map.bossMonsters.map((monster) => `${monster.name} Lv.${monster.level}${monster.isMvp ? '（MVP）' : ''}`).join('、')}`
    : 'Boss／MVP：無固定出生資料';
  const resources = document.createElement('p');
  resources.textContent = map.resourceMonsters?.length
    ? `未計入等級區間的資源型怪物：${map.resourceMonsters.map((monster) => `${monster.name} ${monster.count} 隻`).join('、')}`
    : '資源型怪物：無';
  const controls = document.createElement('div');
  controls.className = 'controls';
  const routeNote = document.createElement('p');
  routeNote.className = 'world-map-route-note';
  routeNote.textContent = '移動方式：伺服器核准後直達地圖安全落點。';
  const availability = farmMapAvailabilityFor(mapId);
  const spawnFarmable = isFarmableMapSummary(summary);
  const farmable = spawnFarmable && Boolean(availability?.farmable);
  const farmSelectionAvailable =
    farmable && availability?.farmSelectionAvailable === true;
  const buttonState = availability?.buttonState ?? 'UNAVAILABLE_MAP';
  const teleportInfo = document.createElement('p');
  teleportInfo.className = 'world-map-teleport-info';
  teleportInfo.textContent = `地圖需求：${availability?.minLevel ? `Base Lv.${availability.minLevel}` : '未開放'}　傳送費：${availability?.cost === 0 ? '免費' : Number.isFinite(availability?.cost) ? `${availability.cost} Zeny` : '待確認'}　冷卻：${availability?.cooldownSeconds ?? 60} 秒`;
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'primary';
  if (!spawnFarmable) {
    apply.textContent = '此地圖沒有可掛機怪物';
    apply.disabled = true;
    apply.title = '此地圖沒有可掛機怪物';
  } else if (!farmable || !farmSelectionAvailable) {
    apply.textContent = '尚未開放';
    apply.disabled = true;
    apply.title = availability?.availabilityReason ?? '地圖尚未開放';
  } else {
    apply.textContent = buttonState === 'ALREADY_ON_TARGET_MAP' ? '已經在該地圖'
      : buttonState === 'LEVEL_TOO_LOW' ? `需要 Base Lv.${availability.minLevel}`
        : buttonState === 'WORLD_MAP_TELEPORT_COOLDOWN'
          ? `${availability.cooldownRemaining} 秒後可再次傳送`
          : buttonState === 'INSUFFICIENT_ZENY'
            ? `Zeny 不足：需 ${availability.cost}，現有 ${availability.currentZeny}`
            : '更換該地圖掛機';
    apply.disabled = buttonState !== 'AVAILABLE';
  }
  apply.onclick = () => {
    if (worldMapTravelPresentation?.state !== 'MAP_PORTAL_OPEN') return;
    const confirm = $('#worldMapConfirm');
    $('#worldMapConfirmTitle').textContent = `是否更換至${map.name}掛機？`;
    $('#worldMapConfirmCost').textContent =
      `傳送費用：${availability?.cost === 0 ? '免費' : `${availability?.cost ?? '待確認'} Zeny`}`;
    const submit = $('#worldMapConfirmSubmit');
    submit.textContent = '確定更換';
    submit.disabled = false;
    confirm.classList.remove('hidden');
    $('#worldMapConfirmCancel').onclick = () => closeWorldMap();
    submit.onclick = async () => {
      if (!worldMapTravelPresentation?.beginSubmission()) return;
      submit.disabled = true;
      apply.disabled = true;
      try {
        const result = await api('/api/grind-target', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mapId }),
        });
        if (result.reason === 'ALREADY_ON_TARGET_MAP') {
          worldMapTravelPresentation.preflightRejected();
          confirm.classList.add('hidden');
          $('#worldMapStatus').textContent = '已在該地圖掛機';
          return;
        }
        confirm.classList.add('hidden');
        if (result.reason !== 'WORLD_MAP_FARM_START_QUEUED')
          worldMapTravelPresentation.preflightAccepted({ mapId, name: map.name });
        $('#worldMapStatus').textContent = result.message ??
          (result.reason === 'WORLD_MAP_SUPPLY_QUEUED'
            ? `已保留 ${map.name}，正在完成補給並等待返程掛機`
            : `已送出 ${map.name} 傳送，等待伺服器確認抵達並啟動掛機`);
        await waitForWorldMapAuthority((state) =>
          state.player?.currentMap === mapId && state.player?.phase === 'AUTO_FARM',
        result.reason === 'WORLD_MAP_SUPPLY_QUEUED' ? 300000 : 30000,
        result.reason === 'WORLD_MAP_SUPPLY_QUEUED' ? result.command : null);
        if (result.reason === 'WORLD_MAP_FARM_START_QUEUED') {
          worldMapTravelPresentation.preflightRejected();
          closeWorldMap();
          renderWorldMapNodes();
          void refresh({ full: false });
        } else {
          await refresh({ full: false });
          worldMapTravelPresentation.authoritativeArrival(mapId);
        }
      } catch (error) {
        if (error?.code === 'NON_JSON_RESPONSE') {
          try {
            const reconciledTarget = await reconcileFarmTargetAfterNonJsonResponse(mapId);
            if (reconciledTarget?.mapId === mapId) {
              syncGrindTargetSummary(reconciledTarget);
              renderWorldMapNodes();
              worldMapTravelPresentation.preflightRejected();
              $('#worldMapStatus').textContent =
                `已送出 ${map.name} 傳送，等待伺服器確認`;
              return;
            }
          } catch {}
        }
        if (!worldMapTravelPresentation.failed(error))
          worldMapTravelPresentation.preflightRejected();
        confirm.classList.add('hidden');
        $('#worldMapStatus').textContent = farmTargetBlockedMessage(error.message);
      } finally {
        submit.disabled = false;
        apply.disabled = false;
      }
    };
    submit.focus();
  };
  controls.append(apply);
  const farmNote = document.createElement('p');
  farmNote.className = 'world-map-farm-note';
  farmNote.textContent = !spawnFarmable
    ? '此地圖沒有可掛機怪物，無法設為掛機地圖。'
    : !farmable || !farmSelectionAvailable
      ? `此地圖尚未開放：${availability?.availabilityReason ?? '資料不足'}。`
      : '';
  detail.replaceChildren(
    title,
    controls,
    teleportInfo,
    floorPicker,
    mapIdLine,
    monsterTitle,
    monsters,
    boss,
    resources,
    routeNote,
    farmNote,
  );
}
function renderWorldMapRegionIndex(regions) {
  const input = $('#worldMapRegionSearch');
  const list = $('#worldMapRegionIndex');
  const render = () => {
    const query = input.value.trim().toLocaleLowerCase();
    list.replaceChildren(...regions.filter((region) =>
      !query || `${region.name} ${region.mapIds.join(' ')}`.toLocaleLowerCase().includes(query))
      .map((region) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.mapId = region.mapId;
        button.textContent = `${region.name}（${region.mapId}）`;
        button.onclick = () => {
          if (farmMapAvailabilityData?.towns?.some((town) => town.map === region.mapId))
            selectTownWorldMap(region.mapId);
          else void selectWorldMap(region.mapId);
        };
        return button;
      }));
  };
  input.oninput = render;
  render();
}
async function ensureWorldMapTravelPresentation() {
  if (worldMapTravelPresentation) return worldMapTravelPresentation;
  worldMapTravelModulePromise ||= import('/world-map-teleport-presentation.mjs');
  const { createWorldMapTeleportPresentation } =
    await worldMapTravelModulePromise;
  if (worldMapTravelPresentation) return worldMapTravelPresentation;
  worldMapTravelPresentation = createWorldMapTeleportPresentation({
    playCue: playTravelCue,
    stopCue: stopTravelCue,
    pauseBgm: () => $('#bgm').pause(),
    resumeBgm: (mapId) => setMusicContext(mapId ||
      farmMapAvailabilityData?.player?.currentMap || lastState?.derived?.map),
    onStage: (stage) => {
      const locked = ['PREFLIGHT_PENDING', 'TELEPORT_CONFIRMED',
        'FINAL_TELEPORT', 'WAIT_FOR_ARRIVAL'].includes(stage);
      $('#worldMapOverlay').dataset.travelState = stage;
      $('#worldMapOverlay').setAttribute('aria-busy', String(locked));
      $('#worldMapOverlay').querySelector('.world-map-layout').inert = locked;
      $('#closeWorldMap').disabled = locked;
      $('#worldMapConfirmCancel').disabled = locked;
      const label = {
        MAP_PORTAL_OPEN: '傳送之陣已啟動，請選擇目的地',
        PREFLIGHT_PENDING: '正在確認傳送資格',
        TELEPORT_CONFIRMED: '傳送之陣正在啟動',
        FINAL_TELEPORT: '正在傳送',
        WAIT_FOR_ARRIVAL: '等待伺服器確認抵達',
      }[stage];
      if (label) $('#worldMapStatus').textContent = label;
    },
    onComplete: ({ mapId, name }) => {
      $('#worldMapConfirm').classList.add('hidden');
      closeWorldMap();
      showWorldMapArrival(name || mapId);
      void refresh({ full: false });
    },
    onFailure: (error) => {
      $('#worldMapStatus').textContent =
        farmTargetBlockedMessage(error?.message ?? '傳送音效播放失敗');
    },
  });
  return worldMapTravelPresentation;
}
async function openWorldMap() {
  const presentation = await ensureWorldMapTravelPresentation();
  if (!presentation.open()) return;
  const generation = ++worldMapOpenGeneration;
  $('#worldMapOverlay').classList.remove('hidden');
  document.body.classList.add('world-map-open');
  activateDeferredGameImages();
  farmMapAvailabilityData = null;
  farmMapAvailabilityPromise = null;
  try {
    await Promise.all([
      mapInfoData ? Promise.resolve() : loadMapInfo(currentMapInfoId()),
      loadFarmMapAvailability(),
    ]);
  } catch (error) {
    closeWorldMap();
    throw error;
  }
  if (generation !== worldMapOpenGeneration ||
      presentation.state !== 'MAP_PORTAL_OPEN') return;
  for (const row of farmMapAvailabilityData?.maps ?? [])
    if (row.summary && !mapInfoData.maps[row.map])
      mapInfoData.maps[row.map] = row.summary;
  renderWorldMapNodes();
  syncGrindTargetSummary();
  void reportWebPresence();
  restartCombatDelivery();
  restartStatePolling();
  $('#closeWorldMap').focus();
}
function closeWorldMap() {
  if (worldMapTravelPresentation?.isTransitionActive()) return;
  worldMapOpenGeneration += 1;
  worldMapTravelPresentation?.cancel();
  $('#worldMapConfirm').classList.add('hidden');
  $('#worldMapOverlay').classList.add('hidden');
  document.body.classList.remove('world-map-open');
  void reportWebPresence();
  if (combatStreamAvailable()) void recoverCombatStream('overlay_resume');
  else restartCombatDelivery();
  restartStatePolling({ immediate: true });
  $('#openWorldMap').focus();
}
function syncMapInfoToLive(live) {
  if (
    !live?.map ||
    !mapInfoData ||
    !$('#mapInfo').classList.contains('active') ||
    live.map === mapInfoRenderedId ||
    live.map === mapInfoLoadingId
  )
    return;
  void loadMapInfo(live.map).catch((error) => {
    if (live.map === currentMapInfoId()) {
      renderMapInfo(live.map);
      $('#mapInfoSource').textContent = error.message;
    }
  });
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
      const resolvedItem = item.category === 'equipment'
        ? window.roAssetResolver?.resolveEquipmentAsset(item)
        : window.roAssetResolver?.resolveItemAsset(item);
      node.dataset.binId = item.binId ?? '';
      node.dataset.itemKey = item.itemKey ?? '';
      node.dataset.inventoryIndex = Number.isInteger(item.inventoryIndex)
        ? String(item.inventoryIndex)
        : '';
      node.dataset.inventoryGeneration = Number.isInteger(item.inventoryGeneration)
        ? String(item.inventoryGeneration)
        : '';
      node.dataset.itemAmount = Number.isFinite(Number(item.amount))
        ? String(item.amount)
        : '';
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
      if (
        item.category === 'card' &&
        inventoryMatchesIdentity(item, selectedCardIdentity())
      ) node.classList.add('card-selected');
      const cardArt = attachCardArtPreviewData(node, item, resolvedItem);
      attachItemDetailData(node, item, resolvedItem);
      node.title = item.category === 'equipment'
        ? `${equipmentTooltip(resolvedItem, item)}\n\n${item.equipped ? '雙擊卸下' : item.canEquip === false ? item.equipRestriction || '此裝備目前無法穿上' : '雙擊裝備'}`
        :
        item.binId === null && !Number.isInteger(item.inventoryIndex)
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
      const icon = createItemIcon(item, resolvedItem);
      if (cardArt) {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'card-art-trigger';
        trigger.setAttribute(
          'aria-label',
          `查看${resolvedItem.name ?? item.name}原廠卡片美術`,
        );
        trigger.setAttribute('aria-haspopup', 'dialog');
        attachCardArtPreviewData(trigger, item, resolvedItem);
        trigger.append(icon);
        node.append(trigger);
      } else node.append(icon);
      const text = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = `${item.refine ? `+${item.refine} ` : ''}${resolvedItem?.name ?? item.name}`;
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
const questDisplayPriorities = Object.freeze({
  active: 0,
  available: 1,
  locked: 2,
});
function sortQuestEntriesByStatus(entries, readStatus) {
  return [...entries].sort(
    (left, right) =>
      (questDisplayPriorities[readStatus(left)] ?? 3) -
      (questDisplayPriorities[readStatus(right)] ?? 3),
  );
}
function renderTaskActionLog(live) {
  const detail = $('#questDetail');
  if (!detail) return;
  const now = Date.now();
  pendingTaskEvents = pendingTaskEvents.filter((event) => now - event.at < 15000);
  const events = [
    ...(Array.isArray(live?.taskEvents) ? live.taskEvents : []),
    ...pendingTaskEvents,
  ].sort((left, right) => Number(left.at) - Number(right.at));
  const missions = Array.isArray(live?.questMissions) ? live.questMissions : [];
  const rows = [];
  const journal = lastState?.questJournal;
  const playerQuestLog = Array.isArray(lastState?.questRuntime?.playerLog)
    ? lastState.questRuntime.playerLog
    : [];
  for (const event of playerQuestLog.slice(-40)) {
    const row = document.createElement('div');
    row.className = 'task-log-entry action event';
    const time = document.createElement('time');
    const message = document.createElement('span');
    time.textContent = new Date(event.at || Date.now()).toLocaleTimeString(
      'zh-TW',
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
    );
    message.textContent = `[任務] ${event.message}`;
    row.append(time, message);
    rows.push(row);
  }
  if (journal && journal.taskStatus !== 'AVAILABLE') {
    const action = document.createElement('div');
    action.className = `task-log-entry ${journal.failure ? 'recovery' : 'action'} event`;
    const time = document.createElement('time');
    const message = document.createElement('span');
    time.textContent = new Date(journal.updatedAt || Date.now()).toLocaleTimeString(
      'zh-TW',
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
    );
    message.textContent = journal.failure
      ? `[任務停止] ${journal.failure.message}`
      : `[目前動作] ${journal.currentActionLabel}`;
    action.append(time, message);
    rows.push(action);
    for (const objective of journal.mobObjectives ?? []) {
      const row = document.createElement('div');
      row.className = 'task-log-entry battle event';
      const objectiveTime = document.createElement('time');
      const objectiveMessage = document.createElement('span');
      objectiveTime.textContent = time.textContent;
      objectiveMessage.textContent = `[討伐進度] ${monsterDisplayName(objective.mobName, objective.mobId)}：${Number(objective.current)} / ${Number(objective.required)} 隻`;
      row.append(objectiveTime, objectiveMessage);
      rows.push(row);
    }
  }
  if (missions.length) {
    for (const mission of missions) {
      const row = document.createElement('div');
      row.className = 'task-log-entry battle event';
      const name =
        monsterDisplayName(mission.mobName, mission.mobId) ||
        `怪物 ${mission.mobId}`;
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
function taskInProgress(live = lastState?.derived) {
  const questTaskStatus = lastState?.questJournal?.taskStatus;
  return Boolean(
    live?.onboarding?.active ||
      live?.edenJourney?.active ||
      Number(live?.edenJourney?.resumePending) > 0 ||
      lastState?.questRuntime?.adapterStatus?.active ||
      ['ACTIVE', 'READY_TO_REPORT', 'PAUSED'].includes(questTaskStatus) ||
      Date.now() < taskCommandPendingUntil,
  );
}

const assassinPhaseNames = Object.freeze({
  IDLE: '尚未開始', NAVIGATING: '前往刺客公會', AT_GUILD: '等待接受考試',
  ACCEPTING: '正式受理中', QUIZ: '刺客知識測驗', QUIZ_SYNC: '同步測驗結果',
  PRECISION_READY: '精準目標試煉', PRECISION_ACTIVE: '精準試煉進行中',
  NO_KILL_READY: '潛行生存試煉', NO_KILL_ACTIVE: '潛行試煉進行中',
  MAZE: '隱藏迷宮', MAZE_SYNC: '進入公會長房間', GUILDMASTER: '公會長面談',
  GUILDMASTER_SYNC: '核發 Frozen Heart', FINAL_READY: '等待完成轉職', COMPLETED: '刺客轉職完成',
});

function jobQuestButton(label, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `assassin-action ${className}`.trim();
  button.textContent = label;
  button.onclick = onClick;
  return button;
}

function projectMissionInteractionStage(runtime) {
  const root = $('#assassinMissionStage');
  const stage = runtime?.missionStage ?? {};
  const type = String(stage.type ?? 'DIALOG').toUpperCase();
  const adapterSteps = Array.isArray(runtime?.adapterMetadata?.steps)
    ? runtime.adapterMetadata.steps
    : [];
  const completedStepCount = Array.isArray(runtime?.completedSteps)
    ? runtime.completedSteps.length
    : 0;
  const interactiveControls = root
    ? [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
    : [];
  const options =
    stage.node?.choices ?? stage.question?.choices ?? stage.options ?? [];
  const hasServerInteractionContract = Boolean(stage.interactionId);
  const requiresPlayerInput =
    stage.requiresPlayerInput === true ||
    ['QUIZ', 'CHOICE', 'ROUTE_EVENT'].includes(type) ||
    stage.status === 'INPUT_REQUIRED' ||
    (!hasServerInteractionContract && interactiveControls.length > 0);
  const bodyText = root?.querySelector(':scope > p')?.textContent ?? '';
  const runtimeNpcName =
    stage.npcName || stage.npc || stage.finalNpc ||
    (type === 'DIALOG' ? stage.title : null);
  const resolvedNpc = runtimeNpcName
    ? window.roAssetResolver?.resolveNpcAsset(runtimeNpcName)
    : null;
  return {
    title: stage.title || root?.querySelector(':scope > h3')?.textContent || '任務互動',
    npcName: resolvedNpc?.name ?? runtimeNpcName,
    npcVisual: stage.npcVisual ?? (resolvedNpc?.asset?.webPath
      ? { src: resolvedNpc.asset.webPath, status: 'available' }
      : null),
    npcVisualKey: stage.npcVisualKey ?? null,
    bodyText,
    dialogLines: Array.isArray(stage.dialogLines)
      ? stage.dialogLines
      : bodyText
        ? [bodyText]
        : [],
    options,
    actions: interactiveControls
      .filter((control) => control.matches('button'))
      .map((button, index) => ({
        id: button.dataset.action || `action-${index + 1}`,
        label: button.textContent,
      })),
    availableActions: Array.isArray(stage.availableActions)
      ? stage.availableActions
      : [],
    autoAdvanceAllowed:
      stage.autoAdvanceAllowed === true && !requiresPlayerInput,
    requiresPlayerInput,
    currentStep: runtime?.currentStep?.id ?? null,
    currentStepNumber: adapterSteps.length
      ? Math.min(completedStepCount + 1, adapterSteps.length)
      : null,
    totalSteps: adapterSteps.length || null,
    status: stage.status || runtime?.questStatus || 'READY',
    type,
    interactionId: stage.interactionId ?? null,
    revision: Number(stage.revision ?? runtime?.revision ?? 0),
    generation: Number(
      stage.generation ?? runtime?.objectiveGeneration ?? 0,
    ),
    authorityIdentity: stage.authorityIdentity ?? {
      questSessionId: runtime?.questSessionId ?? null,
    },
    currentLine: Number(stage.currentLine ?? 0),
    key: [
      stage.interactionId ?? runtime?.adapterId ?? runtime?.careerTarget ?? 'career',
    ].join(':'),
  };
}

function enhanceMissionInteractionStage(runtime) {
  const root = $('#assassinMissionStage');
  if (!root || !window.MissionInteractionStage) return;
  window.MissionInteractionStage.decorate(
    root,
    projectMissionInteractionStage(runtime),
  );
}

function renderCareerTargets(runtime) {
  const root = $('#careerTargets');
  if (!root) return;
  const formalStarted = Boolean(
    runtime?.formalQuestStarted || runtime?.adapterStatus?.formalQuestStarted,
  );
  const buttons = (runtime?.availableCareerTargets ?? []).map((target) => {
    const selected =
      runtime?.selectedCareerTarget?.adapterId === target.adapterId;
    const button = jobQuestButton(
      selected ? `${target.displayName}・已選擇` : target.displayName,
      () => setJobCareerTarget(target.adapterId),
      selected ? 'selected' : '',
    );
    button.disabled = formalStarted || target.eligible !== true;
    if (target.eligible !== true) {
      button.classList.add('unavailable');
      const requirement = document.createElement('small');
      requirement.className = 'career-target-requirement';
      requirement.textContent = (target.missingRequirements ?? []).join('、');
      button.append(requirement);
    }
    return button;
  });
  root.replaceChildren(...buttons);
}

function renderCareerEligibilityDetail(runtime) {
  const root = $('#assassinMissionStage');
  if (!root) return;
  const targets = runtime?.availableCareerTargets ?? [];
  const selected = runtime?.selectedCareerTarget ?? null;
  const heading = document.createElement('h3');
  const description = document.createElement('p');
  const details = document.createElement('div');
  details.className = 'assassin-stage-controls';

  if (selected) {
    const unavailable = selected.available === false;
    $('#assassinSummary').textContent = unavailable
      ? `${selected.displayName}・尚未開放`
      : `${selected.displayName}・尚未符合資格`;
    heading.textContent = selected.displayName;
    description.textContent = unavailable
      ? (selected.unavailableReason ?? '尚未開放')
      : '目前尚未符合轉職資格。';
  } else if (targets.length > 0) {
    $('#assassinSummary').textContent = '尚未選擇轉職目標';
    heading.textContent = '尚未選擇轉職目標';
    description.textContent = '請從上方選擇目前職業可進入的下一階職業。';
  } else {
    $('#assassinSummary').textContent = '目前沒有可用的下一階職業';
    heading.textContent = '目前沒有可用的下一階職業';
    description.textContent = '目前職業沒有已登錄的下一階轉職任務。';
  }

  for (const target of selected ? [selected] : targets) {
    const entry = document.createElement('div');
    const label = document.createElement('strong');
    const requirement = document.createElement('small');
    label.textContent = target.displayName;
    requirement.textContent = target.eligible
      ? '已符合轉職資格'
      : (target.missingRequirements ?? []).join('、');
    entry.append(label, requirement);
    details.append(entry);
  }
  root.replaceChildren(heading, description, details);
  $('#assassinNotice').textContent = selected
    ? '資格狀態以目前角色與伺服器資料為準。'
    : '選擇志願後，正式任務仍需由正確 NPC 受理。';
}

async function setJobCareerTarget(adapterId) {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = '正在保存二轉志願';
  try {
    const result = await api('/api/quest-runtime/career-target', {
      method: 'POST',
      body: JSON.stringify({
        adapterId,
        careerTarget: adapterId,
        expectedRevision: runtime.revision,
      }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) {
    $('#assassinNotice').textContent = error.message;
  }
}

async function assassinAction(action, payload = {}) {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = '正在由伺服器驗證任務狀態';
  try {
    const result = await api('/api/quest-runtime/job-action', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'ASSASSIN',
        action,
        payload,
        expectedRevision: runtime.revision,
      }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) {
    $('#assassinNotice').textContent = error.message;
  }
}

async function commitAssassinJobChange() {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = 'Huey 正在進行最終伺服器驗證';
  try {
    const result = await api('/api/quest-runtime/job-commit', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'ASSASSIN',
        expectedRevision: runtime.revision,
        idempotencyKey: `assassin:${runtime.questSessionId}:${runtime.revision}`,
      }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) {
    $('#assassinNotice').textContent = error.message;
  }
}

function renderAssassinQuest(runtime, character) {
  const root = $('#assassinMissionStage');
  if (!root) return;
  const assassin = runtime?.adapterState;
  const phase = assassin?.phase ?? 'IDLE';
  const isAssassin = Number(character?.classId) === 12 || phase === 'COMPLETED';
  $('#assassinSummary').textContent = isAssassin
    ? 'Assassin'
    : (assassinPhaseNames[phase] ?? '可選擇');
  const stage = runtime?.missionStage ?? {};
  const heading = document.createElement('h3');
  heading.textContent = stage.title || assassinPhaseNames[phase] || '刺客轉職';
  const description = document.createElement('p');
  const controls = document.createElement('div');
  controls.className = 'assassin-stage-controls';
  if (phase === 'IDLE') {
    description.textContent = '志願已保存。正式考試會在抵達刺客公會並由 Huey 受理後開始。';
    controls.append(jobQuestButton('前往刺客公會', () => assassinAction('NAVIGATE_GUILD')));
  } else if (phase === 'NAVIGATING') {
    description.textContent = `目前：${stage.currentMap || character?.map || '同步中'}　目標：${stage.nextMap || 'in_moc_16'}。角色正在依正式導航路線移動。`;
  } else if (phase === 'AT_GUILD') {
    description.textContent = '已抵達 Huey。接受考試前，系統會再次確認職業、Job 等級、技能點與任務進度。';
    controls.append(jobQuestButton('接受刺客轉職考試', () => assassinAction('ACCEPT_QUEST')));
  } else if (phase === 'QUIZ') {
    description.textContent = `十題答對九題即可通過。已嘗試 ${Number(assassin.quiz?.attempts ?? 0)} 次。`;
    const form = document.createElement('form');
    form.className = 'assassin-quiz';
    for (const [index, question] of (stage.questions ?? []).entries()) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = `${index + 1}. ${question.prompt}`;
      fieldset.append(legend);
      question.choices.forEach((choice, choiceIndex) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `assassin-q-${index}`;
        input.value = String(choiceIndex);
        label.append(input, document.createTextNode(choice));
        fieldset.append(label);
      });
      form.append(fieldset);
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      const answers = (stage.questions ?? []).map((_, index) => Number(new FormData(form).get(`assassin-q-${index}`)));
      if (answers.some((answer) => !Number.isInteger(answer))) {
        $('#assassinNotice').textContent = '請完成十題後再提交。';
        return;
      }
      assassinAction('SUBMIT_QUIZ', { answers });
    };
    const submit = jobQuestButton('提交答案', () => {});
    submit.type = 'submit';
    submit.onclick = null;
    form.append(submit);
    controls.append(form);
  } else if (phase === 'PRECISION_READY') {
    description.textContent = '請辨識唯一合法目標。試煉開始後，Auto Battle 只會攻擊你確認的名稱。';
    controls.append(
      jobQuestButton('Job change target', () => assassinAction('START_PRECISION', { targetName: 'Job change target' })),
      jobQuestButton('Job change creature', () => { $('#assassinNotice').textContent = '這是誘餌目標，請重新辨識。'; }, 'decoy'),
      jobQuestButton('Job change targets', () => { $('#assassinNotice').textContent = '名稱多了一個 s，這是誘餌目標。'; }, 'decoy'),
    );
  } else if (phase === 'PRECISION_ACTIVE') {
    description.textContent = '精準試煉進行中。合法名稱為 Job change target，必須擊殺六隻；錯殺、死亡或逾時會回到本試煉 checkpoint。';
  } else if (phase === 'NO_KILL_READY') {
    description.textContent = '開始前會執行補給檢查。正式進場後禁止普攻與攻擊技能，中途不會離場補給。';
    controls.append(jobQuestButton('檢查補給並開始', () => assassinAction('START_NO_KILL')));
  } else if (phase === 'NO_KILL_ACTIVE') {
    description.textContent = 'NO_ATTACK 已套用。角色正在穿越怪物區，只允許防禦、回復與移動。';
  } else if (phase === 'MAZE') {
    description.textContent = stage.node?.clue || '觀察線索並選擇路線。';
    const cost = document.createElement('small');
    cost.textContent = `迷宮成本：HP ${Number(stage.cost?.hp ?? 0)}、SP ${Number(stage.cost?.sp ?? 0)}`;
    controls.append(cost);
    for (const choice of stage.node?.choices ?? []) controls.append(jobQuestButton(choice.label, () => assassinAction('MAZE_CHOICE', { choiceId: choice.id })));
  } else if (phase === 'GUILDMASTER') {
    description.textContent = stage.question?.prompt || '公會長正在評估你的回答。';
    for (const [index, choice] of (stage.question?.choices ?? []).entries()) controls.append(jobQuestButton(choice, () => assassinAction('GUILDMASTER_CHOICE', { choice: index })));
  } else if (phase === 'FINAL_READY') {
    description.textContent = 'Quiz、精準試煉、潛行試煉、迷宮及公會長認可均已完成。Frozen Heart 已由伺服器確認。';
    controls.append(jobQuestButton('完成轉職', commitAssassinJobChange, 'primary'));
  } else if (phase === 'COMPLETED') {
    description.textContent = '刺客轉職已完成，任務進度已更新。';
  } else {
    description.textContent = stage.status === 'FAILED'
      ? `本階段未通過。成績 ${Number(stage.score ?? 0)} / 10，可直接重試此階段。`
      : '正在確認任務進度。';
  }
  root.replaceChildren(heading, description, controls);
  $('#assassinNotice').textContent = stage.status === 'FAILED'
    ? '本階段可直接重試，前面的 checkpoint 已保留。'
    : `伺服器 revision ${Number(runtime?.revision ?? 0)}・${assassinPhaseNames[phase] ?? phase}`;
}

const roguePhaseNames = Object.freeze({
  IDLE: '尚未開始', NAVIGATING: '前往 Rogue Guild', AT_GUILD: '等待 Markie 受理',
  ACCEPTING: '正式受理中', QUIZ: 'Rogue 知識測驗', QUIZ_SYNC: '同步測驗結果',
  RESOURCE_READY: '資源審查', RESOURCE_ASSIGNING: '固定資源分支', RESOURCE_REQUIRED: '收集申請資源',
  RESOURCE_SYNC: '驗證資源', BRANCH_READY: '等待分派聯絡人', BRANCH_ASSIGNING: '固定路線分支',
  BRANCH: '聯絡人密碼', PASSWORD_SYNC: '驗證密碼', ROUTE_DECISION: '地下路線判斷',
  ROUTE_DECISION_SYNC: '套用路線成本', ROUTE_READY: '威脅策略', ROUTE_STARTING: '進入地下通道',
  ROUTE_ACTIVE: '地下通道進行中', FINAL_READY: '等待完成轉職', COMPLETED: 'Rogue 轉職完成',
});

async function rogueAction(action, payload = {}) {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = '正在由伺服器驗證 Rogue 任務狀態';
  try {
    const result = await api('/api/quest-runtime/job-action', {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'ROGUE', action, payload, expectedRevision: runtime.revision }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) {
    $('#assassinNotice').textContent = error.message;
  }
}

async function commitRogueJobChange() {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = 'Markie 正在進行最終伺服器驗證';
  try {
    const result = await api('/api/quest-runtime/job-commit', {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'ROGUE', expectedRevision: runtime.revision, idempotencyKey: `rogue:${runtime.questSessionId}:${runtime.revision}` }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) {
    $('#assassinNotice').textContent = error.message;
  }
}

function renderRogueQuest(runtime, character) {
  const root = $('#assassinMissionStage');
  if (!root) return;
  const rogue = runtime?.adapterState;
  const phase = rogue?.phase ?? 'IDLE';
  const isRogue = Number(character?.classId) === 17 || phase === 'COMPLETED';
  $('#assassinSummary').textContent = isRogue ? 'Rogue' : (roguePhaseNames[phase] ?? '可選擇');
  const stage = runtime?.missionStage ?? {};
  const heading = document.createElement('h3');
  heading.textContent = stage.title || roguePhaseNames[phase] || 'Rogue 轉職';
  const description = document.createElement('p');
  const controls = document.createElement('div');
  controls.className = 'assassin-stage-controls';
  if (phase === 'IDLE') {
    description.textContent = '志願已保存。正式任務會在抵達 Rogue Guild 並由 Markie 受理後開始。';
    controls.append(jobQuestButton('前往 Rogue Guild', () => rogueAction('NAVIGATE_GUILD')));
  } else if (phase === 'NAVIGATING') {
    description.textContent = `目前：${stage.currentMap || character?.map || '同步中'}　目標：${stage.nextMap || 'in_rogue'}。導航沿用現有安全中斷與死亡恢復。`;
  } else if (phase === 'AT_GUILD') {
    description.textContent = '已抵達 Markie。接受前會再次驗證 Thief、Job Lv.40、技能點與正式任務狀態。';
    controls.append(jobQuestButton('接受 Rogue 轉職考試', () => rogueAction('ACCEPT_QUEST')));
  } else if (phase === 'QUIZ') {
    description.textContent = `十題需取得 90 分以上。已嘗試 ${Number(rogue.quiz?.attempts ?? 0)} 次。`;
    const form = document.createElement('form');
    form.className = 'assassin-quiz';
    for (const [index, question] of (stage.questions ?? []).entries()) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = `${index + 1}. ${question.prompt}`;
      fieldset.append(legend);
      question.choices.forEach((choice, choiceIndex) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = `rogue-q-${index}`; input.value = String(choiceIndex);
        label.append(input, document.createTextNode(choice)); fieldset.append(label);
      });
      form.append(fieldset);
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      const answers = (stage.questions ?? []).map((_, index) => Number(new FormData(form).get(`rogue-q-${index}`)));
      if (answers.some((answer) => !Number.isInteger(answer))) { $('#assassinNotice').textContent = '請完成十題後再提交。'; return; }
      rogueAction('SUBMIT_QUIZ', { answers });
    };
    const submit = jobQuestButton('提交答案', () => {}); submit.type = 'submit'; submit.onclick = null; form.append(submit); controls.append(form);
  } else if (phase === 'RESOURCE_READY') {
    description.textContent = '測驗 checkpoint 已建立。Mr. Smith 會依正式隨機規則固定一組資源要求。';
    controls.append(jobQuestButton('取得資源要求', () => rogueAction('ASSIGN_RESOURCE')));
  } else if (phase === 'RESOURCE_REQUIRED') {
    const itemText = (stage.items ?? []).map((item) => `${item.name} × ${item.amount}`).join('、');
    description.textContent = `申請費 ${Number(stage.zeny ?? 0).toLocaleString()} Zeny${itemText ? `，材料：${itemText}` : ''}。${stage.webAdaptation || ''}`;
    if (stage.status === 'INSUFFICIENT') {
      const missing = (stage.missingItems ?? []).map((item) => `${item.name} 尚缺 ${item.missing}`).join('、');
      const detail = document.createElement('small'); detail.textContent = `Zeny 尚缺 ${Number(stage.missingZeny ?? 0).toLocaleString()}${missing ? `；${missing}` : ''}`; controls.append(detail);
    }
    controls.append(jobQuestButton('重新檢查並提交', () => rogueAction('SUBMIT_RESOURCE')));
  } else if (phase === 'BRANCH_READY') {
    description.textContent = '申請費與材料已交付。聯絡人已確定，重新整理後仍會保留。';
    controls.append(jobQuestButton('取得聯絡人', () => rogueAction('ASSIGN_BRANCH')));
  } else if (phase === 'BRANCH') {
    description.textContent = `${stage.contact}：${stage.requirement}。NPC 提示的密碼為「${stage.passwordHint}」。`;
    const form = document.createElement('form');
    const input = document.createElement('input'); input.type = 'text'; input.autocomplete = 'off'; input.placeholder = '自行輸入密碼';
    form.onsubmit = (event) => { event.preventDefault(); rogueAction('SUBMIT_PASSWORD', { input: input.value }); };
    const submit = jobQuestButton('驗證密碼', () => {}); submit.type = 'submit'; submit.onclick = null; form.append(input, submit); controls.append(form);
  } else if (phase === 'ROUTE_DECISION') {
    description.textContent = stage.node?.clue || '觀察線索並決定路線。';
    const cost = document.createElement('small'); cost.textContent = `已承擔成本：HP ${Number(stage.cost?.hp ?? 0)}%、SP ${Number(stage.cost?.sp ?? 0)}%`; controls.append(cost);
    for (const choice of stage.node?.choices ?? []) controls.append(jobQuestButton(choice.label, () => rogueAction('ROUTE_CHOICE', { choiceId: choice.id })));
  } else if (phase === 'ROUTE_READY') {
    description.textContent = '選擇偏好路線與需要避開的高威脅目標。Auto Battle 只執行你的策略。';
    const form = document.createElement('form'); form.className = 'assassin-quiz';
    const select = document.createElement('select');
    for (const [value, label] of [['CAUTIOUS', '謹慎路線'], ['SHADOW', '陰影路線'], ['BALANCED', '平衡路線']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); }
    form.append(select);
    for (const threat of stage.threats ?? []) { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'threat'; input.value = String(threat.nameId); input.checked = true; label.append(input, document.createTextNode(`避開 ${threat.name}`)); form.append(label); }
    const fightLabel = document.createElement('label'); const fight = document.createElement('input'); fight.type = 'checkbox'; fight.checked = true; fightLabel.append(fight, document.createTextNode('必要時攻擊較弱目標')); form.append(fightLabel);
    form.onsubmit = (event) => { event.preventDefault(); const avoidTargets = [...form.querySelectorAll('input[name="threat"]:checked')].map((entry) => Number(entry.value)); rogueAction('START_ROUTE', { routePreference: select.value, avoidTargets, fightNecessary: fight.checked }); };
    const submit = jobQuestButton('進入地下通道', () => {}, 'primary'); submit.type = 'submit'; submit.onclick = null; form.append(submit); controls.append(form);
  } else if (phase === 'ROUTE_ACTIVE') {
    description.textContent = 'THREAT_AVOID 已套用。角色會避開你指定的高威脅目標；無法安全繞行時會返回本路線 checkpoint。';
  } else if (phase === 'FINAL_READY') {
    description.textContent = '地下路線與公會長考驗已完成。按下後即可完成轉職。';
    controls.append(jobQuestButton('完成轉職', commitRogueJobChange, 'primary'));
  } else if (phase === 'COMPLETED') {
    description.textContent = '流氓轉職已完成，任務進度已更新。';
  } else {
    description.textContent = stage.status === 'INVALID_INPUT' ? '密碼錯誤，可直接重試；前面進度已保留。' : stage.status === 'FAILED' ? `本階段未通過。成績 ${Number(stage.score ?? 0)}，可直接重試 Quiz。` : '正在確認任務進度。';
  }
  root.replaceChildren(heading, description, controls);
  $('#assassinNotice').textContent = stage.status === 'FAILED' || stage.status === 'INVALID_INPUT' || stage.status === 'INSUFFICIENT'
    ? '本階段可直接重試，既有 checkpoint 已保留。'
    : `伺服器 revision ${Number(runtime?.revision ?? 0)}・${roguePhaseNames[phase] ?? phase}`;
}
const knightPhaseNames = Object.freeze({
  IDLE: '尚未開始', NAVIGATING: '前往普隆德拉騎士團', AT_GUILD: '等待 Captain Herman 受理',
  ACCEPTING: '正式受理中', ITEM_ASSIGNING: 'Sir Andrew 材料試煉', ITEM_REQUIRED: '收集騎士團材料', ITEM_SYNC: '提交材料',
  QUIZ: '騎士知識測驗', QUIZ_SYNC: '同步測驗結果', WAVE_READY: '三波戰鬥準備', WAVE_STARTING: '進入戰鬥考場', WAVE_ACTIVE: '三波戰鬥進行中',
  ETHICS: 'Lady Amy 倫理測驗', ETHICS_SYNC: '同步倫理測驗', NO_KILL_READY: '禁殺試煉準備', NO_KILL_STARTING: '進入禁殺考場', NO_KILL_ACTIVE: '五分鐘禁殺試煉',
  FINAL_DIALOG: 'Sir Gray 最終面談', FINAL_DIALOG_SYNC: '同步面談結果', FINAL_READY: '等待完成轉職', COMPLETED: '騎士轉職完成',
});
async function knightAction(action, payload = {}) {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = '正在由伺服器驗證騎士任務狀態';
  try {
    const result = await api('/api/quest-runtime/job-action', {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'KNIGHT', action, payload, expectedRevision: runtime.revision }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) { $('#assassinNotice').textContent = error.message; }
}
async function commitKnightJobChange() {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = 'Captain Herman 正在進行最終伺服器驗證';
  try {
    const result = await api('/api/quest-runtime/job-commit', {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'KNIGHT', expectedRevision: runtime.revision, idempotencyKey: `knight:${runtime.questSessionId}:${runtime.revision}` }),
    });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) { $('#assassinNotice').textContent = error.message; }
}
function choiceQuiz(stage, prefix, submitAction, expectedCount, actionHandler = knightAction) {
  const form = document.createElement('form'); form.className = 'assassin-quiz';
  for (const [index, question] of (stage.questions ?? []).entries()) {
    const fieldset = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = `${index + 1}. ${question.prompt}`; fieldset.append(legend);
    question.choices.forEach((choice, choiceIndex) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'radio'; input.name = `${prefix}-${index}`; input.value = String(choiceIndex); label.append(input, document.createTextNode(choice)); fieldset.append(label); });
    form.append(fieldset);
  }
  form.onsubmit = (event) => { event.preventDefault(); const answers = Array.from({ length: expectedCount }, (_, index) => Number(new FormData(form).get(`${prefix}-${index}`))); if (answers.some((answer) => !Number.isInteger(answer))) { $('#assassinNotice').textContent = '請完成所有題目後再提交。'; return; } actionHandler(submitAction, { answers }); };
  const submit = jobQuestButton('提交答案', () => {}, 'primary'); submit.type = 'submit'; submit.onclick = null; form.append(submit); return form;
}
function renderKnightQuest(runtime, character) {
  const root = $('#assassinMissionStage'); if (!root) return;
  const knight = runtime?.adapterState; const phase = knight?.phase ?? 'IDLE'; const stage = runtime?.missionStage ?? {};
  const isKnight = Number(character?.classId) === 7 || phase === 'COMPLETED';
  $('#assassinSummary').textContent = isKnight ? '騎士' : (knightPhaseNames[phase] ?? '可選擇');
  const heading = document.createElement('h3'); heading.textContent = stage.title || knightPhaseNames[phase] || '騎士轉職';
  const description = document.createElement('p'); const controls = document.createElement('div'); controls.className = 'assassin-stage-controls';
  if (phase === 'IDLE') { description.textContent = '志願已保存。正式任務會在抵達 Captain Herman 並由伺服器受理後開始。'; controls.append(jobQuestButton('前往普隆德拉騎士團', () => knightAction('NAVIGATE_GUILD'))); }
  else if (phase === 'NAVIGATING') description.textContent = `目前：${stage.currentMap || character?.map || '同步中'}　目標：${stage.nextMap || 'prt_in'}。導航沿用現有安全中斷與死亡恢復。`;
  else if (phase === 'AT_GUILD') { description.textContent = '接受前會再次驗證 Swordman、Job Lv.40、剩餘技能點與正式任務狀態。'; controls.append(jobQuestButton('接受騎士轉職考試', () => knightAction('ACCEPT_QUEST'))); }
  else if (phase === 'ITEM_ASSIGNING') { description.textContent = stage.jobLevel50Skip ? 'Job Lv.50 會依原始規則跳過材料收集。' : 'Sir Andrew 會依原始隨機規則固定一組材料。'; controls.append(jobQuestButton('取得材料要求', () => knightAction('ASSIGN_ITEMS'))); }
  else if (phase === 'ITEM_REQUIRED') { const items = (stage.items ?? []).map((entry) => `${entry.name} × ${entry.amount}`).join('、'); description.textContent = `需交付：${items}。提交時會確認並收取材料。`; if (stage.status === 'INSUFFICIENT') { const missing = document.createElement('small'); missing.textContent = (stage.missingItems ?? []).map((entry) => `${entry.name} 尚缺 ${entry.missing}`).join('、'); controls.append(missing); } controls.append(jobQuestButton('重新檢查並提交', () => knightAction('SUBMIT_ITEMS'))); }
  else if (phase === 'QUIZ') { description.textContent = `八題必須全部答對。失敗只重試本測驗，已嘗試 ${Number(knight.quiz?.attempts ?? 0)} 次。`; controls.append(choiceQuiz(stage, 'knight-quiz', 'SUBMIT_QUIZ', 8)); }
  else if (phase === 'WAVE_READY') { description.textContent = '開始前會檢查配置、HP 與補給。進場後連續完成三波正式怪物，每波限時三分鐘。'; controls.append(jobQuestButton('檢查配置與補給後開始', () => knightAction('START_WAVES'), 'primary')); }
  else if (phase === 'WAVE_ACTIVE' || phase === 'WAVE_STARTING') description.textContent = `第 ${Number(stage.wave ?? knight.wave?.current ?? 1)} / 3 波，已擊殺 ${Number(stage.kills ?? knight.wave?.kills ?? 0)} / ${Number(stage.total ?? 0)}。Trial 期間鎖定，不會中途離場補給。`;
  else if (phase === 'ETHICS') { description.textContent = `依本次考試規則判定作答。已嘗試 ${Number(knight.ethics?.attempts ?? 0)} 次。`; controls.append(choiceQuiz(stage, 'knight-ethics', 'SUBMIT_ETHICS', 10)); }
  else if (phase === 'NO_KILL_READY') { description.textContent = '開始前會檢查補給。進場後 NO_ATTACK 會關閉普攻、攻擊技能與 fallback target，維持五分鐘。'; controls.append(jobQuestButton('檢查補給並開始', () => knightAction('START_NO_KILL'), 'primary')); }
  else if (phase === 'NO_KILL_ACTIVE' || phase === 'NO_KILL_STARTING') { const elapsed = stage.startedAtUnix ? Math.max(0, Math.floor(Date.now() / 1000) - Number(stage.startedAtUnix)) : 0; const remaining = Math.max(0, 300 - elapsed); description.textContent = `禁止攻擊，剩餘 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}。HP ${Number(stage.hp ?? character?.hp ?? 0)} / ${Number(stage.maxHp ?? character?.maxHp ?? 0)}，紅色藥水 ${Number(stage.supply ?? 0)}。`; }
  else if (phase === 'FINAL_DIALOG') {
    description.textContent = 'Sir Gray 會依正式程式的道德分數判定。失敗只重試本次面談。'; const dialog = stage.dialog ?? {}; const form = document.createElement('form'); form.className = 'assassin-quiz';
    const makeSelect = (name, entries, promptKey = 'prompt') => { const select = document.createElement('select'); select.name = name; entries.forEach((entry, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = typeof entry === 'string' ? entry : entry[promptKey]; select.append(option); }); return select; };
    const reason = makeSelect('reason', dialog.reasons ?? []); const reasonFollow = makeSelect('reasonFollow', dialog.reasons?.[0]?.followups ?? []); reason.onchange = () => { reasonFollow.replaceChildren(...(dialog.reasons?.[Number(reason.value)]?.followups ?? []).map((label, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = label; return option; })); };
    const plan = makeSelect('plan', dialog.plans ?? []); const planFollow = makeSelect('planFollow', dialog.plans?.[0]?.followups ?? []); plan.onchange = () => { planFollow.replaceChildren(...(dialog.plans?.[Number(plan.value)]?.followups ?? []).map((label, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = label; return option; })); };
    form.append(reason, reasonFollow, plan, planFollow); form.onsubmit = (event) => { event.preventDefault(); knightAction('SUBMIT_FINAL_DIALOG', { reason: Number(reason.value), reasonFollowup: Number(reasonFollow.value), plan: Number(plan.value), planFollowup: Number(planFollow.value) }); }; const submit = jobQuestButton('提交面談回答', () => {}, 'primary'); submit.type = 'submit'; submit.onclick = null; form.append(submit); controls.append(form);
  } else if (phase === 'FINAL_READY') { description.textContent = '所有考驗與 7 瓶 Awakening Potion 獎勵條件已由伺服器確認。'; controls.append(jobQuestButton('完成轉職', commitKnightJobChange, 'primary')); }
  else if (phase === 'COMPLETED') description.textContent = '騎士轉職已完成，獎勵已發放。';
  else description.textContent = stage.status === 'FAILED' ? '本階段未通過，可直接重試；先前 checkpoint 已保留。' : '正在確認任務進度。';
  root.replaceChildren(heading, description, controls);
  $('#assassinNotice').textContent = ['FAILED', 'INSUFFICIENT', 'READY_TO_RETRY'].includes(stage.status) ? '本階段可直接重試，既有 checkpoint 已保留。' : `伺服器 revision ${Number(runtime?.revision ?? 0)}・${knightPhaseNames[phase] ?? phase}`;
}
const crusaderPhaseNames = Object.freeze({
  IDLE: '尚未開始', NAVIGATING: '前往普隆德拉十字軍總部', AT_GUILD: '等待 Senior Crusader 受理', ACCEPTING: '正式受理中',
  MATERIAL_REQUIRED: '材料試煉', MATERIAL_SYNC: '提交材料', NO_KILL_READY: '禁殺走廊準備', NO_KILL_STARTING: '進入禁殺走廊', NO_KILL_ACTIVE: '穿越禁殺走廊',
  QUIZ: '十字軍知識測驗', QUIZ_SYNC: '同步測驗結果', BATTLE_READY: '不死系戰鬥準備', BATTLE_STARTING: '進入不死系考場', BATTLE_ACTIVE: '不死系戰鬥進行中',
  FINAL_READY: '等待完成轉職', COMPLETED: '十字軍轉職完成',
});
async function crusaderAction(action, payload = {}) {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = '正在由伺服器驗證十字軍任務狀態';
  try {
    const result = await api('/api/quest-runtime/job-action', { method: 'POST', body: JSON.stringify({ adapterId: 'CRUSADER', action, payload, expectedRevision: runtime.revision }) });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) { $('#assassinNotice').textContent = error.message; }
}
async function commitCrusaderJobChange() {
  const runtime = lastState?.questRuntime;
  if (!runtime) return;
  $('#assassinNotice').textContent = 'Senior Crusader 正在進行最終伺服器驗證';
  try {
    const result = await api('/api/quest-runtime/job-commit', { method: 'POST', body: JSON.stringify({ adapterId: 'CRUSADER', expectedRevision: runtime.revision, idempotencyKey: `crusader:${runtime.questSessionId}:${runtime.revision}` }) });
    lastState = { ...lastState, questRuntime: result.questRuntime };
    renderJobQuest(result.questRuntime, lastState.character);
  } catch (error) { $('#assassinNotice').textContent = error.message; }
}
function renderCrusaderQuest(runtime, character) {
  const root = $('#assassinMissionStage'); if (!root) return;
  const crusader = runtime?.adapterState; const phase = crusader?.phase ?? 'IDLE'; const stage = runtime?.missionStage ?? {};
  $('#assassinSummary').textContent = Number(character?.classId) === 14 || phase === 'COMPLETED' ? '十字軍' : (crusaderPhaseNames[phase] ?? '可選擇');
  const heading = document.createElement('h3'); heading.textContent = stage.title || crusaderPhaseNames[phase] || '十字軍轉職';
  const description = document.createElement('p'); const controls = document.createElement('div'); controls.className = 'assassin-stage-controls';
  if (phase === 'IDLE') { description.textContent = '志願已保存。正式任務會在抵達 Senior Crusader 並由伺服器受理後開始。'; controls.append(jobQuestButton('前往普隆德拉十字軍總部', () => crusaderAction('NAVIGATE_GUILD'))); }
  else if (phase === 'NAVIGATING') description.textContent = `目前：${stage.currentMap || character?.map || '同步中'}　目標：${stage.nextMap || 'prt_cas'}。`;
  else if (phase === 'AT_GUILD') { description.textContent = '接受前會再次驗證 Swordman、Job Lv.40、剩餘技能點與正式任務狀態。'; controls.append(jobQuestButton('接受十字軍轉職考試', () => crusaderAction('ACCEPT_QUEST'), 'primary')); }
  else if (phase === 'MATERIAL_REQUIRED') { const items = (stage.items ?? []).map((entry) => `${entry.name} × ${entry.amount}`).join('、'); description.textContent = `需交付：${items}。提交時會確認並收取材料。`; if (stage.status === 'INSUFFICIENT') { const missing = document.createElement('small'); missing.textContent = (stage.missingItems ?? []).map((entry) => `${entry.name} 尚缺 ${entry.missing}`).join('、'); controls.append(missing); } controls.append(jobQuestButton('重新檢查並提交', () => crusaderAction('SUBMIT_MATERIALS'))); }
  else if (phase === 'NO_KILL_READY') { const ready = stage.equipmentRequirement?.ready === true; description.textContent = ready ? '念珠已裝備。進場後角色停止攻擊，主動避開敵人並穿越走廊。' : '需要裝備念珠才能開始試煉。'; controls.append(jobQuestButton('檢查裝備與補給後開始', () => crusaderAction('START_NO_KILL'), 'primary')); }
  else if (phase === 'NO_KILL_ACTIVE' || phase === 'NO_KILL_STARTING') description.textContent = '禁止擊殺規則已啟用。角色停止攻擊，正在避開敵人並前往走廊另一端；Trial 期間不會離場補給。';
  else if (phase === 'QUIZ') { description.textContent = `本次為第 ${Number(stage.setId ?? crusader.quiz?.setId ?? 0)} 組十題。首考需 90 分，重考 80 分；失敗只重試 Quiz。`; controls.append(choiceQuiz(stage, 'crusader-quiz', 'SUBMIT_QUIZ', 10, crusaderAction)); }
  else if (phase === 'BATTLE_READY') { const rosaryReady = stage.equipmentRequirement?.ready === true; const water = Number(stage.holyWater?.current ?? 0); description.textContent = `${rosaryReady ? '念珠已裝備' : '需要裝備念珠'}，聖水 ${water} / 1。入場時需消耗 1 瓶聖水，四分鐘內完成三波不死系戰鬥。`; controls.append(jobQuestButton('檢查裝備、聖水與補給後開始', () => crusaderAction('START_BATTLE'), 'primary')); }
  else if (phase === 'BATTLE_ACTIVE' || phase === 'BATTLE_STARTING') description.textContent = `第 ${Number(stage.wave ?? crusader.battle?.wave ?? 1)} / 3 波，已擊殺 ${Number(stage.kills ?? crusader.battle?.kills ?? 0)} / ${Number(stage.total ?? 0)}。Trial 期間鎖定，不會中途離場補給。`;
  else if (phase === 'FINAL_READY') { description.textContent = `所有考驗已完成。獎勵為白色藥水 × ${Number(stage.reward?.amount ?? 6)}。`; controls.append(jobQuestButton('完成轉職', commitCrusaderJobChange, 'primary')); }
  else if (phase === 'COMPLETED') description.textContent = '十字軍轉職已完成，獎勵已發放。';
  else description.textContent = stage.status === 'EQUIPMENT_REQUIRED' ? '需要裝備念珠才能開始試煉。' : stage.type === 'SUPPLY' ? '缺少聖水或戰鬥補給，正在依安全中斷規則處理。' : ['FAILED','INSUFFICIENT','READY_TO_RETRY'].includes(stage.status) ? '本階段可直接重試，既有 checkpoint 已保留。' : '正在確認任務進度。';
  root.replaceChildren(heading, description, controls);
  $('#assassinNotice').textContent = ['FAILED','INSUFFICIENT','EQUIPMENT_REQUIRED','READY_TO_RETRY'].includes(stage.status) ? '本階段未推進，既有 checkpoint 已保留。' : `伺服器 revision ${Number(runtime?.revision ?? 0)}・${crusaderPhaseNames[phase] ?? phase}`;
}
const jobQuestRenderers = new Map([
  ['ASSASSIN', renderAssassinQuest],
  ['ROGUE', renderRogueQuest],
  ['KNIGHT', renderKnightQuest],
  ['CRUSADER', renderCrusaderQuest],
]);
const completedCareerNames = Object.freeze({
  ASSASSIN: '刺客轉職',
  ROGUE: '流氓轉職',
  KNIGHT: '騎士轉職',
  CRUSADER: '十字軍轉職',
});
function renderJobQuest(runtime, character) {
  const interactionStage = $('#assassinMissionStage');
  if (
    interactionStage &&
    window.MissionInteractionStage?.isStale?.(
      interactionStage,
      projectMissionInteractionStage(runtime),
    )
  ) {
    return;
  }
  const detail = runtime?.careerDetail ?? { mode: 'EMPTY', adapterId: null };
  const adapterId = detail.adapterId ?? runtime?.adapterId ?? runtime?.careerTarget;
  const completed = runtime?.adapterState?.phase === 'COMPLETED';
  setCompletedQuestSource(
    'career',
    completed && adapterId
      ? [{
          id: `career:${adapterId}`,
          title: completedCareerNames[adapterId] ?? `${adapterId} 轉職`,
          category: '職業轉職',
        }]
      : [],
  );
  const careerSection = document.querySelector('[data-task-section="career"]');
  if (careerSection) careerSection.hidden = completed;
  if (interactionStage) interactionStage.hidden = completed;
  renderCareerTargets(runtime);
  if (detail.mode === 'EMPTY' || detail.mode === 'ELIGIBILITY') {
    renderCareerEligibilityDetail(runtime);
    enhanceMissionInteractionStage(runtime);
    return;
  }
  const renderer = jobQuestRenderers.get(detail.adapterId);
  if (renderer) {
    renderer(runtime, character);
    enhanceMissionInteractionStage(runtime);
    return;
  }
  const root = $('#assassinMissionStage');
  if (root) root.textContent = '目前沒有可用的二轉任務 Adapter。';
  enhanceMissionInteractionStage(runtime);
}
// Auto first-job driver (Web intent only). A fresh Novice is advanced by the
// native bound command terminal_onboarding_advance; graduation reuses the same
// protected rAthena jobchange through /api/onboarding/graduate. The server owns
// controller/completion and the native command is idempotent, so this only
// expresses intent at a bounded rate.
let autoFirstJobAttempt = { key: '', at: 0 };
function maybeAutoFirstJob(onboarding, character) {
  if (!onboarding || !character) return;
  if (Number(character.classId) !== 0) return;
  if (onboarding.complete || onboarding.graduated) return;
  const charKey = String(character.id ?? character.charId ?? '');
  const action = Number(onboarding.stage ?? 0) >= 3 ? 'graduate' : 'advance';
  const key = `${charKey}:${action}`;
  const now = performance.now();
  if (autoFirstJobAttempt.key === key && now - autoFirstJobAttempt.at < 30000)
    return;
  autoFirstJobAttempt = { key, at: now };
  api(`/api/onboarding/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }).catch(() => {});
}

function renderOnboarding(onboarding, character, running, live) {
  const quests = onboarding?.quests ?? [];
  const complete = Boolean(onboarding?.complete);
  maybeAutoFirstJob(onboarding, character);
  const migratedFirstJob = Number(character?.classId) > 0 && !complete;
  const currentIndex = Math.max(0, Number(onboarding?.currentIndex) || 0);
  const currentQuest = quests[currentIndex];
  const indexedQuests = quests.map((quest, index) => ({ quest, index }));
  const completedQuests = indexedQuests.filter(
    ({ quest }) => quest.status === 'complete',
  );
  const visibleQuests = sortQuestEntriesByStatus(
    indexedQuests.filter(({ quest }) => quest.status !== 'complete'),
    ({ quest }) => quest.status,
  );
  setCompletedQuestSource(
    'onboarding',
    completedQuests.map(({ quest }) => ({
      id: `onboarding:${quest.id}`,
      title: quest.title,
      category: '新手任務',
    })),
  );
  const beginnerSection = document.querySelector('[data-task-section="beginner"]');
  if (beginnerSection)
    beginnerSection.hidden = quests.length > 0 && visibleQuests.length === 0;
  $('#questSummary').textContent = complete
    ? '新生訓練完成'
    : migratedFirstJob
      ? '一轉完成，任務未記錄'
      : '新生訓練';
  $('#questNotice').textContent = complete
    ? character?.map === 'prt_fild08'
      ? '已抵達普隆德拉原野 08 並開始掛機。後續會依角色等級提供推薦地圖。'
      : '一轉已完成，正在前往普隆德拉原野 08。'
    : migratedFirstJob
      ? '此角色已完成一轉，新手任務已標記完成。'
      : character?.targetJob === 'supernovice' && Number(character?.classId) === 0
        ? `目前位置：${mapNames[character?.map] ?? character?.map ?? '同步中'}。超級初心者未滿 Base Lv.45 時，雙擊「一轉結業」前往練功；達標後再次雙擊即可返回學院。`
        : `目前位置：${mapNames[character?.map] ?? character?.map ?? '同步中'}。雙擊未完成任務即可從目前進度繼續。`;
  if (!quests.length) {
    const empty = document.createElement('p');
    empty.textContent = '正在讀取任務資料';
    $('#questList').replaceChildren(empty);
    return;
  }
  const entries = visibleQuests.map(({ quest, index }) => {
    const button = document.createElement('button');
    const title = document.createElement('span');
    const status = document.createElement('small');
    const superNoviceGraduation =
      quest.id === 'graduation' &&
      character?.targetJob === 'supernovice' &&
      Number(character?.classId) === 0 &&
      index === currentIndex;
    button.type = 'button';
    button.className = `quest-entry ${superNoviceGraduation ? 'active' : quest.status}`;
    button.setAttribute('role', 'listitem');
    title.textContent = quest.title;
    status.textContent = superNoviceGraduation
      ? Number(character?.baseLevel) < 45
        ? `練功中 Base ${Number(character?.baseLevel)} / 45`
        : '可返回學院'
      : questStatusNames[quest.status] ?? '未開始';
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
    journal = eden?.questJournal,
    member = Boolean(eden?.member || journey?.member),
    active = Boolean(
      journey?.active ||
        ['ACTIVE', 'READY_TO_REPORT', 'PAUSED'].includes(journal?.taskStatus),
    ),
    eligible = allowedFirstJobIds.has(Number(character?.classId));
  $('#edenSummary').textContent = active
    ? journal?.sequenceId === 'eden_course_a_v1' || journey?.taskId === 'equipment12'
      ? 'Lv.12 裝備訓練中'
      : journey?.taskId === 'equipment26'
        ? 'Lv.26 裝備訓練中'
        : '自動入團中'
    : member
      ? `成員・訓練進度 ${Number(eden?.trainingStage ?? 0)}`
      : eligible
        ? '可加入'
        : '一轉後開放';
  const limeName = window.roAssetResolver?.resolveNpcAsset('eden-secretary-lime-evenor').name ?? '秘書萊茵 伊貝努勒';
  const boyaName = window.roAssetResolver?.resolveNpcAsset('eden-instructor-boya').name ?? '伊甸園教官 保亞';
  const phaseNotices = {
    route_officer: '正在前往普隆德拉的伊甸園傳送員。',
    enter_headquarters: '正在使用原生伊甸園傳送服務。',
    route_secretary: `已進入伊甸園總部，正在尋找${limeName}。`,
    register_member: '正在填寫伊甸園成員資料並領取徽章。',
    equipment_accept: `正在與${boyaName}對話並接取原生任務 7128。`,
    equipment_route_field: '正在前往夢羅克南東方綠洲 moc_fild11。',
    equipment_dog: '正在與 Talking Dog 對話並同步下一個原生任務。',
    equipment_hunt_condor: '正在擊殺 Condor，進度以伺服器任務資料同步。',
    equipment_hunt_wolf:
      '正在擊殺 Baby Desert Wolf，進度以伺服器任務資料同步。',
    equipment_hunt_scorpion:
      '正在擊殺 Scorpion，進度以伺服器任務資料同步。',
    equipment_report_boya: `條件完成，正在返回${boyaName}回報。`,
    equipment_reward: '正在向 Administrator Michael 領取第一套裝備。',
    equipment26_accept: `正在與${boyaName}對話並接取原生任務 7138。`,
    equipment26_route_field: '正在前往斐揚洞穴一樓 pay_dun00。',
    equipment26_karl: '正在與 Eden Member Karl 對話並同步任務階段。',
    equipment26_hunt_skeleton: '正在擊殺 Skeleton，任務目標為 15 隻。',
    equipment26_hunt_poporing: '正在擊殺 Poporing，任務目標為 10 隻。',
    equipment26_report_boya: `幽靈洞穴訓練完成，正在返回${boyaName}。`,
    equipment26_reward: '正在向 Administrator Michael 領取第二套裝備。',
    equipment_closing_dialog: '裝備已領取，正在等待原生 NPC 對話完整結束。',
    equipment_returning_hunt: '裝備已領取，正在返回普隆德拉原野 08。',
    equipment_complete: '任務完成，第一套伊甸園裝備已存入角色道具欄。',
    returning_hunt: '已取得伊甸園徽章，正在返回普隆德拉原野 08。',
    complete: '入團已完成，角色已返回普隆德拉原野 08 並恢復掛機。',
  };
  $('#edenNotice').textContent = journal?.failure
    ? `任務停止：${journal.failure.message}`
    : journal && journal.taskStatus !== 'AVAILABLE'
      ? journal.currentActionLabel
    : journey?.error
      ? `任務停止：${journey.error}`
    : active || journey?.completed
      ? (phaseNotices[journey?.phase] ?? '正在同步伊甸園任務狀態。')
      : member
        ? `已取得伊甸園徽章。Base Lv.${Number(character?.baseLevel ?? 0)} 可依序進行 Lv.12、26、40 裝備訓練。`
        : eligible
          ? `會從目前地圖前往普隆德拉，使用遊戲內建傳送服務，向${limeName}正式入團。`
          : '完成一轉後開放伊甸園入團與階段裝備訓練。';
  const journalStatus = {
    AVAILABLE: 'available',
    ACTIVE: 'active',
    READY_TO_REPORT: 'active',
    COMPLETED: 'complete',
    FAILED: 'locked',
    PAUSED: 'active',
  }[journal?.taskStatus];
  const milestoneDisplayStatus = (milestone) =>
    milestone.id === 'equipment12' && journal
      ? journalStatus
      : milestone.status;
  const allMilestones = eden?.milestones ?? [];
  const completedMilestones = allMilestones.filter(
    (milestone) => milestoneDisplayStatus(milestone) === 'complete',
  );
  const visibleMilestones = sortQuestEntriesByStatus(
    allMilestones.filter(
      (milestone) => milestoneDisplayStatus(milestone) !== 'complete',
    ),
    milestoneDisplayStatus,
  );
  setCompletedQuestSource(
    'eden',
    completedMilestones.map((milestone) => ({
      id: `eden:${milestone.id}`,
      title: milestone.title,
      category: '伊甸園成長訓練',
    })),
  );
  const edenSection = document.querySelector('[data-task-section="eden"]');
  if (edenSection)
    edenSection.hidden = allMilestones.length > 0 && visibleMilestones.length === 0;
  const milestones = visibleMilestones.map((milestone) => {
    const row = document.createElement('button'),
      title = document.createElement('span'),
      level = document.createElement('small'),
      objective = document.createElement('small'),
      nextAction = document.createElement('small'),
      report = document.createElement('small'),
      reward = document.createElement('small'),
      status = document.createElement('b');
    row.type = 'button';
    const isCourseA = milestone.id === 'equipment12' && journal;
    const displayStatus = milestoneDisplayStatus(milestone);
    row.className = `eden-milestone ${displayStatus}`;
    row.setAttribute('role', 'listitem');
    row.disabled = active;
    title.textContent = milestone.title;
    level.textContent =
      milestone.id === 'member'
        ? '原生 NPC 入團'
        : `Base Lv.${milestone.minimumLevel} 以上`;
    const progress = milestone.progress;
    const journalProgress = isCourseA
      ? journal.mobObjectives
          .map(
            (entry) =>
              `${monsterDisplayName(entry.mobName, entry.mobId)} ${Number(entry.current)} / ${Number(entry.required)}`,
          )
          .join('　')
      : '';
    objective.className = 'eden-milestone-detail';
    objective.textContent = isCourseA
      ? `目標：${journalProgress}`
      : `目標：${milestone.currentObjective || '等待解鎖'}${progress ? `　${Number(progress.count)} / ${Number(progress.goal)}` : ''}`;
    nextAction.className = 'eden-milestone-detail';
    nextAction.textContent = `下一步：${isCourseA ? journal.currentActionLabel : milestone.nextAction || '等待任務資料'}`;
    report.className = 'eden-milestone-detail';
    report.textContent = `回報：${isCourseA && journal.taskStatus === 'READY_TO_REPORT' ? '可回報' : milestone.canReport ? '可回報' : '尚未達成'}`;
    reward.className = 'eden-milestone-reward';
    reward.textContent = `獎勵：${(isCourseA ? journal.rewardSummary : milestone.reward ?? [])
      .map((item) => `${item.name}${isCourseA ? ` × ${item.quantity}${item.confirmed ? '（已取得）' : ''}` : ''}`)
      .join('、') || '尚未接入'}`;
    status.textContent = isCourseA
      ? {
          AVAILABLE: '可進行',
          ACTIVE: '進行中',
          READY_TO_REPORT: '可回報',
          COMPLETED: '完成',
          FAILED: '已停止',
          PAUSED: '已暫停',
        }[journal.taskStatus]
      : questStatusNames[milestone.status] ?? '未開始';
    row.append(title, level, objective, nextAction, report, reward, status);
    row.onclick = () => {
      document
        .querySelectorAll('.eden-milestone')
        .forEach((entry) => entry.classList.toggle('selected', entry === row));
      const baseLevel = Number(character?.baseLevel ?? 0);
      if (displayStatus === 'complete') {
        $('#edenNotice').textContent = `${milestone.title}已完成。`;
      } else if (journal?.failure && isCourseA) {
        $('#edenNotice').textContent = journal.failure.message;
      } else if (displayStatus === 'locked') {
        $('#edenNotice').textContent = `${milestone.title}尚未解鎖，請先完成畫面列出的前置條件。`;
      } else {
        $('#edenNotice').textContent =
          baseLevel > milestone.minimumLevel
            ? `雙擊「${milestone.title}」開始補課，完成後仍由原生 NPC 發放裝備。`
            : `雙擊「${milestone.title}」開始執行。`;
      }
    };
    row.ondblclick = () => {
      if (milestone.status === 'complete' || displayStatus === 'complete') return;
      runEdenTask(milestone.id);
    };
    return row;
  });
  $('#edenMilestones').replaceChildren(...milestones);
}
const equipmentSlotBits = [
  [256, 'headTop'],
  [512, 'headMid'],
  [1, 'headLow'],
  [2, 'rightHand'],
  [4, 'garment'],
  [8, 'accessoryRight'],
  [16, 'armor'],
  [32, 'leftHand'],
  [64, 'shoes'],
  [128, 'accessoryLeft'],
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

function syncAdminSurfaceLink(adminSurface) {
  const headerRow = document.querySelector(
    '#game header.brand > div:last-child',
  );
  if (!headerRow) return;
  const existing = $('#adminObservatoryLink');
  if (!adminSurface) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const link = document.createElement('a');
  link.id = 'adminObservatoryLink';
  link.href = '/admin/observatory.html';
  link.target = '_blank';
  link.className = 'admin-nav-link';
  link.setAttribute('aria-label', '管理後台：Web 體驗監控');
  link.textContent = '管理後台';
  const logout = $('#logout');
  if (logout) headerRow.insertBefore(link, logout);
  else headerRow.append(link);
}

function renderWorldMapTowns() {
  const towns = farmMapAvailabilityData?.towns ?? [];
  const area = $('#worldMapTowns');
  const labels = $('#worldMapTownLabels');
  const other = document.createElement('div');
  other.className = 'world-map-town-list';
  $('#worldMapSavedTown').textContent = `儲存主城：${farmMapAvailabilityData?.player?.savedTown?.name ?? '尚未設定'}`;
  $('#worldMapSavedTownHint').classList.toggle('hidden',
    farmMapAvailabilityData?.player?.savedTownSetupRequired !== true);
  const positioned = new Set();
  const overlayButtons = [];
  for (const town of towns) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'world-map-town-label';
    button.dataset.mapId = town.map;
    button.textContent = town.name ?? town.map;
    button.onclick = (event) => {
      event.stopPropagation();
      selectTownWorldMap(town.map);
      const overlapping = worldMapRegionsAtPoint(event,
        mapInfoData?.worldMap?.regions ?? []);
      const choices = [{ mapId: town.map, name: town.name ?? town.map,
        kind: 'town' }, ...overlapping.filter((region) => region.mapId !== town.map)];
      renderWorldMapOverlapChoices(choices, town.map);
    };
    const position = mapInfoData?.worldMap?.regions?.find((region) =>
      region.mapIds?.includes(town.map))?.position;
    if (position) {
      button.style.left = `${((position.x1 + position.x2) / 2 / mapInfoData.worldMap.width) * 100}%`;
      button.style.top = `${((position.y1 + position.y2) / 2 / mapInfoData.worldMap.height) * 100}%`;
      overlayButtons.push(button);
      positioned.add(town.map);
    } else {
      button.className = '';
      other.append(button);
    }
  }
  labels.replaceChildren(...overlayButtons);
  area.replaceChildren(other);
  area.classList.toggle('hidden', other.childElementCount === 0);
}

async function waitForWorldMapAuthority(predicate, timeoutMs = 30000, command = null) {
  let nextCommandPollAt = 0;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (command?.commandId && command?.charId && Date.now() >= nextCommandPollAt) {
      const status = await api(`/api/ro/agents/${command.charId}/ownership/commands/${command.commandId}`);
      if (status.command?.status === 'REJECTED' &&
          status.command.reasonCode === 'SUPPLY_RESTART_RETRY_REQUIRED') {
        command = null; // Web recovery now follows the native paid receipt.
      } else if (['REJECTED', 'FAILED'].includes(status.command?.status))
        throw new Error(status.command.reasonCode || 'SUPPLY_SERVICE_UNAVAILABLE');
      nextCommandPollAt = Date.now() + 3000;
    }
    const response = await fetch('/api/farm-map-availability', { cache: 'no-store' });
    if (response.ok) {
      const state = await response.json();
      farmMapAvailabilityData = state;
      if (predicate(state)) return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('伺服器尚未確認傳送，請查看角色目前地圖');
}

function showWorldMapArrival(name) {
  const toast = $('#worldMapArrivalToast');
  toast.textContent = `已抵達 ${name}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function selectTownWorldMap(mapId) {
  const town = farmMapAvailabilityData?.towns?.find((row) => row.map === mapId);
  if (!town) return;
  const detail = $('#worldMapDetail');
  const title = document.createElement('h3');
  title.textContent = town.name ?? town.map;
  const info = document.createElement('p');
  info.className = 'world-map-meta';
  info.textContent = `Map ID：${town.map}\n類型：主城\n傳送費：免費\n傳送冷卻：田野回城無、主城互傳 30 秒\n目前儲存主城：${farmMapAvailabilityData?.player?.savedTown?.name ?? '尚未設定'}`;
  info.style.whiteSpace = 'pre-line';
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'primary';
  action.textContent = town.buttonState === 'ALREADY_ON_TARGET_MAP'
    ? '已經在該地圖'
    : town.buttonState === 'WORLD_MAP_TELEPORT_COOLDOWN'
      ? `${town.cooldownRemaining} 秒後可再次傳送`
      : `傳送至${town.name ?? town.map}`;
  action.disabled = town.buttonState !== 'AVAILABLE';
  action.onclick = () => {
    if (worldMapTravelPresentation?.state !== 'MAP_PORTAL_OPEN') return;
    const confirm = $('#worldMapConfirm');
    $('#worldMapConfirmTitle').textContent = `是否傳送至${town.name ?? town.map}？`;
    $('#worldMapConfirmCost').textContent = '傳送費用：免費';
    $('#worldMapConfirmSubmit').textContent = '確定傳送';
    confirm.classList.remove('hidden');
    $('#worldMapConfirmCancel').onclick = () => closeWorldMap();
    $('#worldMapConfirmSubmit').onclick = async () => {
      const submit = $('#worldMapConfirmSubmit');
      if (!worldMapTravelPresentation?.beginSubmission()) return;
      submit.disabled = true;
      try {
        const result = await api('/api/world-map-teleport', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mapId }),
        });
        if (result.reason === 'ALREADY_ON_TARGET_MAP') {
          worldMapTravelPresentation.preflightRejected();
          confirm.classList.add('hidden');
          $('#worldMapStatus').textContent = '已在該地圖';
          return;
        }
        confirm.classList.add('hidden');
        worldMapTravelPresentation.preflightAccepted({
          mapId, name: town.name ?? town.map,
        });
        await waitForWorldMapAuthority((state) =>
          state.player?.currentMap === mapId);
        await refresh({ full: false });
        worldMapTravelPresentation.authoritativeArrival(mapId);
      } catch (error) {
        if (!worldMapTravelPresentation.failed(error))
          worldMapTravelPresentation.preflightRejected();
        $('#worldMapStatus').textContent = farmTargetBlockedMessage(error.message);
        confirm.classList.add('hidden');
      } finally { submit.disabled = false; }
    };
    $('#worldMapConfirmSubmit').focus();
  };
  const saved = farmMapAvailabilityData?.player?.savedTown?.map === mapId;
  const physicallyHere = farmMapAvailabilityData?.player?.currentMap === mapId;
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = saved ? '目前儲存主城' : '設為儲存主城';
  save.disabled = saved || !physicallyHere;
  save.onclick = async () => {
    save.disabled = true;
    try {
      await api('/api/saved-town', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mapId }) });
      await waitForWorldMapAuthority((state) => state.player?.savedTown?.map === mapId);
      renderWorldMapTowns();
      selectTownWorldMap(mapId);
    } catch (error) {
      $('#worldMapStatus').textContent = farmTargetBlockedMessage(error.message);
      save.disabled = false;
    }
  };
  detail.replaceChildren(title, info, action, save);
}

function syncDiscordUi(discord, { required = false } = {}) {
  const state = discord ?? {};
  const login = $('#discordLoginButton');
  const link = $('#discordLinkButton');
  const unlink = $('#discordUnlinkButton');
  const summary = $('#discordIdentitySummary');
  const notice = $('#discordSettingsNotice');
  const requiredLink = $('#discordRequiredLink');
  if (requiredLink) {
    requiredLink.disabled = !state.configured || state.linked;
    requiredLink.classList.toggle('hidden', Boolean(state.linked));
  }
  if (login) {
    login.disabled = !state.configured;
    login.title = state.configured ? '' : 'Discord 登入尚未設定';
  }
  if (link) {
    link.disabled = !state.configured || !state.managementAllowed;
    link.classList.toggle('hidden', Boolean(state.linked));
  }
  if (unlink) {
    unlink.disabled = !state.managementAllowed;
    unlink.classList.toggle('hidden', !state.linked);
  }
  if (summary) {
    summary.replaceChildren();
    if (state.identity) {
      if (state.identity.avatarUrl) {
        const image = document.createElement('img');
        image.src = state.identity.avatarUrl;
        image.alt = '';
        image.width = 32;
        image.height = 32;
        image.className = 'discord-avatar';
        summary.append(image);
      }
      const label = document.createElement('span');
      label.textContent = state.identity.displayName + ' · 已綁定';
      summary.append(label);
    } else {
      summary.textContent = state.configured ? '未綁定' : 'Discord 登入尚未設定';
    }
  }
  if (notice) notice.textContent = state.guildMembershipRequired
    ? '官方 Discord 公會資格會在啟用後由伺服器驗證。'
    : 'Discord 名稱與頭像只用於顯示。';
  const gate = $('#discordRequiredGate');
  if (gate) gate.classList.toggle('hidden', !required);
}

const discordMessages = {
  linked: 'Discord 已綁定。',
  logged_in: 'Discord 登入成功。',
  discord_oauth_cancelled: '已取消 Discord 授權。',
  login_required: '請先登入 Ghost Island，再綁定 Discord。',
  discord_oauth_not_configured: 'Discord 登入尚未設定。',
  discord_oauth_state_invalid: '驗證已失效或已使用，請重新開始。',
  discord_account_not_linked: '此 Discord 尚未綁定，請先用原帳號完成綁定。',
  discord_identity_already_linked: '此 Discord 已綁定其他 Ghost Island 帳號。',
  discord_link_session_required: '請以原帳號重新登入，再開始綁定。',
  discord_unlink_requires_alternative_login: '請先建立另一種登入方式，再解除 Discord 綁定。',
};
function discordReturnNotice() {
  const value = new URLSearchParams(location.search).get('discord');
  if (!value) return null;
  history.replaceState({}, document.title, location.pathname);
  return discordMessages[value] ?? 'Discord 驗證未完成。';
}
async function beginDiscordLink() {
  const result = await api('/api/account/discord/link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!result.authorizationUrl) throw new Error('Discord 綁定尚未就緒');
  location.assign(result.authorizationUrl);
}

async function refreshOnce(full, latencyTrace = null) {
  try {
    const interest = currentWebInterest(),
      incoming = await api(
        full
          ? `/api/state?view=full&interest=${encodeURIComponent(interest)}`
          : `/api/state?view=lean&interest=${encodeURIComponent(interest)}`,
        { latencyTrace },
      ),
      state = mergeDashboardState(lastState, incoming, 'state-poll');
    lastState = state;
    applyCombatStreamState(state.combatStream);
    if (!incoming.partial && state.derived?.domainRevisions?.quest !== undefined)
      lastQuestFullRevision = state.derived.domainRevisions.quest;
    if (state.needsCharacter) {
      show($('#auth'));
      show($('#loginForm'), false);
      show($('#characterForm'));
      show($('#game'), false);
      return;
    }
    sessionStartedAt = state.startedAt;
    sessionEndedAt = state.endedAt ?? null;
    currentRunning = state.running;
    $('#accountName').textContent = `帳號：${state.account.username}`;
    mountCharacterConfigEditor(state.character?.charId ?? state.account?.characterId);
    syncAdminSurfaceLink(state.account?.adminSurface === true);
    const activeTask = taskInProgress(state.derived);
    $('#status').textContent = activeTask
      ? '任務進行中'
      : state.running
        ? '掛機中'
        : '已停止';
    // The OpenKore-derived button state must not fight the authoritative
    // SERVER_AGENT controller state: while the agent owns the character,
    // applyControllerUi() is the only writer of these buttons.
    if (!agentOwnsCharacter()) {
      $('#start').disabled = activeTask || state.running;
      $('#stop').disabled = activeTask || !state.running;
    }
    $('#automationNotice').textContent = activeTask
      ? '目前正在執行任務，完成後會自動恢復掛機。'
      : '';
    $('#kills').textContent = state.kills;
    $('#deaths').textContent = state.deaths;
    $('#baseExpGained').textContent = state.baseExpGained.toLocaleString();
    $('#jobExpGained').textContent = state.jobExpGained.toLocaleString();
    $('#duration').textContent = duration(state.startedAt, state.endedAt);
    setCharacter(state.character, state.derived);
    renderMinimap(state.derived, {
      combatObserved: Object.hasOwn(incoming.derived ?? {}, 'players'),
    });
    if (!incoming.partial) {
      renderOnboarding(
        state.onboarding,
        state.character,
        state.running,
        state.derived,
      );
      renderJobQuest(state.questRuntime, state.character);
      renderEden(state.eden, state.character);
    }
    setMusicContext(state.character?.map);
    const editingChat = document.activeElement === $('#chatInput');
    if (!editingChat) {
      setInventory(state.inventory);
      setEquipment(state.character, state.equipment);
    }
    setServices(state.world);
    setLoot(state.items);
    setSupplyCycle(state.supplyCycle, state.derived, state.inventory);
    syncGrindTargetSummary(state.grindTarget);
    void syncControllerStatus(state.character?.charId);
  } catch (error) {
    if (/登入/.test(error.message)) {
      show($('#auth'));
      show($('#game'), false);
      clearInterval(statePoll);
      clearTimeout(eventTimer);
      closeCombatStream();
      clearTimeout(socialTimer);
    } else {
      $('#status').textContent = '控制層斷線';
      $('#worldLamp').textContent = '無法連線';
    }
  }
}
let stateRefreshInFlight = null,
  stateRefreshInFlightFull = false;
async function refresh(options = {}) {
  const full = options?.full !== false,
    latencyTrace = options?.latencyTrace ?? null;
  if (stateRefreshInFlight) {
    if (full && !stateRefreshInFlightFull) {
      await stateRefreshInFlight;
      return await refresh(options);
    }
    return await stateRefreshInFlight;
  }
  stateRefreshInFlightFull = full;
  stateRefreshInFlight = refreshOnce(full, latencyTrace);
  try {
    return await stateRefreshInFlight;
  } finally {
    stateRefreshInFlight = null;
    stateRefreshInFlightFull = false;
  }
}

function applyGameEntryLeanState(incoming) {
  if (incoming?.contract !== 'GAME_ENTRY_LEAN_STATE' || !incoming.uiReady)
    throw new Error('最小遊戲狀態尚未就緒');
  const state = mergeDashboardState(lastState, incoming, 'game-entry');
  lastState = state;
  applyCombatStreamState(state.combatStream);
  sessionStartedAt = state.startedAt;
  sessionEndedAt = state.endedAt ?? null;
  currentRunning = Boolean(state.running);
  $('#accountName').textContent = `帳號：${state.account.username}`;
  $('#status').textContent = state.running ? '掛機中' : '已停止';
  if (!agentOwnsCharacter()) {
    $('#start').disabled = Boolean(state.running);
    $('#stop').disabled = !state.running;
  }
  $('#automationNotice').textContent = '';
  setCharacterHeader(state.character, state.derived);
  renderMinimap(state.derived, {
    combatObserved: Object.hasOwn(incoming.derived ?? {}, 'players'),
  });
  setMusicContext(state.character?.map);
  $('#game').dataset.hydrationState = 'first-playable';
  $('#game').dataset.hydratedDomains = incoming.hydratedDomains.join(',');
  return state;
}

function normalizeGameEntryState(incoming) {
  if (incoming?.contract === 'GAME_ENTRY_LEAN_STATE' && incoming.uiReady)
    return incoming;
  if (!incoming?.account || !incoming?.character)
    throw new Error('最小遊戲狀態尚未就緒');
  const character = incoming.character;
  return {
    ...incoming,
    contract: 'GAME_ENTRY_LEAN_STATE',
    partial: false,
    firstPlayable: true,
    uiReady: true,
    hydratedDomains: [
      'identity',
      'vitals',
      'map',
      'automation',
      'ownership',
    ],
    derived: incoming.derived ?? {
      ...character,
      jobId: character.classId,
      playerX: character.x,
      playerY: character.y,
      domainRevisions: incoming.domainRevisions ?? {},
    },
  };
}

function applyGameEntryBootstrap(bootstrap) {
  if (!bootstrap?.account || !bootstrap?.character) return;
  $('#accountName').textContent = `帳號：${bootstrap.account.username}`;
  $('#status').textContent = '同步角色狀態';
  $('#start').disabled = true;
  $('#stop').disabled = true;
  $('#automationNotice').textContent = '正在讀取角色即時狀態';
  setCharacterHeader(bootstrap.character, bootstrap.derived);
  $('#game').dataset.hydrationState = 'bootstrap';
  $('#game').dataset.hydratedDomains = 'identity,vitals,map';
}

async function loadGameEntryLeanState(latencyTrace) {
  const incoming = await api(
    `/api/state?view=entry&interest=${encodeURIComponent(ObservationInterest.COMBAT_PAGE)}`,
    { latencyTrace },
  );
  return applyGameEntryLeanState(normalizeGameEntryState(incoming));
}

async function hydrateGameEntryBackground() {
  const latencyTrace = beginLatencyInteraction('game_entry_background_hydration');
  try {
    await Promise.all([
      refresh({ full: false, latencyTrace }),
      combatStreamAvailable()
        ? recoverCombatStream('game_entry', latencyTrace)
        : Promise.resolve(restartCombatDelivery()),
    ]);
    $('#game').dataset.hydrationState = 'background-ready';
  } finally {
    void completeLatencyInteraction(latencyTrace, {
      visibleTarget: 'game-background-ready',
    });
  }
}
async function readLoginHealth(latencyTrace = null) {
  let lastError = null;
  let lastHealth = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const health = await api('/api/health', { latencyTrace });
      if (health.ok === true) return health;
      lastHealth = health;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0)
      await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastHealth) return lastHealth;
  throw lastError ?? new Error('伺服器健康檢查失敗');
}
async function hydrateCharacterSelectionEquipment(charId) {
  try {
    const session = await api('/api/session?view=equipment');
    if (Number(session.account?.characterId) !== Number(charId)) return;
    characterShowcase.equipment = session.equipment ?? [];
    paintRankingCharacter(
      $('#selectPaperdoll'),
      {
        classId: Number(session.account?.classId ?? 0),
        appearance: session.account,
        equipment: characterShowcase.equipment,
      },
      'stand',
      0,
    );
  } catch {
    // Equipment is deferred decoration; character selection remains usable.
  }
}

function syncSupportDebugBanner(supportSession) {
  const banner = $('#supportDebugBanner');
  const details = $('#supportDebugDetails');
  if (!banner || !details) return;
  if (!supportSession?.supportSessionId) {
    banner.classList.add('hidden');
    return;
  }
  const remaining = Math.max(0, Number(supportSession.remainingMs ?? 0));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  details.textContent = `角色 ${supportSession.effectiveCharId} · 帳號 ${supportSession.effectiveAccountId} · 操作者 ${supportSession.actorAdminId} · 模式 ${supportSession.mode} · 剩餘 ${minutes}:${String(seconds).padStart(2, '0')}`;
  banner.classList.remove('hidden');
}

$('#supportDebugEnd')?.addEventListener('click', async () => {
  await api('/api/support-session/revoke', { method: 'POST' });
  window.location.reload();
});

async function enter(latencyTrace = null) {
  const [session, health] = await Promise.all([
    api('/api/session?view=entry', { latencyTrace }),
    readLoginHealth(latencyTrace),
  ]);
  $('#loginServerStatus').textContent = health.ok ? '伺服器正常' : '無法連線';
  applyObservationPolicy(session.observationPolicy);
  applyWebExperienceTelemetry(session.webExperienceTelemetry);
  syncSupportDebugBanner(session.supportSession);
  const returnNotice = discordReturnNotice();
  syncDiscordUi(session.discord);
  authenticated = Boolean(session.account);
  restartWebActivityHeartbeat();
  applyCombatStreamState(session.combatSse);
  if (!session.account) {
    setAuthLoading(false);
    setMusicContext('title');
    show($('#auth'));
    show($('#loginForm'));
    show($('#characterForm'), false);
    show($('#characterSelectForm'), false);
    syncAudioControls();
    $('#loginSubmit').disabled = false;
    $('#authError').textContent = returnNotice ?? '';
    return;
  }
  if (session.discord?.accessGate) {
    setAuthLoading(false);
    setMusicContext('title');
    show($('#auth'));
    show($('#loginForm'), false);
    show($('#characterForm'), false);
    show($('#characterSelectForm'), false);
    show($('#game'), false);
    syncDiscordUi(session.discord, { required: true });
    $('#discordRequiredMessage').textContent =
      session.discord.accessGate === 'discord_guild_membership_unavailable'
        ? '官方 Discord 成員驗證尚未設定。'
        : session.discord.accessGate === 'discord_guild_membership_required'
          ? '此帳號需要官方 Discord 公會資格才能繼續。'
          : '此帳號需要先完成 Discord 綁定。';
    return;
  }
  if (!session.account.characterId || !session.account.characterName) {
    setAuthLoading(false);
    setMusicContext('title');
    currentCreateSex = session.account.sex === 'F' ? 'F' : 'M';
    document.querySelector(
      `[name=createSex][value=${currentCreateSex}]`,
    ).checked = true;
    show($('#auth'));
    show($('#loginForm'), false);
    show($('#characterForm'));
    show($('#characterSelectForm'), false);
    $('#createPaperdoll').src = paperdollAsset(
      currentCreateSex,
      $('#hair').value,
    );
    $('#characterError').textContent = returnNotice ?? '請先建立角色';
    void loadAccountAudio();
    return;
  }
  setAuthLoading(true, '登入成功，正在準備角色資料……');
  const requiredCharacterFields = [
    'baseExp', 'jobExp', 'zeny', 'str', 'agi', 'vit', 'int', 'dex', 'luk',
    'hp', 'maxHp', 'sp', 'maxSp', 'map',
  ];
  if (!session.character || requiredCharacterFields.some(
    (field) => session.character[field] === null || session.character[field] === undefined,
  )) throw new Error('角色資料尚未完整，請重試登入');
  const character = {
    charId: session.account.characterId,
    name: session.account.characterName,
    ...session.account,
    ...(session.character ?? {}),
    name: session.character?.name ?? session.account.characterName,
    equipment: session.equipment ?? [],
  };
  gameEntryBootstrap = {
    account: { username: session.account.username },
    character,
    derived: {
      ...character,
      jobId: character.classId,
      playerX: character.x,
      playerY: character.y,
      hp: character.hp,
      maxHp: character.maxHp,
      sp: character.sp,
      maxSp: character.maxSp,
      map: character.map,
    },
  };
  const selectPaperdoll = $('#selectPaperdoll');
  selectPaperdoll.dataset.direction = '0';
  $('#selectCharacterName').textContent = character.name;
  $('#selectCharacterMeta').textContent =
    jobNames[character.classId] ?? `職業 ${character.classId}`;
  $('#selectCharacterLevel').textContent =
    `Base ${character.baseLevel} / Job ${character.jobLevel}`;
  renderCharacterSelectionSummary(character);
  setMusicContext('title');
  await prepareCharacterSelectionCore(character);
  show($('#auth'));
  show($('#loginForm'), false);
  show($('#characterForm'), false);
  show($('#characterSelectForm'));
  show($('#game'), false);
  setAuthLoading(false);
  void hydrateCharacterSelectionEquipment(character.charId);
  void loadAccountAudio();
  scheduleGameplayModuleWarmup();
}
const persistentLifeState = { charId: null, data: null, timelineOpen: false };

// rAthena applies the travel effect without consuming these project-defined
// permanent items. Their authoritative success signal is movement, not a
// quantity decrement.
const nonConsumableTravelItemIds = new Set([601, 602]);

function authoritativePositionOf(live) {
  return {
    map: String(live?.map ?? ''),
    x: Number(live?.x ?? live?.playerX),
    y: Number(live?.y ?? live?.playerY),
  };
}

function authoritativePositionChanged(before, after) {
  return Boolean(after?.map) && (
    before?.map !== after.map ||
    (Number.isFinite(before?.x) && Number.isFinite(after?.x) && before.x !== after.x) ||
    (Number.isFinite(before?.y) && Number.isFinite(after?.y) && before.y !== after.y)
  );
}

function formatPersistentLifeDuration(session) {
  if (!session?.startedAt || !session?.endedAt) return null;
  const started = Date.parse(String(session.startedAt).replace(' ', 'T'));
  const ended = Date.parse(String(session.endedAt).replace(' ', 'T'));
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started)
    return null;
  const totalMinutes = Math.round((ended - started) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} 小時 ${minutes} 分鐘` : `${minutes} 分鐘`;
}

function persistentLifeFactsText(facts) {
  if (!facts || typeof facts !== 'object') return '';
  const entries = Object.entries(facts).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
  return entries.length ? `｜事實 ${JSON.stringify(Object.fromEntries(entries))}` : '';
}

function persistentLifeEventText(event) {
  if (!event || typeof event !== 'object') return '';
  const identity = [
    Number.isFinite(Number(event.eventId)) ? `#${Number(event.eventId)}` : null,
    Number.isFinite(Number(event.sequence)) ? `第 ${Number(event.sequence)} 段` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const occurredAt = event.occurredAt ? String(event.occurredAt) : '時間未提供';
  const label = event.label ? String(event.label) : String(event.eventType ?? '事件');
  const map = event.map ? `（${String(event.map)}）` : '';
  const type = event.eventType ? `｜類型 ${String(event.eventType)}` : '';
  const source = event.source ? `｜來源 ${String(event.source)}` : '';
  return `${identity ? `${identity}｜` : ''}${occurredAt}｜${label}${map}${type}${source}${persistentLifeFactsText(event.facts)}`;
}

function renderPersistentLifeLoading() {
  const container = $('#persistentLifeWindow');
  if (!container) return;
  container.hidden = false;
  $('#persistentLifeStatus').textContent = '讀取中';
  $('#persistentLifeSummary').textContent = '正在讀取離線足跡……';
  $('#persistentLifeHighlights').replaceChildren();
  $('#persistentLifeTimeline').replaceChildren();
  $('#persistentLifeTimeline').hidden = true;
}

function renderPersistentLife() {
  const container = $('#persistentLifeWindow');
  if (!container) return;
  const data = persistentLifeState.data;
  const session = data?.session;
  if (!data?.available || !session) {
    container.hidden = true;
    return;
  }
  const counts = data.counts ?? {};
  const highlightsData = Array.isArray(data.highlights) ? data.highlights : [];
  const eventsData = Array.isArray(data.events) ? data.events : [];
  const duration = formatPersistentLifeDuration(session);
  $('#persistentLifeStatus').textContent = session.seen ? '已查看' : '新的足跡';
  $('#persistentLifeSummary').textContent = [
    duration ? `離線時間 ${duration}` : null,
    session.startMap ? `從 ${session.startMap} 出發` : null,
    session.endMap ? `最後在 ${session.endMap}` : null,
    `擊殺 ${Number(counts.kills ?? 0)}、取得物品 ${Number(counts.loot ?? 0)}、NPC 互動 ${Number(counts.npcInteractions ?? 0)}`,
    `地圖變更 ${Number(counts.mapChanges ?? 0)}、死亡 ${Number(counts.deaths ?? 0)}`,
  ]
    .filter(Boolean)
    .join('｜');
  const highlights = $('#persistentLifeHighlights');
  highlights.replaceChildren(
    ...highlightsData.map((event) => {
      const item = document.createElement('li');
      item.textContent = persistentLifeEventText(event);
      return item;
    }),
  );
  const timeline = $('#persistentLifeTimeline');
  timeline.replaceChildren(
    ...eventsData.map((event) => {
      const item = document.createElement('li');
      item.textContent = persistentLifeEventText(event);
      return item;
    }),
  );
  timeline.hidden = !persistentLifeState.timelineOpen;
  $('#persistentLifeTimelineToggle').textContent = persistentLifeState.timelineOpen
    ? '收起足跡'
    : '查看完整足跡';
  container.hidden = false;
}

async function refreshPersistentLife(charId) {
  const id = Number(charId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  persistentLifeState.charId = id;
  renderPersistentLifeLoading();
  try {
    persistentLifeState.data = await api(
      `/api/ro/agents/${id}/persistent-life/latest`,
    );
    renderPersistentLife();
  } catch (error) {
    persistentLifeState.data = null;
    renderPersistentLife();
    console.error('PERSISTENT_LIFE_LOAD_FAILED', error);
  }
}

async function dismissPersistentLife() {
  const container = $('#persistentLifeWindow');
  if (container) container.hidden = true;
  const id = persistentLifeState.charId;
  if (!Number.isSafeInteger(id) || id <= 0) return;
  try {
    await api(`/api/ro/agents/${id}/persistent-life/latest/seen`, {
      method: 'POST',
    });
    if (persistentLifeState.data?.session)
      persistentLifeState.data.session.seen = true;
  } catch (error) {
    console.error('PERSISTENT_LIFE_SEEN_FAILED', error);
  }
}

// --- Web <-> SERVER_AGENT canary control surface ---------------------------
// The browser renders the authoritative controller of the character and may
// only emit the fixed W1 intents. It never decides ownership and never sends
// raw commands.
const canaryWebActions = new Set([
  'claim_agent',
  'start_farm',
  'stop_farm',
]);
let controllerState = null;

function agentOwnsCharacter() {
  return (
    controllerState?.available === true &&
    controllerState.controller === 'SERVER_AGENT'
  );
}

// Player-facing automation status. This is presentation only: it maps the
// existing authoritative SERVER_AGENT live phase / agent mode onto natural
// language and never invents a second automation-state model. When every
// automation-control field is unresolved the caller hides the strip instead of
// exposing internal control-plane labels.
const playerAutomationPhaseLabels = Object.freeze({
  AUTO_FARM: '自動戰鬥中',
  RECOVERING: '恢復中',
  RESPAWNING: '等待復活',
  SUPPLY: '前往補給',
  RETURN_TO_FARM: '前往掛機地圖',
  NAVIGATING: '前往掛機地圖',
  DEAD: '等待復活',
  RELEASING: '停止中',
  IDLE: '已停止',
});
const playerAutomationModeLabels = Object.freeze({
  AUTO_FARM: '自動戰鬥中',
  AUTO_QUEST: '任務進行中',
  RECOVERING: '恢復中',
  DEAD: '等待復活',
  NAVIGATING: '前往掛機地圖',
  PERSISTENT_IDLE: '已停止',
});

function playerAutomationStatus(status) {
  if (!status || status.available !== true) return null;
  // OPENKORE ownership is not a player-relevant automation state in this
  // control surface; the existing 掛機 status line already covers it.
  if (status.controller !== 'SERVER_AGENT') return null;
  if (status.farmRunning === false) return '狀態：已停止';
  const live = status.liveStatus;
  const phase = typeof live?.phase === 'string' ? live.phase.trim() : '';
  const phaseLabel = phase ? playerAutomationPhaseLabels[phase] : null;
  if (phaseLabel) return `狀態：${phaseLabel}`;
  const mode =
    typeof status.agentMode === 'string' ? status.agentMode.trim() : '';
  const modeLabel = mode ? playerAutomationModeLabels[mode] : null;
  return modeLabel ? `狀態：${modeLabel}` : null;
}

// Player-facing reason when an automation intent is not currently accepted.
// Presentation only: the authoritative eligibility still comes from the
// server-side controller status. Internal blocker codes never reach the UI.
function playerAutomationBlockedReason(status) {
  const blockers = status?.actionBlockers ?? {};
  if (blockers.startFarm === 'farm_target_unresolved')
    return '此角色尚未設定伺服器可受理的掛機地圖，請先更換掛機地圖。';
  if (blockers.startFarm === 'task_already_active') return '掛機正在進行中。';
  if (blockers.startFarm === 'rollout_not_allowlisted')
    return '此角色目前尚未開放自動掛機。';
  if (blockers.stopFarm === 'nothing_to_stop') return '目前沒有進行中的掛機。';
  return '目前無法受理新的掛機指令。';
}

function applyControllerUi(status) {
  const panel = $('#canaryPanel');
  if (!panel) return;
  if (!status) {
    panel.hidden = true;
    return;
  }
  const badge = $('#controllerBadge'),
    claim = $('#canaryClaim'),
    notice = $('#canaryNotice');
  const canaryView = status?.available === true && status.canary === true;
  const playerStatus = playerAutomationStatus(status);
  // Keep the main status in sync with the same authoritative controller phase
  // shown in this panel. Legacy session.running stays false for PA-owned play.
  if (playerStatus) $('#status').textContent = playerStatus.slice('狀態：'.length);
  const modeLabel =
    status?.controller === 'SERVER_AGENT' ? '指定掛機' : '玩家控制';
  // The strip is only rendered when it carries a player-facing status or the
  // character is a canary with control actions. Otherwise it stays hidden.
  panel.hidden = !(canaryView || playerStatus !== null);
  badge.hidden = !canaryView && playerStatus === null;
  badge.textContent = playerStatus
    ? `控制模式：${modeLabel}　${playerStatus}`
    : `控制模式：${modeLabel}`;
  // Debug/admin instrumentation only: raw fields stay off the visible surface
  // but remain available to runtime diagnostics and the admin API.
  badge.dataset.available = status?.available === true ? '1' : '0';
  badge.dataset.controller = status?.controller ?? 'UNAVAILABLE';
  badge.dataset.agentMode = status?.agentMode ?? '';
  badge.dataset.runtimeState = status?.runtimeState ?? '';
  badge.dataset.ownershipState = status?.ownershipState ?? '';
  const live = status?.liveStatus ?? null;
  badge.dataset.runtimePhase = live?.phase ?? '';
  badge.dataset.liveFresh = live?.fresh === true ? '1' : '0';
  badge.dataset.liveSource = live?.source ?? '';
  badge.dataset.liveReason = live?.reason ?? '';
  badge.dataset.supplyItemAmount = live ? String(live.supplyItemAmount ?? '') : '';
  claim.hidden = !(canaryView && status.actions?.claim === true);
  $('#start').textContent = '開始指定掛機';
  $('#stop').textContent = '停止掛機';
  if (!canaryView) {
    notice.textContent = '';
    return;
  }
  if (status.controller === 'SERVER_AGENT') {
    $('#start').disabled = status.actions?.startFarm !== true;
    $('#stop').disabled = status.actions?.stopFarm !== true;
    const liveText = !live
      ? '　即時狀態：等待同步。'
      : live.fresh
        ? `　即時：${playerAutomationPhaseLabels[live.phase] ?? live.phase}${live.map ? ` @ ${live.map} (${live.x}, ${live.y})` : ''}　HP ${live.hp}/${live.maxHp}　補給品 ${live.supplyItemAmount}`
        : `　即時狀態：${
            live.reason === 'live_status_not_resident'
              ? '狀態同步中（顯示最後儲存值）'
              : '狀態更新延遲（顯示最後儲存值）'
          }`;
    notice.textContent =
      (status.actions?.startFarm === true
        ? '角色由系統托管，掛機指令會交由伺服器執行。'
        : playerAutomationBlockedReason(status)) + liveText;
  }
}

async function syncControllerStatus(charId) {
  const id = Number(charId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    controllerState = null;
    applyControllerUi(null);
    return null;
  }
  try {
    controllerState = await api(`/api/ro/agents/${id}/controller`);
  } catch (error) {
    if (error.status === 404) {
      // Dashboard server predates the canary controller route: behave exactly
      // like before this feature and do not show a misleading error badge.
      controllerState = null;
      applyControllerUi(null);
      return null;
    }
    controllerState = {
      available: false,
      unavailableReason: 'agent_status_unavailable',
    };
    console.error('SERVER_AGENT_CONTROLLER_STATUS_FAILED', error);
  }
  applyControllerUi(controllerState);
  return controllerState;
}

async function actCanary(action) {
  if (!canaryWebActions.has(action)) return;
  const id = Number(lastState?.character?.charId ?? controllerState?.charId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const claim = $('#canaryClaim'),
    notice = $('#canaryNotice');
  if (claim) claim.disabled = true;
  if (notice) notice.textContent = '指令已送出，等待伺服器確認。';
  const postOwnership = () =>
    api(`/api/ro/agents/${id}/ownership/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        expectedRevision: Number(controllerState?.revision ?? 0),
      }),
    });
  try {
    try {
      await postOwnership();
    } catch (error) {
      if (error.message !== 'stale_revision') throw error;
      await syncControllerStatus(id);
      await postOwnership();
    }
  } catch (error) {
    const messages = {
      rollout_disabled: '自動掛機尚未開放',
      rollout_not_allowlisted: '此角色尚未開放自動掛機',
      ownership_conflict: '角色目前由其他控制來源持有',
      stale_revision: '狀態已更新，請重新整理',
      idempotency_conflict: '重複指令已拒絕',
      invalid_transition: '目前狀態不允許此操作',
    };
    if (notice)
      notice.textContent = messages[error.message] ?? `指令失敗：${error.message}`;
  }
  await syncControllerStatus(id);
  setTimeout(() => {
    if (claim) claim.disabled = false;
  }, 1500);
  setTimeout(() => {
    void refresh();
  }, 500);
}
// ---------------------------------------------------------------------------

async function enterGame(latencyTrace = null) {
  resetCompletedQuestSection();
  show($('#auth'), false);
  show($('#game'));
  applyGameEntryBootstrap(gameEntryBootstrap);
  activateDeferredGameImages({ includeWorldMap: false });
  void loadGameplayModules()
    .then(() => {
      if (accountPreferences)
        window.PetCompanionSettings?.hydrateFromApi(accountPreferences);
    })
    .catch((error) => console.error('DEFERRED_GAME_MODULE_LOAD_FAILED', error));
  void loadOfficialDamageAssets();
  chatReady = false;
  selectChatChannel(currentChatChannel);
  selectChatSendChannel(currentChatSendChannel);
  await Promise.all([
    reportWebPresence(ObservationInterest.COMBAT_PAGE),
    loadGameEntryLeanState(latencyTrace),
  ]);
  void refreshPersistentLife(gameEntryBootstrap?.character?.charId);
  clearInterval(statePoll);
  clearTimeout(eventTimer);
  closeCombatStream();
  clearTimeout(socialTimer);
  eventCursor = null;
  socialCursor = null;
  eventPollFailures = 0;
  socialPollFailures = 0;
  restartStatePolling();
  void hydrateGameEntryBackground().catch((error) => {
    console.error('GAME_ENTRY_BACKGROUND_HYDRATION_FAILED', error);
    restartCombatDelivery();
  });
  scheduleWorldMapWarmup();
}
async function act(action) {
  const latencyTrace = beginLatencyInteraction(
    action === 'start' ? 'automation_start' : 'automation_stop',
  );
  if (taskInProgress()) {
    $('#status').textContent = '任務進行中';
    $('#automationNotice').textContent =
      '目前正在執行任務，完成後會自動恢復掛機。';
    void completeLatencyInteraction(latencyTrace, {
      success: false,
      reject: true,
    });
    return;
  }
  $('#start').disabled = $('#stop').disabled = true;
  $('#status').textContent = '處理中';
  const postAutomation = () =>
    api('/api/automation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
      latencyTrace,
    });
  try {
    try {
      await postAutomation();
      await refresh({ full: true });
    } catch (error) {
      // The Persistent Agent bumps its ownership revision while settling a
      // claim, so the first CAS can legitimately be stale. Re-read the
      // authoritative revision and retry the same intent exactly once; the
      // server still owns the decision.
      if (error.message !== 'stale_revision' || !agentOwnsCharacter()) throw error;
      await syncControllerStatus(lastState?.character?.charId);
      await postAutomation();
    }
    void completeLatencyInteraction(latencyTrace, { success: true });
  } catch (error) {
    $('#status').textContent = {
      nothing_to_stop: '目前沒有進行中的掛機。',
    }[error.message] ?? error.message;
    void completeLatencyInteraction(latencyTrace, {
      success: false,
      error: true,
      reject: error.status === 409,
    });
  }
  setTimeout(refresh, 500);
}
async function resumeOnboarding(questId) {
  $('#questNotice').textContent = '正在核對任務進度與正確返回地點';
  try {
    await api('/api/onboarding/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questId }),
    });
    $('#questNotice').textContent = '已送出恢復請求，正在返回未完成的新生任務';
  } catch (error) {
    const messages = {
      not_available: '此任務目前無法執行',
      prerequisite_incomplete: '請先完成前置任務',
      already_completed: '此任務已完成',
    };
    $('#questNotice').textContent = messages[error.message] ?? error.message;
  }
  setTimeout(refresh, 300);
}
async function runEdenTask(taskId) {
  const startedAt = Date.now();
  const latencyTrace = beginLatencyInteraction('quest_action', {
    metadata: { action: 'eden_task', taskId },
  });
  const taskNames = {
    member: '加入伊甸園',
    equipment12: 'Lv.12 裝備訓練',
    equipment26: 'Lv.26 裝備訓練',
  };
  taskCommandPendingUntil = startedAt + 30000;
  pendingTaskEvents.push({
    at: startedAt,
    type: 'action',
    title: `${taskNames[taskId] ?? '伊甸園任務'}指令已送出`,
    detail: '正在接管角色並核對第一個移動目標。',
    target: '任務自動流程',
    map: lastState?.character?.map ?? '',
  });
  renderTaskActionLog(lastState?.derived);
  $('#status').textContent = '任務啟動中';
  $('#start').disabled = $('#stop').disabled = true;
  $('#automationNotice').textContent = '任務指令已送出，正在開始執行。';
  $('#edenNotice').textContent = '正在核對伊甸園原生任務狀態';
  try {
    const result = await api('/api/eden/task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId }),
      latencyTrace,
    });
    $('#edenNotice').textContent = result.ownershipTransition === 'CLAIMING_AGENT'
      ? '正在請求系統接管角色。'
      : result.executor === 'SERVER_AGENT' && result.resumed
        ? '系統已繼續目前的伊甸園任務。'
        : taskId === 'equipment12'
        ? '已開始第一套伊甸園裝備任務'
        : taskId === 'equipment26'
          ? '已開始第二套伊甸園裝備任務'
          : '已開始前往普隆德拉伊甸園傳送員';
  } catch (error) {
    taskCommandPendingUntil = 0;
    pendingTaskEvents = pendingTaskEvents.filter((event) => event.at !== startedAt);
    renderTaskActionLog(lastState?.derived);
    const messages = {
      not_available: '此伊甸園任務目前無法執行',
      prerequisite_incomplete: '請先完成前置條件',
      already_completed: '此任務已完成，無法重複領取',
      route_failed: '任務尋路失敗',
      npc_failed: 'NPC 對話失敗',
      npc_no_progress: 'NPC 對話三次後仍無進展，任務已安全停止',
      target_unresolved: '無法解析任務怪物目標',
      inventory_full: '道具欄至少需要四個空位',
      overweight: '角色負重超過任務限制',
      ownership_conflict: '角色目前由其他控制來源持有',
      stale_revision: '任務狀態已更新，請重新整理',
      reward_missing: '原生任務獎勵尚未完整取得',
      path_retry_exhausted: '尋路重試次數已用完',
      npc_missing: '找不到指定任務 NPC',
      unexpected_map: '角色目前所在地圖與任務步驟不一致',
      timeout: '任務步驟等待逾時',
      quarantined: '角色已進入安全隔離狀態',
      rollout_disabled: '系統自動任務尚未開放給測試帳號',
      rollout_not_allowlisted: '此角色尚未開放自動任務',
      rollout_schema_unavailable: '自動任務開放設定尚未就緒',
      rollout_identity_invalid: '角色識別資料無效，無法啟動自動任務',
      eden_course_a_disabled: '伊甸園 Course A 暫停開放',
      emergency_disabled: '自動任務已緊急停用，角色將安全返回待機狀態',
      command_rejected: '已有任務正在執行，這次操作已拒絕',
    };
    $('#edenNotice').textContent = messages[error.message] ?? error.message;
  } finally {
    void completeLatencyInteraction(latencyTrace, {
      visibleTarget: 'edenNotice',
    });
  }
  setTimeout(refresh, 300);
}

$('#discordLoginButton')?.addEventListener('click', () => {
  location.assign('/auth/discord');
});
$('#discordRequiredLink')?.addEventListener('click', () => {
  void beginDiscordLink().catch((error) => {
    $('#discordRequiredMessage').textContent = error.message;
  });
});
$('#discordLinkButton')?.addEventListener('click', () => {
  void beginDiscordLink().catch((error) => {
    $('#discordSettingsNotice').textContent = error.message;
  });
});
$('#discordUnlinkButton')?.addEventListener('click', async () => {
  const button = $('#discordUnlinkButton');
  button.disabled = true;
  try {
    const result = await api('/api/account/discord', { method: 'DELETE' });
    syncDiscordUi(result.discord);
    if (result.discord?.accessGate) await enter();
  } catch (error) {
    $('#discordSettingsNotice').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#loginForm').onsubmit = async (event) => {
  event.preventDefault();
  const latencyTrace = beginLatencyInteraction('login');
  const submit = $('#loginSubmit');
  submit.disabled = true;
  setAuthLoading(true, '登入中，請稍候……');
  $('#authError').textContent = '正在連線，首次登入會建立帳號';
  try {
    await api('/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: $('#username').value,
        password: $('#password').value,
      }),
      latencyTrace,
    });
    persistRememberedAccount($('#username').value);
    $('#authError').textContent = '';
    await enter(latencyTrace);
  } catch (error) {
    $('#authError').textContent = error.message;
    setAuthLoading(false);
  } finally {
    submit.disabled = false;
    void completeLatencyInteraction(latencyTrace, {
      visibleTarget: 'auth',
    });
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
  const selectTrace = beginLatencyInteraction('character_select'),
    entryTrace = beginLatencyInteraction('enter_game');
  $('#selectEnter').disabled = true;
  $('#characterSelectError').textContent = '正在進入遊戲';
  void completeLatencyInteraction(selectTrace, {
    visibleTarget: 'characterSelectError',
  });
  try {
    await enterGame(entryTrace);
    $('#characterSelectError').textContent = '';
  } catch (error) {
    $('#characterSelectError').textContent = error.message;
  } finally {
    $('#selectEnter').disabled = false;
    void completeLatencyInteraction(entryTrace, { visibleTarget: 'game' });
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
$('#rememberAccount').onchange = (event) => {
  if (!event.target.checked) persistRememberedAccount('');
};
$('#musicToggle').onchange = (event) =>
  setAudio({ musicEnabled: event.target.checked });
$('#soundToggle').onchange = (event) =>
  setAudio({ soundEnabled: event.target.checked });
$('#damageFloatToggle').onchange = (event) =>
  setAudio({ damageFloatsEnabled: event.target.checked });
$('#quickAudio').onclick = () => setAudio({ muted: !audioPrefs.muted });
document.addEventListener('pointerdown', () => unlockAudio(true));
document.addEventListener('keydown', () => unlockAudio(true));
hydrateRememberedAccount();
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
  $('#chatChannel').textContent = `檢視：${definition.label}`;
  document
    .querySelectorAll('#chatChannels [data-chat-channel]')
    .forEach((button) => {
    const selected = button.dataset.chatChannel === channel;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    });
  applyChatFilter();
}
function selectChatSendChannel(channel) {
  const definition = chatChannelDefs[channel];
  if (!definition || channel === 'all' || definition.readonly) return;
  currentChatSendChannel = channel;
  $('#chatSendChannel').value = channel;
  show($('#chatRecipientRow'), Boolean(definition.target));
  const disabled = !chatReady,
    input = $('#chatInput');
  input.disabled = disabled;
  $('#chatSend').disabled = disabled;
  $('#emotionToggle').disabled = disabled || channel !== 'public';
  $('#voiceRecord').disabled = disabled || channel !== 'public';
  input.placeholder = definition.target
    ? '輸入密語內容'
    : `輸入${definition.label}訊息`;
  $('#chatStatus').textContent =
    channel === 'public'
      ? '一般文字會送給附近玩家；錄音送給同地圖玩家，最長 30 秒。'
      : '文字由遊戲伺服器指定頻道收發。';
  input.focus();
}
function renderChatChannelSettings() {
  const panel = $('#chatChannelSettings');
  panel.replaceChildren(
    ...Object.entries(chatChannelDefs).map(([channel, definition]) => {
      const label = document.createElement('label'),
        input = document.createElement('input'),
        text = document.createElement('span');
      input.type = 'checkbox';
      input.checked = visibleChatChannels.has(channel);
      input.dataset.chatVisibility = channel;
      input.setAttribute('aria-label', `顯示${definition.label}`);
      text.textContent = definition.label.replace('頻道', '');
      label.append(input, text);
      return label;
    }),
  );
  document
    .querySelectorAll('#chatChannels [data-chat-channel]')
    .forEach((button) => {
      button.hidden = !visibleChatChannels.has(button.dataset.chatChannel);
    });
  applyChatFilter();
}
renderChatChannelSettings();
if (!visibleChatChannels.has(currentChatChannel))
  currentChatChannel = [...visibleChatChannels][0];
$('#chatFilterToggle').onclick = () => {
  const panel = $('#chatChannelSettings'),
    opening = panel.classList.contains('hidden');
  show(panel, opening);
  $('#chatFilterToggle').setAttribute('aria-expanded', String(opening));
};
$('#chatChannelSettings').onchange = (event) => {
  const input = event.target.closest('[data-chat-visibility]');
  if (!input) return;
  const channel = input.dataset.chatVisibility;
  if (input.checked) visibleChatChannels.add(channel);
  else if (visibleChatChannels.size === 1) {
    input.checked = true;
    $('#chatStatus').textContent = '至少保留一個顯示分頁';
    return;
  } else visibleChatChannels.delete(channel);
  localStorage.setItem(
    'ro-chat-visible-channels',
    JSON.stringify([...visibleChatChannels]),
  );
  renderChatChannelSettings();
  if (!visibleChatChannels.has(currentChatChannel))
    selectChatChannel([...visibleChatChannels][0]);
};
$('#chatChannels').onclick = (event) => {
  const button = event.target.closest('[data-chat-channel]');
  if (button) selectChatChannel(button.dataset.chatChannel);
};
$('#chatSendChannel').onchange = (event) =>
  selectChatSendChannel(event.target.value);
$('#chatForm').onsubmit = async (event) => {
  event.preventDefault();
  if (!chatReady) {
    $('#chatStatus').textContent = '正在同步對話紀錄';
    return;
  }
  const input = $('#chatInput'),
    message = input.value.trim(),
    definition = chatChannelDefs[currentChatSendChannel],
    channel = currentChatSendChannel,
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
      selectChatSendChannel(currentChatSendChannel);
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
  closeCombatStream();
  await reportWebPresence(ObservationInterest.NO_WEB);
  await api('/api/account', { method: 'DELETE' });
  location.reload();
};
document.querySelectorAll('[data-tab]').forEach((button) =>
  button.addEventListener('click', async () => {
    const latencyTrace =
      button.dataset.tab === 'quests'
        ? beginLatencyInteraction('quest_page_open')
        : button.dataset.tab === 'inventory'
          ? beginLatencyInteraction('inventory_open')
          : null;
    const previousInterest = currentWebInterest();
    playCombatSound('uiOriginalButton', 0, '', 0, 0.38);
    document
      .querySelectorAll('[data-tab],.panel')
      .forEach((element) => element.classList.remove('active'));
    button.classList.add('active');
    $(`#${button.dataset.tab}`).classList.add('active');
    const nextInterest = currentWebInterest();
    if (
      nextInterest === ObservationInterest.COMBAT_PAGE &&
      previousInterest !== ObservationInterest.COMBAT_PAGE
    ) {
      eventCursor = null;
      combatStreamLastEventId = '';
      combatStreamSeenIds.clear();
    }
    void reportWebPresence();
    if (
      nextInterest === ObservationInterest.COMBAT_PAGE &&
      previousInterest !== ObservationInterest.COMBAT_PAGE &&
      combatStreamAvailable()
    )
      void recoverCombatStream('page_interest');
    else restartCombatDelivery();
    restartStatePolling();
    if (
      [
        ObservationInterest.QUEST_PAGE,
        ObservationInterest.INVENTORY_PAGE,
      ].includes(nextInterest)
    ) {
      try {
        await refresh({ full: true, latencyTrace });
      } catch (error) {
        if (latencyTrace)
          void completeLatencyInteraction(latencyTrace, {
            visibleTarget: button.dataset.tab,
            success: false,
            error: true,
            reject: error.status === 409,
          });
        throw error;
      }
    }
    if (latencyTrace)
      void completeLatencyInteraction(latencyTrace, {
        visibleTarget: button.dataset.tab,
        success: true,
      });
    if (button.dataset.tab === 'mapInfo')
      void loadMapInfo().catch((error) => {
        $('#mapInfoSource').textContent = error.message;
      });
    if (button.dataset.tab === 'skills')
      void loadSkillTrees().catch((error) => {
        $('#skillNotice').textContent = error.message;
      });
    if (button.dataset.tab === 'rankings' && !rankingState.loaded) {
      const currentClassId = Number(
        lastState?.derived?.jobId ?? lastState?.character?.classId ?? 0,
      );
      if (rankingJobIds.includes(currentClassId))
        $('#rankingJob').value = String(currentClassId);
      void loadRanking();
    }
  }),
);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) webLatencyTrace.hiddenAt = performance.now();
  void reportWebActivityPresence();
  const resumeTrace = !document.hidden
    ? beginLatencyInteraction('hidden_foreground_resume', {
        startedAt: webLatencyTrace.hiddenAt ?? performance.now(),
      })
    : null;
  await reportWebPresence(currentWebInterest(), document.hidden);
  if (
    !document.hidden &&
    currentWebInterest() === ObservationInterest.COMBAT_PAGE &&
    combatStreamAvailable()
  ) {
    await recoverCombatStream('foreground_resume', resumeTrace);
    restartStatePolling();
  } else {
    restartCombatDelivery();
    restartStatePolling({ immediate: !document.hidden });
    if (!document.hidden)
      await refresh({ full: false, latencyTrace: resumeTrace });
  }
  if (resumeTrace)
    void completeLatencyInteraction(resumeTrace, {
      visibleTarget: 'fresh-state',
      hiddenAt: webLatencyTrace.hiddenAt,
    });
});
window.addEventListener('pagehide', () => {
  void reportWebPresence(ObservationInterest.NO_WEB, true);
  stopWebActivityHeartbeat();
  closeCombatStream();
  clearTimeout(eventTimer);
  clearTimeout(socialTimer);
  clearInterval(statePoll);
});
window.addEventListener('pageshow', () => {
  void reportWebPresence();
  void reportWebActivityPresence();
  if (
    currentWebInterest() === ObservationInterest.COMBAT_PAGE &&
    combatStreamAvailable()
  ) {
    void recoverCombatStream('page_show');
    restartStatePolling();
  } else {
    restartCombatDelivery();
    restartStatePolling({ immediate: true });
  }
  void pollSocial();
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled || button.matches('[data-tab]')) return;
  if (button.matches('#selectLogout, #cardMergeCancel')) {
    playCombatSound('uiOriginalCancel', 0, '', 0, 0.38);
    return;
  }
  if (button.matches('#loginForm button, #characterSelectForm button, #logout')) {
    playCombatSound('uiOriginalButton', 0, '', 0, 0.38);
    return;
  }
  if (button.matches('#cardArtPreviewAction') && button.dataset.itemAction !== 'card') return;
  if (button.matches('.card-merge-candidate')) return;
  if (button.matches('[data-inventory]')) return;
  playCombatSound('uiOriginalButton', 0, '', 0, 0.38);
}, true);
document.querySelectorAll('[data-inventory]').forEach((button) =>
  button.addEventListener('click', () => {
    playCombatSound('uiOriginalButton', 0, '', 0, 0.38);
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
  statHoldStartedAt = 0,
  statHoldToken = 0,
  statHoldPointerId = null,
  statHoldButton = null,
  statQueueActive = false,
  statAuthoritativeState = null;
const statCommandQueue = [];
const statCommandQueueLimit = 20;
const statHoldTiming = Object.freeze({
  initialDelayMs: 380,
  initialIntervalMs: 220,
  minimumIntervalMs: 65,
  accelerationPerMs: 0.04,
});
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
    const events = await api(eventApiUrl({ cursor: null }));
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
function currentStatDomainState() {
  const source = lastState?.derived ?? lastState?.character ?? {};
  const advertisedRevision =
    lastState?.derived?.domainRevisions?.stat ??
    lastState?.domainRevisions?.stat;
  return {
    str: Number(source.str ?? 0),
    agi: Number(source.agi ?? 0),
    vit: Number(source.vit ?? 0),
    int: Number(source.int ?? 0),
    dex: Number(source.dex ?? 0),
    luk: Number(source.luk ?? 0),
    remainingStatPoints: Number(source.statusPoint ?? 0),
    statRevision: Number(advertisedRevision ?? 0),
    hasStatRevision: advertisedRevision !== undefined,
  };
}
function normalizeStatDomainState(value, fallback = currentStatDomainState()) {
  if (!value) return fallback;
  return {
    str: Number(value.str ?? fallback.str),
    agi: Number(value.agi ?? fallback.agi),
    vit: Number(value.vit ?? fallback.vit),
    int: Number(value.int ?? fallback.int),
    dex: Number(value.dex ?? fallback.dex),
    luk: Number(value.luk ?? fallback.luk),
    remainingStatPoints: Number(
      value.remainingStatPoints ?? fallback.remainingStatPoints,
    ),
    statRevision: Number(value.statRevision ?? fallback.statRevision),
    hasStatRevision: value.statRevision !== undefined || fallback.hasStatRevision,
  };
}
function renderStatQueueProjection() {
  if (!statAuthoritativeState) statAuthoritativeState = currentStatDomainState();
  const projected = { ...statAuthoritativeState },
    retained = [];
  for (const intent of statCommandQueue) {
    const cost = statCost(projected[intent.stat]);
    if (projected[intent.stat] >= 130 || projected.remainingStatPoints < cost) {
      intent.resolve({ accepted: false, reason: 'insufficient_points' });
      continue;
    }
    intent.cost = cost;
    projected[intent.stat] += 1;
    projected.remainingStatPoints -= cost;
    retained.push(intent);
  }
  statCommandQueue.splice(0, statCommandQueue.length, ...retained);
  if (lastState?.derived) {
    lastState = {
      ...lastState,
      domainRevisions: {
        ...(lastState.domainRevisions ?? {}),
        stat: statAuthoritativeState.statRevision,
      },
      derived: {
        ...lastState.derived,
        ...Object.fromEntries(
          ['str', 'agi', 'vit', 'int', 'dex', 'luk'].map((key) => [
            key,
            projected[key],
          ]),
        ),
        statusPoint: projected.remainingStatPoints,
        domainRevisions: {
          ...(lastState.derived.domainRevisions ?? {}),
          stat: statAuthoritativeState.statRevision,
        },
      },
    };
    setCharacter(lastState.character, lastState.derived);
  }
  return projected;
}
async function sendStatIntent(intent, latencyTrace = null) {
  const payload = {
    commandId: intent.commandId,
    characterId: Number(
      lastState?.character?.charId ?? lastState?.character?.characterId ?? 0,
    ),
    stat: intent.stat,
    ...(statAuthoritativeState.hasStatRevision
      ? { expectedRevision: statAuthoritativeState.statRevision }
      : {}),
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await api('/api/status-point', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        latencyTrace,
      });
    } catch (error) {
      if (error.status || attempt > 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  return null;
}
async function processStatCommandQueue() {
  if (statQueueActive) return;
  statQueueActive = true;
  try {
    while (statCommandQueue.length) {
      const intent = statCommandQueue[0];
      try {
        const result = await sendStatIntent(intent, intent.experience ?? null);
        markExperienceResponse(intent.experience);
        if (result?.character) {
          statAuthoritativeState = normalizeStatDomainState({
            ...result.character,
            remainingStatPoints: result.character.statusPoint,
            statRevision: statAuthoritativeState.statRevision + 1,
          });
          lastState = { ...lastState, character: result.character };
          statCommandQueue.shift();
          intent.resolve({ accepted: true, legacy: true });
          $('#statNotice').textContent = '伺服器已確認能力配點';
        } else if (
          result?.accepted &&
          Number.isSafeInteger(Number(result.statRevision))
        ) {
          statAuthoritativeState = normalizeStatDomainState(result.statState, {
            ...statAuthoritativeState,
            [intent.stat]: Number(result.newValue),
            remainingStatPoints: Number(result.remainingStatPoints),
            statRevision: Number(result.statRevision),
          });
          statCommandQueue.shift();
          intent.resolve(result);
          $('#statNotice').textContent = statCommandQueue.length
            ? `伺服器已確認，尚有 ${statCommandQueue.length} 筆配點`
            : '伺服器已確認能力配點';
        } else if (result?.accepted) {
          const before = statAuthoritativeState[intent.stat],
            confirmed = await waitForLive(
              (live) => Number(live[intent.stat]) > before,
            );
          statCommandQueue.shift();
          if (!confirmed) throw new Error('伺服器尚未確認能力配點');
          statAuthoritativeState = normalizeStatDomainState({
            ...confirmed,
            remainingStatPoints: confirmed.statusPoint,
            statRevision:
              confirmed.domainRevisions?.stat ??
              statAuthoritativeState.statRevision + 1,
          });
          intent.resolve({ accepted: true, legacy: true });
        } else {
          throw new Error('能力配點結果格式不符');
        }
      } catch (error) {
        if (
          error.status === 409 &&
          !error.payload?.reason &&
          error.message === '角色狀態已更新，請重試操作' &&
          !intent.legacyRevisionRetry
        ) {
          intent.legacyRevisionRetry = true;
          statAuthoritativeState = {
            ...statAuthoritativeState,
            hasStatRevision: false,
          };
          continue;
        }
        statCommandQueue.shift();
        statAuthoritativeState = normalizeStatDomainState(
          error.payload?.statState,
          statAuthoritativeState,
        );
        intent.resolve({
          accepted: false,
          reason: error.payload?.reason ?? 'request_failed',
        });
        $('#statNotice').textContent = error.message;
        if (
          ['insufficient_points', 'stat_cap_reached'].includes(
            error.payload?.reason,
          )
        )
          stopStatHold();
      }
      markExperienceAuthoritative(intent.experience);
      renderStatQueueProjection();
    }
  } finally {
    statQueueActive = false;
    if (statCommandQueue.length) void processStatCommandQueue();
    else statAuthoritativeState = null;
  }
}
function addStatusPoint(stat) {
  if (!['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(stat))
    return Promise.resolve({ accepted: false, reason: 'invalid_stat' });
  if (statCommandQueue.length >= statCommandQueueLimit) {
    $('#statNotice').textContent = '配點佇列已滿，請等待伺服器確認';
    return Promise.resolve({ accepted: false, reason: 'queue_full' });
  }
  if (!statAuthoritativeState) statAuthoritativeState = currentStatDomainState();
  const statExperience = beginExperienceTrace('stat_allocate');
  markExperienceRequest(statExperience);
  let resolveIntent;
  const completion = new Promise((resolve) => {
      resolveIntent = resolve;
    }),
    intent = {
      commandId: crypto.randomUUID(),
      stat,
      resolve: resolveIntent,
      cost: 0,
      experience: statExperience,
    };
  statCommandQueue.push(intent);
  void completion.then((outcome) =>
    settleExperienceTrace(statExperience, {
      success: outcome?.accepted === true,
      errorCode: outcome?.accepted === true
        ? null
        : String(outcome?.reason ?? 'stat_rejected').toUpperCase().slice(0, 64),
    }),
  );
  const projected = renderStatQueueProjection();
  if (!statCommandQueue.includes(intent)) {
    $('#statNotice').textContent = '能力點數不足';
    stopStatHold();
    return completion;
  }
  $('#statNotice').textContent = `能力配點確認中（${statCommandQueue.length}）`;
  void processStatCommandQueue();
  return completion;
}
function stopStatHold() {
  statHoldToken += 1;
  clearTimeout(statHoldDelay);
  clearTimeout(statHoldTimer);
  statHoldDelay = statHoldTimer = null;
  if (statHoldButton) {
    statHoldButton.dataset.statHold = 'idle';
    if (
      statHoldPointerId !== null &&
      statHoldButton.hasPointerCapture?.(statHoldPointerId)
    )
      statHoldButton.releasePointerCapture(statHoldPointerId);
  }
  statHoldPointerId = null;
  statHoldButton = null;
}
function statHoldInterval(elapsedMs) {
  return Math.max(
    statHoldTiming.minimumIntervalMs,
    statHoldTiming.initialIntervalMs - elapsedMs * statHoldTiming.accelerationPerMs,
  );
}
async function continueStatHold(stat, token) {
  if (token !== statHoldToken) return;
  void addStatusPoint(stat);
  if (token !== statHoldToken) return;
  statHoldTimer = setTimeout(
    () => continueStatHold(stat, token),
    statHoldInterval(performance.now() - statHoldStartedAt),
  );
}
$('#stats').addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-stat]');
  if (!button || button.disabled || (event.button !== undefined && event.button !== 0))
    return;
  event.preventDefault();
  stopStatHold();
  const stat = button.dataset.stat;
  const token = statHoldToken;
  statHoldPointerId = event.pointerId;
  statHoldButton = button;
  button.dataset.statHold = 'active';
  try {
    button.setPointerCapture?.(event.pointerId);
  } catch {}
  addStatusPoint(stat);
  statHoldDelay = setTimeout(() => {
    statHoldStartedAt = performance.now();
    continueStatHold(stat, token);
  }, statHoldTiming.initialDelayMs);
});
for (const type of ['pointerup', 'pointercancel'])
  window.addEventListener(type, (event) => {
    if (statHoldPointerId === null || event.pointerId === statHoldPointerId)
      stopStatHold();
  });
window.addEventListener('blur', stopStatHold);
$('#stats').addEventListener('contextmenu', (event) => {
  if (event.target.closest('[data-stat]')) event.preventDefault();
});
let characterResetInfo = null;
let characterResetFetchedAt = 0;
let characterResetCharId = 0;
let characterResetPending = null;
let characterResetPendingCommandId = null;
let characterResetBusy = false;
let characterResetDialogResolve = null;
let characterResetDialogReturnFocus = null;
function closeCharacterResetDialog(approved = false) {
  const resolve = characterResetDialogResolve;
  if (!resolve) return;
  characterResetDialogResolve = null;
  show($('#characterResetConfirm'), false);
  if (characterResetDialogReturnFocus?.isConnected)
    characterResetDialogReturnFocus.focus({ preventScroll: true });
  characterResetDialogReturnFocus = null;
  resolve(approved);
}
function confirmCharacterReset(type) {
  if (characterResetDialogResolve) return Promise.resolve(false);
  $('#resetConfirmQuestion').textContent = type === 'stat'
    ? '確定要重置能力值嗎？' : '確定要重置技能點嗎？';
  $('#resetConfirmCooldown').textContent = type === 'stat'
    ? '成功後，能力值重置將進入 8 小時冷卻。'
    : '成功後，技能點重置將進入 8 小時冷卻。';
  characterResetDialogReturnFocus = document.activeElement;
  show($('#characterResetConfirm'));
  const result = new Promise((resolve) => { characterResetDialogResolve = resolve; });
  $('#resetConfirmCancel').focus({ preventScroll: true });
  return result;
}
$('#resetConfirmOk').addEventListener('click', () => closeCharacterResetDialog(true));
$('#resetConfirmCancel').addEventListener('click', () => closeCharacterResetDialog(false));
$('#characterResetConfirm').addEventListener('click', (event) => {
  if (event.target === $('#characterResetConfirm')) closeCharacterResetDialog(false);
});
$('#characterResetConfirm').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCharacterResetDialog(false);
  } else if (event.key === 'Tab') {
    const next = event.shiftKey ? $('#resetConfirmOk') : $('#resetConfirmCancel');
    if (document.activeElement === next) {
      event.preventDefault();
      (event.shiftKey ? $('#resetConfirmCancel') : $('#resetConfirmOk')).focus();
    }
  }
});
function resetRemainingSeconds(type) {
  if (!characterResetInfo) return null;
  const initial = Number(characterResetInfo[type]?.remainingSeconds);
  if (!Number.isFinite(initial)) return null;
  return Math.max(0, initial - Math.floor((performance.now() - characterResetFetchedAt) / 1000));
}
function formatResetRemaining(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, '0')).join(':');
}
function renderCharacterResetState() {
  for (const [type, buttonId, stateId] of [
    ['stat', 'resetStats', 'statResetState'],
    ['skill', 'resetSkills', 'skillResetState'],
  ]) {
    const remaining = resetRemainingSeconds(type);
    const pending = characterResetPending === type;
    $(`#${stateId}`).textContent = pending
      ? '伺服器確認中'
      : remaining === null ? '狀態讀取中'
        : remaining > 0 ? `冷卻中：${formatResetRemaining(remaining)}`
          : '可立即重置';
    $(`#${buttonId}`).disabled = characterResetBusy || pending || remaining === null || remaining > 0;
  }
}
async function refreshCharacterResetInfo() {
  if (!authenticated || $('#game').classList.contains('hidden')) return;
  const charId = Number(lastState?.character?.charId ?? 0);
  if (!Number.isSafeInteger(charId) || charId <= 0) return;
  const info = await api('/api/status-reset-info');
  if (charId !== Number(lastState?.character?.charId ?? 0)) return;
  characterResetInfo = info;
  characterResetFetchedAt = performance.now();
  characterResetCharId = charId;
  if (characterResetPending && Number(info[characterResetPending]?.remainingSeconds) > 0)
    characterResetPending = characterResetPendingCommandId = null;
  renderCharacterResetState();
}
async function refreshPendingResetCommand() {
  if (!characterResetPendingCommandId) return;
  const result = await api(`/api/character-reset-command?commandId=${encodeURIComponent(characterResetPendingCommandId)}`);
  if (result.command?.status === 'REJECTED' || result.command?.status === 'CANCELLED') {
    const notice = characterResetPending === 'stat' ? $('#statNotice') : $('#skillNotice');
    notice.textContent = `重置未完成：${result.command.reasonCode ?? '伺服器拒絕'}`;
    characterResetPending = characterResetPendingCommandId = null;
  } else if (result.command?.status === 'CONFIRMED') {
    characterResetPendingCommandId = null;
    void refresh();
  }
  renderCharacterResetState();
}
async function submitCharacterReset(type) {
  if (characterResetBusy || characterResetPending || characterResetDialogResolve ||
      resetRemainingSeconds(type) !== 0) return;
  const stat = type === 'stat';
  const charId = characterResetCharId;
  if (!await confirmCharacterReset(type) ||
      charId !== characterResetCharId || resetRemainingSeconds(type) !== 0) return;
  characterResetBusy = true;
  renderCharacterResetState();
  const notice = stat ? $('#statNotice') : $('#skillNotice');
  notice.textContent = stat ? '正在重置能力值' : '正在重置技能點';
  try {
    const result = await api('/api/character-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, commandId: crypto.randomUUID() }),
    });
    if (result.command?.status === 'REJECTED' || result.command?.status === 'CANCELLED') {
      notice.textContent = `重置未完成：${result.command.reasonCode ?? '伺服器拒絕'}`;
    } else {
      characterResetPending = type;
      characterResetPendingCommandId = result.command?.status === 'CONFIRMED'
        ? null : result.command?.commandId ?? null;
      notice.textContent = result.command?.status === 'CONFIRMED'
        ? '伺服器已確認重置，正在同步冷卻。' : '伺服器仍在處理重置。';
    }
    await refreshCharacterResetInfo();
    if (result.command?.status === 'CONFIRMED') void refresh();
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    characterResetBusy = false;
    renderCharacterResetState();
  }
}
$('#resetStats').onclick = () => void submitCharacterReset('stat');
$('#resetSkills').onclick = () => void submitCharacterReset('skill');
setInterval(() => {
  const charId = Number(lastState?.character?.charId ?? 0);
  if (charId !== characterResetCharId) {
    characterResetInfo = null;
    characterResetCharId = charId;
    characterResetPending = null;
    characterResetPendingCommandId = null;
    closeCharacterResetDialog(false);
    renderCharacterResetState();
    void refreshCharacterResetInfo().catch(() => {});
  } else if (authenticated && !$('#game').classList.contains('hidden') &&
             (characterResetPending || performance.now() - characterResetFetchedAt > 15000)) {
    void refreshCharacterResetInfo().catch(() => {});
    if (characterResetPendingCommandId)
      void refreshPendingResetCommand().catch(() => {});
  }
  renderCharacterResetState();
}, 1000);
$('#skillList').onclick = async (event) => {
  const button = event.target.closest('[data-skill-id]');
  if (!button || button.disabled) return;
  const skillId = Number(button.dataset.skillId),
    rollbackState = cloneDashboardState(lastState),
    before = Number(
      lastState?.derived?.skills?.find((skill) => Number(skill.id) === skillId)
        ?.level ??
        (skillId === 1 ? lastState?.derived?.basicSkillLevel : 0) ??
        0,
    );
  if (lastState?.derived) {
    const skills = (lastState.derived.skills ?? []).map((skill) =>
      Number(skill.id) === skillId
        ? { ...skill, level: before + 1, lv: before + 1 }
        : skill,
    );
    lastState = {
      ...lastState,
      derived: {
        ...lastState.derived,
        skills,
        skillPoint: Math.max(0, Number(lastState.derived.skillPoint ?? 0) - 1),
        ...(skillId === 1 ? { basicSkillLevel: before + 1 } : {}),
      },
    };
    setCharacter(lastState.character, lastState.derived);
  }
  button.disabled = true;
  $('#skillNotice').textContent = '技能配點確認中';
  try {
    await api('/api/skill-point', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skillId, ...characterCommandMeta('inventory') }),
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
      const merged = mergeProjectedDerived(
        lastState.derived,
        confirmed,
        'skill-confirmation',
      );
      lastState = { ...lastState, derived: merged };
      setCharacter(lastState.character, merged);
      $('#skillNotice').textContent = '伺服器已確認技能配點';
    } else {
      $('#skillNotice').textContent = '伺服器尚未確認技能配點';
      void refresh({ full: true });
    }
  } catch (error) {
    lastState = rollbackState;
    if (lastState?.character)
      setCharacter(lastState.character, lastState.derived);
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
      beginExperienceTrace('npc_dialog_action'),
    );
  else if (action)
    void jobChangeAction(
      { action: action.dataset.npcAction },
      '正在更新 NPC 對話',
      beginExperienceTrace('npc_dialog_action'),
    );
};
if ($('#supplyForm')) $('#supplyForm').onsubmit = async (event) => {
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
$('#canaryClaim').onclick = () => void actCanary('claim_agent');
$('#openWorldMap').onclick = () =>
  void openWorldMap().catch((error) => {
    $('#grindTargetSummary').textContent = error.message;
  });
$('#closeWorldMap').onclick = closeWorldMap;
$('#persistentLifeTimelineToggle')?.addEventListener('click', () => {
  persistentLifeState.timelineOpen = !persistentLifeState.timelineOpen;
  renderPersistentLife();
});
$('#persistentLifeDismiss')?.addEventListener('click', () => void dismissPersistentLife());
$('#worldMapOverlay').addEventListener('click', (event) => {
  if (event.target === $('#worldMapOverlay')) closeWorldMap();
});
addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!$('#worldMapConfirm').classList.contains('hidden') ||
      !$('#worldMapOverlay').classList.contains('hidden')) closeWorldMap();
});
addEventListener('pagehide', () => worldMapTravelPresentation?.dispose());
setInterval(() => {
  if (!$('#game').classList.contains('hidden'))
    $('#duration').textContent = duration(sessionStartedAt, sessionEndedAt);
  if (lastEventAt && performance.now() - lastEventAt > 2000 && currentRunning)
    $('#logLatency').textContent = '等待戰鬥事件';
}, 1000);
setInterval(() => {
  if (!$('#game').classList.contains('hidden') && persistentLifeState.charId)
    void refreshPersistentLife(persistentLifeState.charId);
}, 15000);
setupFoldableWindows();
setupTaskSections();
setupCharacterShowcase();
setupRankings();
setupCardArtPreview();
setupCardMergeDialog();
const initialEntryTrace = beginLatencyInteraction('initial_entry', {
  startedAt: 0,
});
enter(initialEntryTrace).then(
  () =>
    completeLatencyInteraction(initialEntryTrace, {
      visibleTarget: authenticated ? 'character-select' : 'login',
    }),
).catch((error) => {
  setAuthLoading(false);
  $('#loginServerStatus').textContent = '無法連線';
  $('#authError').textContent = error.message;
  $('#loginSubmit').disabled = false;
});
function setItemActionNotice(message) {
  $('#itemNotice').textContent = message;
  $('#equipmentItemNotice').textContent = message;
}
async function confirmItemAction(action, trackedIdentity, before, experienceTrace = null) {
  const deadline = Date.now() + 7000;
  const beforePosition = authoritativePositionOf(lastState?.derived);
  const nonConsumableTravelItem =
    action === 'use' && nonConsumableTravelItemIds.has(Number(before?.itemId));
  let confirmed = false,
    after = null,
    latestLive = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const events = await api(eventApiUrl({ cursor: null }));
    latestLive = events.live ?? latestLive;
    after = events.live?.inventory?.find((entry) =>
      inventoryMatchesIdentity(entry, trackedIdentity));
    const afterPosition = authoritativePositionOf(events.live);
    confirmed =
      action === 'card'
        ? !after || Number(after.amount) < Number(before?.amount ?? 0)
        : action === 'equip'
          ? after?.equipped === true
          : action === 'unequip'
            ? after?.equipped === false
          : nonConsumableTravelItem
            ? Boolean(after) &&
              Number(after.amount) === Number(before?.amount) &&
              authoritativePositionChanged(beforePosition, afterPosition)
            : !after || Number(after.amount) < Number(before?.amount ?? 0);
    if (confirmed) break;
  }
  if (confirmed) {
    markExperienceAuthoritative(experienceTrace);
    if (action === 'use' && Number(before?.itemId) === 601)
      playCombatSound('flyWing', 0, '', 0, 0.72);
    if (after) {
      inventoryItems = inventoryItems.map((item) =>
        inventoryMatchesIdentity(item, trackedIdentity)
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
        !inventoryMatchesIdentity(item, trackedIdentity));
    }
    const equipment = inventoryItems
      .filter((item) => item.category === 'equipment' && item.equipped)
      .map(itemEquipmentEntry);
    const domainRevisions = {
      ...(lastState?.domainRevisions ?? {}),
      ...(latestLive?.domainRevisions ?? {}),
    };
    lastState = {
      ...lastState,
      inventory: inventoryItems,
      equipment,
      domainRevisions,
      derived: lastState?.derived
        ? {
            ...lastState.derived,
            domainRevisions: {
              ...(lastState.derived.domainRevisions ?? {}),
              ...(latestLive?.domainRevisions ?? {}),
            },
          }
        : lastState?.derived,
    };
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
    selectedCardInventoryIndex = null;
  }
  void refresh();
  return confirmed;
}
document.addEventListener('dblclick', async (event) => {
  const item = event.target.closest('.inventory-item, .equip-slot.equipped');
  if (!item) return;
  clearTimeout(inventoryItemClickTimer);
  closeCardArtPreview({ restoreFocus: false });
  const blockedReason = item.dataset.blockedReason || '';
  if (blockedReason) {
    setItemActionNotice(blockedReason);
    return;
  }
  const identity = nodeInventoryIdentity(item);
  if (!hasInventoryIdentity(identity)) {
    setItemActionNotice('遊戲伺服器尚未同步此道具');
    return;
  }
  item.classList.add('pending');
  setItemActionNotice('正在送出操作');
  let action = item.dataset.action;
  if (action === 'card') {
    item.classList.remove('pending');
    openCardMergeDialog(item);
    setItemActionNotice('請選擇要插入卡片的裝備');
    return;
  }
  const cardIdentity = selectedCardIdentity();
  if (action !== 'card'
    && hasInventoryIdentity(cardIdentity)
    && item.dataset.category === 'equipment')
    action = 'card';
  if (!['use', 'equip', 'unequip'].includes(action)) {
    item.classList.remove('pending');
    setItemActionNotice('此道具目前沒有可用操作');
    return;
  }
  const trackedIdentity = action === 'card' ? cardIdentity : identity;
  const pendingKey = inventoryIdentityKey(trackedIdentity);
  if (pendingItemCommands.has(pendingKey)) {
    setItemActionNotice('此道具操作仍在伺服器確認中');
    item.classList.remove('pending');
    return;
  }
  const experience = ['equip', 'unequip', 'use'].includes(action)
    ? beginExperienceTrace(
        action === 'equip'
          ? 'equip_item'
          : action === 'unequip'
            ? 'unequip_item'
            : 'use_item',
      )
    : null;
  markExperienceRequest(experience);
  const before = inventoryItems.find((entry) =>
    inventoryMatchesIdentity(entry, trackedIdentity)),
    rollbackInventory = inventoryItems.map((entry) => ({ ...entry })),
    rollbackEquipment = lastState?.equipment?.map((entry) => ({ ...entry }));
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
  pendingItemCommands.add(pendingKey);
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await api('/api/item-action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          latencyTrace: experience,
          body: JSON.stringify({
            action,
            binId: trackedIdentity.binId,
            itemKey: trackedIdentity.itemKey,
            inventoryIndex: trackedIdentity.inventoryIndex ?? undefined,
            inventoryGeneration: Number.isInteger(before?.inventoryGeneration)
              ? before.inventoryGeneration
              : undefined,
            targetBinId: action === 'card' ? identity.binId : undefined,
            targetItemKey: action === 'card' ? identity.itemKey : undefined,
            targetInventoryIndex: action === 'card'
              ? (identity.inventoryIndex ?? undefined)
              : undefined,
            ...characterCommandMeta('inventory'),
          }),
        });
        break;
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
        await refresh({ full: true });
      }
    }
    setItemActionNotice('指令已送出，伺服器確認中');
    item.classList.remove('pending');
    const confirmed = await confirmItemAction(action, trackedIdentity, before, experience);
    if (!confirmed) {
      inventoryItems = rollbackInventory;
      lastState = {
        ...lastState,
        inventory: rollbackInventory,
        equipment: rollbackEquipment ?? [],
      };
      renderInventory();
      setEquipment(lastState.character, rollbackEquipment ?? []);
    }
    await settleExperienceTrace(experience, {
      success: confirmed,
      errorCode: confirmed ? null : 'VISIBLE_NOT_CONFIRMED',
    });
  } catch (error) {
    inventoryItems = rollbackInventory;
    lastState = {
      ...lastState,
      inventory: rollbackInventory,
      equipment: rollbackEquipment ?? [],
    };
    renderInventory();
    setEquipment(lastState.character, rollbackEquipment ?? []);
    setItemActionNotice(error.message);
    await settleExperienceTrace(experience, { success: false, errorCode: 'ACTION_FAILED' });
  } finally {
    pendingItemCommands.delete(pendingKey);
    item.classList.remove('pending');
  }
});
