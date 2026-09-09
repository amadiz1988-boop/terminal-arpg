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
  },
  items: {
    Jellopy: '傑勒比結晶',
    Knife_: '短劍 [4]',
    Sticky_Mucus: '粘稠液體',
    Apple: '蘋果',
    Wing_Of_Fly: '蒼蠅翅膀',
    Unripe_Apple: '青澀蘋果',
    Poring_Card: '波利卡片',
  },
});

export function zhTwItem(aegisName: string) {
  return RO_ZH_TW.items[aegisName as keyof typeof RO_ZH_TW.items] ?? `未校正名稱（${aegisName}）`;
}

export function zhTwActor(actorId?: string) {
  if (!actorId) return '未知目標';
  if (actorId === 'player') return '你';
  if (actorId === 'PORING') return RO_ZH_TW.monsters.PORING;
  if (actorId.startsWith('poring-')) return `波利 #${actorId.slice('poring-'.length)}`;
  return actorId;
}
