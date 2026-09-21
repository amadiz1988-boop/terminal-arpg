# MINIMAP_LIVE_COMBAT_POC_V1 bounded reference notes

Reference: `MrAntares/roBrowserLegacy` at commit `6470972260221c0fe0cd4825b66c5ac5fb20055a` (GPL-3.0). No source code was copied into this PoC.

Files reviewed:

- `src/UI/Components/MiniMap/MiniMapCommon.js`
- `src/Renderer/Entity/Entity.js`
- `src/Renderer/Entity/EntityWalk.js`
- `src/Renderer/Entity/EntityAction.js`
- `src/Renderer/Entity/EntityRender.js`
- `src/Renderer/EntityManager.js`
- `src/Engine/MapEngine/Entity.js`
- `src/Renderer/Effects/Damage.js`
- `src/Loaders/Sprite.js`

Reusable behavior:

- `ROBROWSER_MINIMAP_PROJECTION`: map x/y are projected into a bounded canvas; y is inverted for screen space and a zoomed view is centered on the player.
- `ROBROWSER_MOVEMENT_MODEL`: movement is a time-bounded path/segment, with server start time used for latency compensation; rendering processes walk independently every frame.
- `ROBROWSER_ACTION_MODEL`: IDLE/WALK/ATTACK/HURT/DIE are explicit action states with an animation start tick, frame index, frame delay and repeat policy.
- `ROBROWSER_DAMAGE_MODEL`: damage is a short-lived object with a start tick and delay; it moves upward on a bounded arc and fades as progress approaches 1.
- `ROBROWSER_DEATH_MODEL`: death is an explicit action; entity removal can be delayed so the death presentation is visible.
- `ROBROWSER_RENDER_LOOP`: the renderer invokes entity walk/action processing on each frame, then draws entities and effects.

This PoC adapts those semantics to Canvas2D and a deterministic mock snapshot queue. It does not import gameplay authority, server commands, OpenKore, Persistent Agent, Event Ledger, or production minimap code.

Asset provenance used by the page:

- Map: `public/ro/client/maps/prt_fild08.png`, indexed in `docs/ro-asset-index/maps.json` as the verified client `prt_fild08` minimap.
- Player: `public/ro/client/showcase/body/novice-male-*.png`, indexed by the existing showcase manifest and built from the authorized local client.
- Monsters: `public/ro/client/monsters/poring.webp`, `lunatic.webp`, and `fabre.webp`, with ACT/SPR provenance and SHA-256 records in `public/ro/client/monsters/manifest.json`.

The strict original-asset audit is recorded in `RO_ORIGINAL_ASSET_MATRIX.md`. The current Web monster outputs are verified idle outputs; their source ACT/SPR pairs are recorded, while complete action frame atlases are not yet proven in Web form. The page therefore keeps monster action and death fidelity blocked and does not create replacement animation art.

The read-only adapter follows the existing Dashboard contracts: `/api/live-position` is a minimal position projection, `/api/combat-snapshot` establishes the combat cursor, and `/api/combat-stream` or `/api/events` provides event delivery. A live `ATTACK` line is never promoted to a hit or damage effect without an authoritative damage value.
