// Isolated preview data for the town-service prototype. Never sent to the
// server and never read from Production: it only lets the service surfaces be
// judged visually. Names/icons: docs/ro-asset-index (items.json,
// equipment.json). Prices: rAthena db/re/item_db_*.yml Buy (sell = Buy / 2).
// Shop catalogue: rAthena npc/re/merchants/Dealer_Update.txt
// Tool Dealer#Extended_Prt1 (entries without an indexed icon/name omitted).
export const TOWN_SERVICE_PREVIEW = Object.freeze({
  fixture: 'PREVIEW_ONLY',
  zeny: 125000,
  storage: Object.freeze([
    { itemId: 501, name: '紅色藥水', icon: '/ro/client/items/Red_Potion.png', amount: 120, tab: 'item' },
    { itemId: 504, name: '白色藥水', icon: '/ro/client/items/White_Potion.png', amount: 35, tab: 'item' },
    { itemId: 601, name: '蒼蠅翅膀', icon: '/ro/client/items/Wing_Of_Fly.png', amount: 80, tab: 'item' },
    { itemId: 602, name: '蝴蝶翅膀', icon: '/ro/client/items/Wing_Of_Butterfly.png', amount: 12, tab: 'item' },
    { itemId: 645, name: '集中藥水', icon: '/ro/client/items/Center_Potion.png', amount: 6, tab: 'item' },
    { itemId: 512, name: '蘋果', icon: '/ro/client/items/Apple.png', amount: 42, tab: 'item' },
    { itemId: 518, name: '蜂蜜', icon: '/ro/client/items/Honey.png', amount: 9, tab: 'item' },
    { itemId: 1201, name: '短劍', icon: '/ro/client/items/Knife.png', amount: 1, tab: 'equip', refine: 4 },
    { itemId: 1102, name: '長劍', icon: '/ro/client/items/Sword_.png', amount: 1, tab: 'equip', refine: 2 },
    { itemId: 2101, name: '鐵盾', icon: '/ro/client/items/Guard.png', amount: 1, tab: 'equip', refine: 5 },
    { itemId: 909, name: '傑勒比結晶', icon: '/ro/client/items/Jellopy.png', amount: 214, tab: 'etc' },
    { itemId: 914, name: '毛', icon: '/ro/client/items/Fluff.png', amount: 96, tab: 'etc' },
    { itemId: 705, name: '三葉幸運草', icon: '/ro/client/items/Clover.png', amount: 18, tab: 'etc' },
    { itemId: 7033, name: '毒魔菇芽孢', icon: '/ro/client/items/Poison_Spore.png', amount: 27, tab: 'etc' },
    { itemId: 984, name: '神之金屬', icon: '/ro/client/items/Oridecon.png', amount: 3, tab: 'etc' },
    { itemId: 985, name: '鋁', icon: '/ro/client/items/Elunium.png', amount: 5, tab: 'etc' },
  ].map(Object.freeze)),
  storageCapacity: 600,
  bag: Object.freeze([
    { itemId: 501, name: '紅色藥水', icon: '/ro/client/items/Red_Potion.png', amount: 30, tab: 'item' },
    { itemId: 504, name: '白色藥水', icon: '/ro/client/items/White_Potion.png', amount: 8, tab: 'item' },
    { itemId: 601, name: '蒼蠅翅膀', icon: '/ro/client/items/Wing_Of_Fly.png', amount: 15, tab: 'item' },
    { itemId: 1201, name: '短劍', icon: '/ro/client/items/Knife.png', amount: 1, tab: 'equip', refine: 4 },
    { itemId: 909, name: '傑勒比結晶', icon: '/ro/client/items/Jellopy.png', amount: 58, tab: 'etc' },
    { itemId: 914, name: '毛', icon: '/ro/client/items/Fluff.png', amount: 31, tab: 'etc' },
    { itemId: 7033, name: '毒魔菇芽孢', icon: '/ro/client/items/Poison_Spore.png', amount: 12, tab: 'etc' },
    { itemId: 512, name: '蘋果', icon: '/ro/client/items/Apple.png', amount: 15, tab: 'item' },
  ].map(Object.freeze)),
  shop: Object.freeze([
    { itemId: 611, name: '放大鏡', icon: '/ro/client/items/Spectacles.png', price: 40 },
    { itemId: 602, name: '蝴蝶翅膀', icon: '/ro/client/items/Wing_Of_Butterfly.png', price: 1000 },
    { itemId: 601, name: '蒼蠅翅膀', icon: '/ro/client/items/Wing_Of_Fly.png', price: 250 },
    { itemId: 645, name: '集中藥水', icon: '/ro/client/items/Center_Potion.png', price: 1200 },
    { itemId: 656, name: '覺醒藥水', icon: '/ro/client/items/Awakening_Potion.png', price: 2200 },
    { itemId: 501, name: '紅色藥水', icon: '/ro/client/items/Red_Potion.png', price: 10 },
    { itemId: 504, name: '白色藥水', icon: '/ro/client/items/White_Potion.png', price: 1200 },
  ].map(Object.freeze)),
  sellable: Object.freeze([
    { itemId: 909, name: '傑勒比結晶', icon: '/ro/client/items/Jellopy.png', amount: 58, price: 3 },
    { itemId: 914, name: '毛', icon: '/ro/client/items/Fluff.png', amount: 31, price: 4 },
    { itemId: 7033, name: '毒魔菇芽孢', icon: '/ro/client/items/Poison_Spore.png', amount: 12, price: 57 },
    { itemId: 705, name: '三葉幸運草', icon: '/ro/client/items/Clover.png', amount: 7, price: 5 },
    { itemId: 512, name: '蘋果', icon: '/ro/client/items/Apple.png', amount: 15, price: 7 },
  ].map(Object.freeze)),
  // rAthena db/re/refine.yml: weapon level 1 uses Phracon (1010) at 50z,
  // armour uses Elunium (985) at 2000z.
  refine: Object.freeze([
    { itemId: 1201, name: '短劍', icon: '/ro/client/items/Knife.png', refine: 4, kind: 'weapon',
      material: { itemId: 1010, name: '強化武器金屬-級數一', icon: '/ro/client/items/Phracon.png' }, cost: 50 },
    { itemId: 1102, name: '長劍', icon: '/ro/client/items/Sword_.png', refine: 2, kind: 'weapon',
      material: { itemId: 1010, name: '強化武器金屬-級數一', icon: '/ro/client/items/Phracon.png' }, cost: 50 },
    { itemId: 1301, name: '斧', icon: '/ro/client/items/Axe.png', refine: 0, kind: 'weapon',
      material: { itemId: 1010, name: '強化武器金屬-級數一', icon: '/ro/client/items/Phracon.png' }, cost: 50 },
    { itemId: 2101, name: '鐵盾', icon: '/ro/client/items/Guard.png', refine: 5, kind: 'armor',
      material: { itemId: 985, name: '鋁', icon: '/ro/client/items/Elunium.png' }, cost: 2000 },
    { itemId: 2301, name: '棉襯衫', icon: '/ro/client/items/Cotton_Shirt.png', refine: 3, kind: 'armor',
      material: { itemId: 985, name: '鋁', icon: '/ro/client/items/Elunium.png' }, cost: 2000 },
  ].map(Object.freeze)),
});
