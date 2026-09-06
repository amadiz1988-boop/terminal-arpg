import type { OrbWallet } from '../core/types';

export function spendWallet(wallet:OrbWallet,orb:keyof OrbWallet,amount=1):OrbWallet|null{
  if(amount<1||wallet[orb]<amount)return null;
  return {...wallet,[orb]:wallet[orb]-amount};
}
