(() => {
  'use strict';

  const entries = Object.freeze({
    'assassin.huey': Object.freeze({ key: 'assassin.huey', npcName: "Assassin Expert 'Huey'", spriteId: 55, sourceRef: 'npc/jobs/2-1/assassin.txt:50', src: null, status: 'missing' }),
    'assassin.anonymous-one': Object.freeze({ key: 'assassin.anonymous-one', npcName: 'The Anonymous One', spriteId: null, sourceRef: 'npc/jobs/2-1/assassin.txt:668-968', src: null, status: 'missing' }),
    'assassin.guildmaster': Object.freeze({ key: 'assassin.guildmaster', npcName: 'Guildmaster', spriteId: 106, sourceRef: 'npc/jobs/2-1/assassin.txt:1639', src: null, status: 'missing' }),
    'rogue.markie': Object.freeze({ key: 'rogue.markie', npcName: 'Markie', spriteId: 747, sourceRef: 'npc/jobs/2-2/rogue.txt:57', src: null, status: 'missing' }),
    'rogue.aragham-junior': Object.freeze({ key: 'rogue.aragham-junior', npcName: 'Aragham Junior', spriteId: 99, sourceRef: 'npc/jobs/2-2/rogue.txt:1399', src: null, status: 'missing' }),
    'rogue.antonio-junior': Object.freeze({ key: 'rogue.antonio-junior', npcName: 'Antonio Junior', spriteId: 88, sourceRef: 'npc/jobs/2-2/rogue.txt:1571', src: null, status: 'missing' }),
    'rogue.hollgrehenn-junior': Object.freeze({ key: 'rogue.hollgrehenn-junior', npcName: 'Hollgrehenn Junior', spriteId: 85, sourceRef: 'npc/jobs/2-2/rogue.txt:1485', src: null, status: 'missing' }),
    'rogue.hermanthorn-junior': Object.freeze({ key: 'rogue.hermanthorn-junior', npcName: 'Hermanthorn Junior', spriteId: 85, sourceRef: 'npc/jobs/2-2/rogue.txt:1228', src: null, status: 'missing' }),
    'rogue.branch-contact': Object.freeze({ key: 'rogue.branch-contact', npcName: 'Rogue Guild 聯絡人', spriteId: null, sourceRef: 'npc/jobs/2-2/rogue.txt:1018-1312', src: null, status: 'missing' }),
    'knight.captain-herman': Object.freeze({ key: 'knight.captain-herman', npcName: 'Captain Herman', spriteId: 56, sourceRef: 'npc/jobs/2-1/knight.txt:45', src: null, status: 'missing' }),
    'knight.sir-siracuse': Object.freeze({ key: 'knight.sir-siracuse', npcName: 'Sir Siracuse', spriteId: 65, sourceRef: 'npc/jobs/2-1/knight.txt:673', src: null, status: 'missing' }),
    'knight.lady-amy': Object.freeze({ key: 'knight.lady-amy', npcName: 'Lady Amy', spriteId: 728, sourceRef: 'npc/jobs/2-1/knight.txt:1449', src: null, status: 'missing' }),
    'knight.sir-gray': Object.freeze({ key: 'knight.sir-gray', npcName: 'Sir Gray', spriteId: 119, sourceRef: 'npc/jobs/2-1/knight.txt:2006', src: null, status: 'missing' }),
  });

  function resolve(key) {
    const normalized = String(key ?? '').trim();
    return entries[normalized] ?? Object.freeze({
      key: normalized || null,
      npcName: null,
      spriteId: null,
      sourceRef: null,
      src: null,
      status: 'missing',
    });
  }

  window.NpcVisualManifest = Object.freeze({ entries, resolve });
})();
