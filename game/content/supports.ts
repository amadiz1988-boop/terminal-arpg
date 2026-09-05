import type { SupportDefinition, SupportId } from '../core/types';

export const SUPPORTS: Record<SupportId, SupportDefinition> = {
  momentum: { id: 'momentum', name: '氣勢輔助', description: '移動與施放加快，適合拓荒趕路', damageMultiplier: 1, bossMultiplier: 1, clearMultiplier: 1.08, speedMultiplier: 1.18, lifeMultiplier: 1, socketColor: 'G' },
  echo: { id: 'echo', name: '迴響輔助', description: '重複施放，全面提高輸出', damageMultiplier: 1.24, bossMultiplier: 1.08, clearMultiplier: 1.08, speedMultiplier: .94, lifeMultiplier: 1, socketColor: 'B' },
  focus: { id: 'focus', name: '集中效應輔助', description: '犧牲清圖範圍，集中火力擊殺首領', damageMultiplier: 1.18, bossMultiplier: 1.35, clearMultiplier: .82, speedMultiplier: 1, lifeMultiplier: 1, socketColor: 'B' },
  fortify: { id: 'fortify', name: '護體輔助', description: '降低少量輸出，換取可靠生存', damageMultiplier: .94, bossMultiplier: 1, clearMultiplier: 1, speedMultiplier: 1, lifeMultiplier: 1.28, socketColor: 'R' },
};

export const SUPPORT_ORDER: SupportId[] = ['momentum', 'echo', 'focus', 'fortify'];
