// Stable internal action ids stay machine-readable; this module owns the
// management-facing Traditional Chinese labels and traffic class.
const LABELS = Object.freeze({
  stat_allocate: '能力配點',
  equip_item: '穿戴裝備',
  unequip_item: '脫下裝備',
  use_item: '使用道具',
  npc_dialog_action: 'NPC 對話操作',
  minimap_freshness: '更新即時小地圖',
  skill_allocate: '技能操作',
  equipment_change: '裝備變更',
  item_use: '使用道具',
  automation_start: '開始掛機',
  automation_stop: '停止掛機',
  mode_switch: '模式切換',
  target_switch: '目標切換',
  farm_map_switch: '更換掛機地圖',
  minimap_marker_update: '小地圖角色標記更新',
  minimap_open: '開啟小地圖',
  minimap_close: '關閉小地圖',
  map_transition_visible: '地圖切換可見',
  quest_open: '開啟任務',
  dialog_visible: '任務對話可見',
  choice_submit: '提交任務選項',
  journal_update: '更新任務日誌',
  inventory_open: '載入背包',
  storage_open: '開啟倉庫',
  shop_open: '開啟商店',
  login: '登入',
  character_select: '選擇角色',
  enter_game: '進入角色',
  combat_state_visible: '載入戰鬥紀錄',
  target_change_visible: '戰鬥目標變更',
});

const BACKGROUND_ACTIONS = new Set([
  'minimap_freshness',
  'minimap_marker_update',
  'journal_update',
  'combat_state_visible',
  'target_change_visible',
]);

export function actionLabel(actionId) {
  return LABELS[actionId] ?? `未知操作（${String(actionId ?? 'unknown')}）`;
}

export function actionTrafficClass(actionId) {
  return BACKGROUND_ACTIONS.has(actionId) ? 'BACKGROUND' : 'FOREGROUND';
}

export function hasActionLabel(actionId) {
  return Object.prototype.hasOwnProperty.call(LABELS, actionId);
}

export const actionLabels = LABELS;
