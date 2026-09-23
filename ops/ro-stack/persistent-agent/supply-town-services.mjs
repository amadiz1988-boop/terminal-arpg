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
