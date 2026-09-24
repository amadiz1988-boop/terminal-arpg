// Source: canonical rAthena npc/re/merchants/Dealer_Update.txt and
// npc/re/merchants/shops.txt. Each listed shop sells supply item 501.
// This is service identity only; map-route.mjs plans the actual city journey.
export const SUPPLY_TOWN_SERVICES = Object.freeze({
  prontera: { map: 'prt_in', x: 126, y: 76, npc: 'Tool Dealer#Extended_Prt1' },
  geffen: { map: 'geffen_in', x: 77, y: 167, npc: 'Tool Dealer#Extended_Gef' },
  izlude: { map: 'izlude_in', x: 57, y: 110, npc: 'Tool Dealer#iz' },
  payon: { map: 'payon', x: 159, y: 96, npc: 'Tool Dealer#pay3' },
  alberta: { map: 'alberta_in', x: 182, y: 97, npc: 'Tool Dealer#Extended_Alb2' },
  comodo: { map: 'cmd_in01', x: 79, y: 182, npc: 'Tool Dealer#Extended_Cmd' },
  aldebaran: { map: 'aldeba_in', x: 94, y: 56, npc: 'Tool Dealer#Extended_Alde' },
});

// Canonical rAthena npc/kafras/kafras.txt and npc/re/kafras/kafras.txt.
// F_Kafra in npc/kafras/functions_kafras.txt displays Storage at index 2
// for menu 0; Izlude's duplicated menu 2 displays it at index 1. Native
// verifies the observed dialog before selecting an option.
export const SUPPLY_TOWN_STORAGE = Object.freeze({
  prontera: { map: 'prontera', x: 151, y: 29, npc: 'kaf_prontera2', storageMenuIndex: 2 },
  geffen: { map: 'geffen', x: 120, y: 62, npc: 'kaf_geffen', storageMenuIndex: 2 },
  izlude: { map: 'izlude', x: 128, y: 148, npc: 'Kafra Employee#iz', storageMenuIndex: 1 },
  payon: { map: 'payon', x: 181, y: 104, npc: 'kaf_payon', storageMenuIndex: 2 },
  alberta: { map: 'alberta', x: 113, y: 60, npc: 'kaf_alberta2', storageMenuIndex: 2 },
  comodo: { map: 'comodo', x: 195, y: 150, npc: 'kaf_comodo', storageMenuIndex: 2 },
  aldebaran: { map: 'aldebaran', x: 143, y: 119, npc: 'kaf_aldebaran', storageMenuIndex: 2 },
});
