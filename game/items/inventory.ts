import type { Item, ItemSlot } from '../core/types';

export function acceptInventoryDrops(current:Item[],drops:Item[],capacity=100){
  return drops.slice(0,Math.max(0,capacity-current.length));
}

export function repairEquippedItems(items:Item[],equipped:Partial<Record<ItemSlot,string>>){
  const repaired={...equipped};
  const slots:ItemSlot[]=['weapon','armor','helmet','gloves','boots','amulet'];
  for(const slot of slots){
    if(repaired[slot]&&items.some(item=>item.id===repaired[slot]))continue;
    const replacement=items.find(item=>item.slot===slot);
    if(replacement)repaired[slot]=replacement.id;else delete repaired[slot];
  }
  return repaired;
}
