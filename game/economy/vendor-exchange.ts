import type { OrbWallet } from '../core/types';
import type { VendorExchange } from '../content/vendor-exchanges';

export function maxVendorExchanges(wallet:OrbWallet,recipe:VendorExchange){return Math.floor(wallet[recipe.costId]/recipe.costAmount);}

export function executeVendorExchange(wallet:OrbWallet,recipe:VendorExchange,times=1):OrbWallet|null{
  if(!Number.isInteger(times)||times<1||maxVendorExchanges(wallet,recipe)<times)return null;
  return {...wallet,[recipe.costId]:wallet[recipe.costId]-recipe.costAmount*times,[recipe.rewardId]:wallet[recipe.rewardId]+recipe.rewardAmount*times};
}
