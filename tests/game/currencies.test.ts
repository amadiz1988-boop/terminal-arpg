import { describe,expect,it } from 'vitest';
import { CURRENCIES, EMPTY_ORBS, addWallet, repairWallet, rollCurrencyDrops } from '../../game/content/currencies';

describe('currency system',()=>{
  it('opens the complete 31-currency alpha catalog',()=>{expect(CURRENCIES).toHaveLength(31);expect(Object.keys(EMPTY_ORBS)).toHaveLength(31);});
  it('repairs legacy four-orb saves without losing balances',()=>{const wallet=repairWallet({alteration:7,chromatic:3} as never);expect(wallet.alteration).toBe(7);expect(wallet.chromatic).toBe(3);expect(wallet.chaos).toBe(0);});
  it('rolls deterministic drops and respects drop levels',()=>{const a=rollCurrencyDrops(824,20,12);expect(a).toEqual(rollCurrencyDrops(824,20,12));expect(Object.values(a).reduce((sum,value)=>sum+value,0)).toBe(20);expect(a.mirror).toBe(0);});
  it('adds all currency balances through the shared wallet path',()=>{const left=rollCurrencyDrops(1,8,12);const right=rollCurrencyDrops(2,11,35);expect(Object.values(addWallet(left,right)).reduce((sum,value)=>sum+value,0)).toBe(19);});
});
