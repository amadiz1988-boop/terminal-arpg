export const ZH_TW_REFERENCE = Object.freeze({
  map: 'https://ragnaplace.com/zh-t/twro/map/prt_fild08',
  poring: 'https://ragnaplace.com/zh-t/twro/mob/1002',
});

export const RO_ZH_TW = Object.freeze({
  maps: {
    prt_fild08: '普隆德拉原野',
  },
  monsters: {
    PORING: '波利',
    LUNATIC: '瘋兔',
    FABRE: '綠棉蟲',
    PUPA: '蛹',
    LITTLE_PORING: '小波利',
  },
  items: {
    Jellopy: '傑勒比結晶',
    Knife_: '短劍 [4]',
    Sticky_Mucus: '粘稠液體',
    Apple: '蘋果',
    Wing_Of_Fly: '蒼蠅翅膀',
    Unripe_Apple: '青澀蘋果',
    Poring_Card: '波利卡片',
    Clover: '三葉幸運草',
    Feather: '羽毛',
    Pierrot_Nose: '小丑鼻子',
    Sword_: '長劍 [3]',
    Carrot: '紅蘿蔔',
    Rainbow_Carrot: '彩虹紅蘿蔔',
    Lunatic_Card: '瘋兔卡片',
    Fluff: '絨毛',
    Club_: '木棒 [4]',
    Green_Herb: '綠色藥草',
    Club: '木棒 [3]',
    Fabre_Card: '綠棉蟲卡片',
    Phracon: '強化武器金屬-級數一',
    Chrysalis: '蛹殼',
    Guard_: '鐵盾 [1]',
    Shell: '硬殼',
    Iron_Ore: '鐵礦石',
    Pupa_Card: '蛹卡片',
    Red_Herb: '紅色藥草',
    Novice_Poring_Card: '小波利卡片',
  },
});

export function zhTwItem(aegisName: string) {
  return (
    RO_ZH_TW.items[aegisName as keyof typeof RO_ZH_TW.items] ??
    `未校正名稱（${aegisName}）`
  );
}

export function zhTwActor(actorId?: string) {
  if (!actorId) return '未知目標';
  if (actorId === 'player') return '你';
  for (const [key, name] of Object.entries(RO_ZH_TW.monsters)) {
    if (actorId === key) return name;
    const prefix = `${key.toLowerCase()}-`;
    if (actorId.startsWith(prefix))
      return `${name} #${actorId.slice(prefix.length)}`;
  }
  return actorId;
}
