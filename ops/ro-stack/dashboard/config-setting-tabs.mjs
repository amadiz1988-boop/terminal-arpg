import { CONFIG_SECTIONS } from './config-capabilities.mjs';

// Player-facing setting tabs. Presentation only: every canonical section from
// CONFIG_SECTIONS belongs to exactly one tab, and fields keep their section,
// capability and write contract.
export const CONFIG_SETTING_TABS = Object.freeze([
  { id: 'farm', label: '掛機', sections: ['掛機'] },
  { id: 'combat', label: '戰鬥', sections: ['戰鬥'] },
  { id: 'skills', label: '技能', sections: ['技能'] },
  { id: 'hpsp', label: 'HP/SP', sections: ['HP / SP'] },
  { id: 'supply', label: '補給', sections: ['補給'] },
  { id: 'travel', label: '移動／翅膀', sections: ['蒼蠅翅膀', '蝴蝶翅膀 / 回城補給'] },
  { id: 'recovery', label: '恢復', sections: ['恢復'] },
  { id: 'advanced', label: '進階', sections: ['進階功能 / 尚未支援'] },
].map((tab) => Object.freeze({ ...tab, sections: Object.freeze(tab.sections) })));

export function settingTabForSection(section) {
  return CONFIG_SETTING_TABS.find((tab) => tab.sections.includes(section))?.id ?? null;
}

export const CONFIG_SETTING_SECTIONS_COVERED = CONFIG_SECTIONS.every(
  (section) => CONFIG_SETTING_TABS.filter((tab) => tab.sections.includes(section)).length === 1);