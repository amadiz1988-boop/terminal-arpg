import type { FarmingRouteId, ItemSlot, SkillId } from '../core/types';

export type FarmingRoute = {
  id: FarmingRouteId;
  name: string;
  description: string;
  chase: string;
  favoredSkill: SkillId;
  forcedSlot?: ItemSlot;
  currencyMultiplier: number;
  danger: number;
};

export const FARMING_ROUTES: Record<FarmingRouteId, FarmingRoute> = {
  arsenal: { id: 'arsenal', name: '失落軍械庫', description: '大量精英與武器底材', chase: '四次完成後，從三把武器中選一把', favoredSkill: 'arc', forcedSlot: 'weapon', currencyMultiplier: 1, danger: .05 },
  foundry: { id: 'foundry', name: '餘燼熔爐', description: '犧牲掉落換取製裝材料', chase: '四次完成後，取得精華與核心', favoredSkill: 'quake', currencyMultiplier: .8, danger: .02 },
  hunter: { id: 'hunter', name: '頂峰追獵', description: '連戰首領，累積頂峰印記', chase: '四次完成後，從三件高階裝備中選一件', favoredSkill: 'ember', currencyMultiplier: 1.35, danger: .12 },
};
