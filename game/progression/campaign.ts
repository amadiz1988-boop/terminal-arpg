import type { Item, SkillId } from '../core/types';
import { createCampaignItem } from '../items/items';

export type CampaignReward = {
  item?: Item;
  unlockSkill?: SkillId;
  materials?: { scrap: number; essence: number; core: number };
  maps?: number[];
  xp: number;
  currency: number;
};

export function completeCampaignOperation(step: number, selectedSkill: SkillId): CampaignReward {
  return {
    item: createCampaignItem(step, selectedSkill),
    unlockSkill: step === 2 ? selectedSkill : undefined,
    materials: step === 3 ? { scrap: 12, essence: 2, core: 0 } : undefined,
    maps: step === 5 ? [0, 6, 0, 0, 0, 0] : undefined,
    xp: 35 + step * 10,
    currency: step * 2,
  };
}
