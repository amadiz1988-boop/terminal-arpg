// Town service zones: player-facing entry points to town services, drawn on
// the existing original RO minimap. Presentation data only; the physical
// destination, portals and NPC positions come from canonical sources:
//   client System/Towninfo.lub mapNPCInfoTable (town minimap icons + positions)
//   rAthena npc/kafras/kafras.txt, npc/re/merchants/Dealer_Update.txt,
//   npc/merchants/refine.txt, npc/warps/cities/prontera.txt (movement authority)
//   client data.grf navigation/navi_npc_tw.lub (NPC names)
// The service opens only after the character is inside its SERVICE_ZONE.
import { TOWNINFO_MARKS } from './towninfo-marks.mjs';

export const TOWN_SERVICE_TYPES = Object.freeze({
  KAFRA_STORAGE: 'KAFRA_STORAGE',
  SHOP: 'SHOP',
  REFINERY: 'REFINERY',
});

const freezeDeep = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
};

// Original client town minimap icons (data.grf texture/userinterface/
// information, 12x12). See town-service-assets.json for hashes and provenance.
export const TOWN_SERVICE_ICONS = freezeDeep({
  kafra: '/ro/client/town-service/kafra.png',
  store: '/ro/client/town-service/store.png',
  smithy: '/ro/client/town-service/smithy.png',
  guide: '/ro/client/town-service/guide.png',
  inn: '/ro/client/town-service/inn.png',
  weaponshop: '/ro/client/town-service/weaponshop.png',
  armorshops: '/ro/client/town-service/armorshops.png',
  style: '/ro/client/town-service/style.png',
});

// Towninfo.lub TYPE -> information icon (matches the original client minimap).
export const TOWNINFO_TYPE_ICONS = freezeDeep({
  0: 'store', 1: 'weaponshop', 2: 'armorshops', 3: 'smithy',
  4: 'guide', 5: 'inn', 6: 'kafra', 7: 'style',
});

// Every Kafra employee in Prontera (rAthena npc/kafras/kafras.txt) opens Storage.
const PRONTERA_KAFRAS = [
  { suffix: '', x: 151, y: 29, script: 'kaf_prontera2' },
  { suffix: '.146_89', x: 146, y: 89, script: 'kaf_prontera5' },
  { suffix: '.282_200', x: 282, y: 200, script: 'kaf_prontera4' },
  { suffix: '.29_207', x: 29, y: 207, script: 'kaf_prontera3' },
  { suffix: '.152_326', x: 152, y: 326, script: 'kaf_prontera' },
];

export const TOWN_SERVICE_TOWNS = freezeDeep({
  prontera: {
    townMap: 'prontera',
    name: '普隆德拉',
    // Interior maps whose services belong to this town.
    maps: ['prontera', 'prt_in'],
    // World-map town teleport landing: kafra-content.mjs prontera save point.
    arrival: { map: 'prontera', x: 150, y: 33, source: 'persistent-agent/kafra-content.mjs prontera saveX/saveY' },
    // Interior rooms are not connected to each other; leaving through the
    // room's own door returns to town (rathena npc/warps/cities/prontera.txt).
    exits: [
      { map: 'prt_in', x: 135, y: 71, portal: 'prt04-1', exit: { map: 'prontera', x: 136, y: 219 } },
      { map: 'prt_in', x: 60, y: 77, portal: 'prt06-1', exit: { map: 'prontera', x: 175, y: 188 } },
    ],
    services: [
      ...PRONTERA_KAFRAS.map((kafra) => ({
        id: `prontera.kafra_storage${kafra.suffix}`,
        type: 'KAFRA_STORAGE',
        npcName: '卡普拉 職員',
        serviceName: '倉庫',
        npc: { map: 'prontera', x: kafra.x, y: kafra.y, script: kafra.script },
        // Radius 3 keeps the world-map landing (150,33) outside the south zone.
        zone: { map: 'prontera', x: kafra.x, y: kafra.y, radius: 3 },
        route: [{ map: 'prontera', to: { x: kafra.x, y: kafra.y } }],
        markers: [{ map: 'prontera', x: kafra.x, y: kafra.y, icon: 'kafra' }],
        sources: [
          `rathena npc/kafras/kafras.txt prontera,${kafra.x},${kafra.y} ${kafra.script}`,
          `System/Towninfo.lub prontera 便利服務 ${kafra.x},${kafra.y} TYPE 6`,
        ],
      })),
      {
        id: 'prontera.tool_dealer',
        type: 'SHOP',
        npcName: '道具商人',
        serviceName: '商店',
        npc: { map: 'prt_in', x: 126, y: 76, script: 'Tool Dealer#Extended_Prt1' },
        zone: { map: 'prt_in', x: 126, y: 76, radius: 3 },
        route: [
          { map: 'prontera', to: { x: 134, y: 221 }, portal: 'prt04', exit: { map: 'prt_in', x: 131, y: 71 } },
          { map: 'prt_in', to: { x: 126, y: 76 } },
        ],
        markers: [
          { map: 'prontera', x: 134, y: 221, icon: 'store' },
          { map: 'prt_in', x: 126, y: 76, icon: 'store' },
        ],
        sources: [
          'System/Towninfo.lub prontera 工具店 134,221 TYPE 0',
          'rathena npc/re/merchants/Dealer_Update.txt prt_in,126,76 Tool Dealer#Extended_Prt1',
          'rathena npc/warps/cities/prontera.txt prt04 prontera,134,221 -> prt_in,131,71',
          'data.grf navi_npc_tw 31058 prt_in 126,76 道具商人',
        ],
      },
      {
        id: 'prontera.refinery',
        type: 'REFINERY',
        npcName: '忽克連',
        serviceName: '精煉',
        npc: { map: 'prt_in', x: 63, y: 60, script: 'Hollgrehenn' },
        zone: { map: 'prt_in', x: 63, y: 60, radius: 3 },
        route: [
          { map: 'prontera', to: { x: 179, y: 184 }, portal: 'prt06', exit: { map: 'prt_in', x: 60, y: 73 } },
          { map: 'prt_in', to: { x: 63, y: 60 } },
        ],
        markers: [
          { map: 'prontera', x: 178, y: 186, icon: 'smithy' },
          { map: 'prt_in', x: 63, y: 60, icon: 'smithy' },
        ],
        sources: [
          'System/Towninfo.lub prontera 打鐵場 178,186 TYPE 3',
          'rathena npc/merchants/refine.txt prt_in,63,60 Hollgrehenn',
          'rathena npc/warps/cities/prontera.txt prt06 prontera,179,184 -> prt_in,60,73',
          'data.grf navi_npc_tw 31031 prt_in 63,60 忽克連',
        ],
      },
    ],
  },
});

