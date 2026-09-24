# OpenKore Field / Wx Map Reference Audit V1

日期：2026-09-23

```text
TASK = OPENKORE_MINIMAP_REFERENCE_ALIGNMENT_V1
REFERENCE_MODE = SOURCE_ONLY
OPENKORE_RUNTIME = 0
PRODUCTION_TOUCHED = NO
REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
REFERENCE_LICENSE = GPL-2.0
REUSE_DECISION = PORTABLE_LOGIC
SOURCE_CODE_COPIED = NO
```

## Primary source

- `.local/ro-stack/openkore/src/Field.pm`
- `.local/ro-stack/openkore/src/Interface/Wx/MapViewer.pm`
- `.local/ro-stack/openkore/src/Interface/Wx.pm`
- `.local/ro-stack/openkore/control/config.txt`

## Field and image model

`Field.pm` loads `.fld2` or `.fld2.gz`. The first four bytes are little-endian
width and height, followed by one byte per cell. `rawMap` therefore contains
`width * height` cell values. Bit 0 means walkable, bit 1 snipable, bit 2 water
and bit 3 cliff. `getOffset(x, y)` is `y * width + x`.

`Field::image()` searches the maps folder in this exact default order:

```text
<map>.jpg -> <map>.png -> <map>.bmp -> <map>.xpm
```

When none exists, it writes `<map>.xpm` from `width`, `height` and `rawMap`
through `Utils::xpmmake`. A requested non-XPM output is converted from that
generated XPM only after the collision image exists. Collision data remains the
map-logic source while the selected image remains a presentation source.

## Coordinate transform

Wx derives independent scales from the selected bitmap and Field dimensions:

```text
xScale = bitmapWidth / fieldWidth
yScale = bitmapHeight / fieldHeight
pixelX = worldX * xScale - viewportX
pixelY = (fieldHeight - worldY) * yScale - viewportY
```

The bitmap is drawn without changing this coordinate system. Positive RO world
Y maps upward, while positive screen Y maps downward. Zoom multiplies the bitmap
before recalculating both scales. The viewport centers on the character and is
clamped to the bitmap bounds.

## Overlay model

Wx renders the background first, then independent overlays for indicators,
portals, players, party members, monsters, NPCs, slaves, two route solutions
and the local player. Route display supports destination-only, sampled dots and
full-path dots. Names are controlled by zoom thresholds. Portal destinations
can be drawn as arrows.

The `wx_map_*` keys at the locked commit are:

```text
wx_map_maxAutoSize = 300
wx_map_monsterSticking = 1
wx_map_npcSticking = 1
wx_map_playersSticking = 1
wx_map_portalSticking = 5
wx_map_route = empty/0, 1 or 2
wx_map_namesDetail = 8
wx_map_playerNameZoom = 8
wx_map_partyNameZoom = 1
wx_map_portalDestinations = 0
```

Sticking is interaction snapping by world-cell distance. Hover text resolves
nearby portals, monsters, players and NPCs. Clicks near a portal snap movement
to the portal cell; clicks near a monster attack; clicks near an NPC talk.
Overlapping draw markers are not displaced by the renderer.

## Ghost Island mapping before implementation

| Capability | OpenKore | Current Ghost Island | Decision |
| --- | --- | --- | --- |
| background selection | best existing JPG/PNG/BMP/XPM | generated collision Canvas only | ADAPT |
| fallback | generated XPM from rawMap | collision Canvas from FLD2 | KEEP |
| coordinate transform | bitmap/Field independent X/Y scale, inverted Y | contain scale, inverted Y | ADAPT |
| player marker | local and visible players | local and visible players | KEEP |
| monster marker | visible monsters | visible monsters and engaged state | IMPROVE |
| NPC marker | visible NPCs | no renderer input | GAP |
| portal marker | portal table and destinations | no renderer input | GAP |
| route overlay | two route solutions | no renderer input | GAP, outside route-engine scope |
| zoom | wheel powers of two | responsive whole-map view | GAP |
| marker sticking / overlap | world-distance interaction snapping; markers may overlap | player-label placement only | GAP / IMPROVE |

## Pre-implementation gate

```text
OPENKORE_REFERENCE_REQUIRED = YES
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_CAPABILITY_EXISTS = YES
OPENKORE_REFERENCE_SYMBOLS = Field::image, Field::loadFile, _updateBitmap,
  _loadMapImage, _posXYToView, _viewToPosXY, _viewCharacter, setRoute,
  setPlayers, setMonsters, setNPCs, updateMapViewer, onMapMouseMove, onMapClick
OPENKORE_CONFIG_KEYS = wx_map_maxAutoSize, wx_map_monsterSticking,
  wx_map_npcSticking, wx_map_playersSticking, wx_map_portalSticking,
  wx_map_route, wx_map_namesDetail, wx_map_playerNameZoom,
  wx_map_partyNameZoom, wx_map_portalDestinations
OPENKORE_LAST_GOOD_BEHAVIOR = best image with rawMap collision fallback and
  background-independent overlays
OPENKORE_TRIGGER_CONDITION = map or position update
OPENKORE_STATE_MACHINE = field load -> image select/generate -> scale -> overlay
OPENKORE_SUCCESS_PATH = selected image and aligned overlays render
OPENKORE_FAILURE_PATH = no image -> generated collision image
OPENKORE_RECOVERY_PATH = rebuild bitmap on field or zoom change
OPENKORE_RETRY_POLICY = no image retry loop; next field update may rebuild
OPENKORE_EDGE_CASES = aliases, instances, missing image, non-square map, viewport clamp
OPENKORE_AUTHORITY_BOUNDARY = Field/rawMap for collision; image for presentation
CURRENT_GHOST_ISLAND_BEHAVIOR = FLD2 collision Canvas plus authoritative live markers
BEHAVIOR_DIFFERENCES = no original-image selection, no NPC/portal/route/zoom input
OPENKORE_REFERENCE_VERSION = OpenKore master at locked commit
OPENKORE_REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
OPENKORE_REFERENCE_SOURCE = authorized local .local/ro-stack/openkore checkout
OPENKORE_REFERENCE_DATE = 2026-09-23
PROJECT_LAST_GOOD_OPENKORE_CONFIG = control/config.txt wx_map_* block
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE = locked local checkout
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION = 51de1ddf
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE = git show HEAD:control/config.txt
OPENKORE_REFERENCE_INHERITED = NO
REFERENCE_DOSSIER = docs/openkore-reference/minimap-field-wx-map-v1.md
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
PRE_IMPLEMENTATION_REUSE_GATE = PASS
REUSE_CLASSIFICATION = ADAPT
```

The implementation may replace only background selection and its coordinate
rectangle. Existing authoritative marker feeds and collision data remain
unchanged. Optional overlays may render only when an existing authoritative
projection supplies them. This audit does not authorize a route engine, runtime
OpenKore process or production deployment.
