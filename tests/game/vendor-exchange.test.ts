import { describe,expect,it } from 'vitest';
import { EMPTY_ORBS } from '../../game/content/currencies';
import { VENDOR_EXCHANGES } from '../../game/content/vendor-exchanges';
import { executeVendorExchange,maxVendorExchanges } from '../../game/economy/vendor-exchange';

describe('PoE vendor currency exchange',()=>{
  it('contains the 14 verified direct vendor purchases',()=>{expect(VENDOR_EXCHANGES).toHaveLength(14);expect(VENDOR_EXCHANGES.every(recipe=>recipe.sourceStatus==='verified')).toBe(true);});
  it('exchanges three wisdom scrolls for one portal scroll',()=>{const wallet={...EMPTY_ORBS,wisdom:7};const recipe=VENDOR_EXCHANGES.find(entry=>entry.id==='portal-for-wisdom')!;expect(maxVendorExchanges(wallet,recipe)).toBe(2);const next=executeVendorExchange(wallet,recipe)!;expect(next.wisdom).toBe(4);expect(next.portal).toBe(1);});
  it('supports exact bulk exchange and rejects insufficient balances',()=>{const wallet={...EMPTY_ORBS,jeweller:12};const recipe=VENDOR_EXCHANGES.find(entry=>entry.id==='fusing-for-jeweller')!;const next=executeVendorExchange(wallet,recipe,3)!;expect(next.jeweller).toBe(0);expect(next.fusing).toBe(3);expect(executeVendorExchange(wallet,recipe,4)).toBeNull();});
  it('does not expose chaos or higher currency as direct purchases',()=>{expect(VENDOR_EXCHANGES.some(recipe=>recipe.rewardId==='chaos'||recipe.rewardId==='divine'||recipe.rewardId==='exalted')).toBe(false);});
});
