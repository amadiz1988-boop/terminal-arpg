import { describe,expect,it } from 'vitest';
import { spendWallet } from '../../game/economy/wallet';
import { acceptInventoryDrops,repairEquippedItems } from '../../game/items/inventory';
import { addLink,createStarterWeapon,generateItem } from '../../game/items/items';

describe('inventory and currency integrity',()=>{
  it('never admits equipment beyond the 100 item bag limit',()=>{
    const current=Array.from({length:99},(_,index)=>generateItem(1000+index,12));
    const drops=[generateItem(3000,12),generateItem(3001,12)];
    expect(acceptInventoryDrops(current,drops)).toHaveLength(1);
  });

  it('repairs a stale equipped id using a real item from the bag',()=>{
    const weapon=generateItem(4000,24,'weapon');
    expect(repairEquippedItems([weapon],{weapon:'missing'}).weapon).toBe(weapon.id);
  });

  it('deducts the exact orb cost and rejects insufficient balance',()=>{
    const wallet={alteration:3,chromatic:2,fusing:1,jeweller:0};
    expect(spendWallet(wallet,'chromatic',2)?.chromatic).toBe(0);
    expect(spendWallet(wallet,'jeweller',1)).toBeNull();
    expect(wallet.chromatic).toBe(2);
  });

  it('does not change a fully linked item',()=>{
    const item={...createStarterWeapon(),sockets:['G','R'] as Array<'G'|'R'>,links:2};
    expect(addLink(item).links).toBe(2);
  });
});