const allServices = Object.values(TOWN_SERVICE_TOWNS).flatMap((town) =>
  town.services.map((service) => ({ town, service })));

export function townForMap(map) {
  return Object.values(TOWN_SERVICE_TOWNS).find((town) => town.maps.includes(map)) ?? null;
}

export function isTownServiceMap(map) {
  return townForMap(map) !== null;
}

export function serviceById(id) {
  return allServices.find((entry) => entry.service.id === id)?.service ?? null;
}

// Maps that carry original client minimap marks (every Towninfo town and the
// few field/dungeon maps the client also marks).
export function hasTownMinimapMarks(map) {
  return Object.hasOwn(TOWNINFO_MARKS, map ?? '') || isTownServiceMap(map);
}

// Minimap marks for a map: the map's original Towninfo marks (linked to a
// player service when one exists at that mark) plus service marks inside
// interiors. Marks without a service are shown by name only.
export function markersForMap(map) {
  const serviceMarkers = allServices.flatMap(({ service }) => service.markers
    .filter((marker) => marker.map === map)
    .map((marker) => ({ ...marker, service })));
  const label = (service) => `${service.npcName}・${service.serviceName}`;
  const marks = [];
  for (const mark of TOWNINFO_MARKS[map] ?? []) {
    const icon = TOWNINFO_TYPE_ICONS[mark.type];
    if (!icon) continue;
    const linked = serviceMarkers.find((entry) => entry.x === mark.x && entry.y === mark.y);
    marks.push({ map, x: mark.x, y: mark.y, icon,
      serviceId: linked?.service.id ?? null, type: linked?.service.type ?? null,
      label: linked ? label(linked.service) : mark.name });
  }
  for (const entry of serviceMarkers)
    if (!marks.some((mark) => mark.x === entry.x && mark.y === entry.y))
      marks.push({ map, x: entry.x, y: entry.y, icon: entry.icon, serviceId: entry.service.id,
        type: entry.service.type, label: label(entry.service) });
  return marks;
}

// SERVICE_ZONE: a bounded square around the service NPC on the NPC's own map.
// Exact-cell contact is not required; another map or a distant cell never is.
export function inServiceZone(service, position) {
  const zone = service?.zone;
  if (!zone || !position || position.map !== zone.map) return false;
  const x = Number(position.x), y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.max(Math.abs(x - zone.x), Math.abs(y - zone.y)) <= zone.radius;
}

// Remaining route legs from the current map. Null means the service is not
// reachable from here with this town's data (for example another town).
export function remainingRoute(service, map) {
  const index = service?.route?.findIndex((leg) => leg.map === map) ?? -1;
  return index < 0 ? null : service.route.slice(index);
}

// Intent lifecycle for one player service request.
export const SERVICE_INTENT_STATUS = Object.freeze({
  NAVIGATING: 'NAVIGATING',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
});

export function createServiceIntent(serviceId, position, now = Date.now()) {
  const service = serviceById(serviceId);
  if (!service) throw new Error('UNKNOWN_TOWN_SERVICE');
  const route = remainingRoute(service, position?.map);
  if (!route) throw new Error('TOWN_SERVICE_OUT_OF_TOWN');
  return { kind: 'PLAYER_SERVICE_INTENT', serviceId, status: SERVICE_INTENT_STATUS.NAVIGATING,
    createdAt: now, origin: { map: position.map, x: Number(position.x), y: Number(position.y) } };
}

// Returns the next intent; a service surface may open only from inside its zone.
export function advanceServiceIntent(intent, position) {
  if (!intent || intent.status !== SERVICE_INTENT_STATUS.NAVIGATING) return intent;
  const service = serviceById(intent.serviceId);
  if (!inServiceZone(service, position)) return intent;
  return { ...intent, status: SERVICE_INTENT_STATUS.OPEN,
    openedAt: { map: position.map, x: Number(position.x), y: Number(position.y) } };
}

export function closeServiceIntent(intent) {
  if (!intent) return intent;
  return { ...intent, status: intent.status === SERVICE_INTENT_STATUS.OPEN
    ? SERVICE_INTENT_STATUS.CLOSED : SERVICE_INTENT_STATUS.CANCELLED };
}
