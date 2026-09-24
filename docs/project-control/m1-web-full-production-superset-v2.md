# M1 Web Full Production Superset V2

## Scope and authority

- Input source: `0cbfd0b4efb06fd20183eb88277503d73da58874`.
- Current Production evidence root: `C:\Users\Administrator\ghost-island-production\ro-stack`.
- Deployed receipt: `.local\ro-stack\dashboard\deploy-receipts\manifest-9d2776aab4c146cd90b20fdff5951da7\manifest.json`.
- Production `ops/ro-stack/dashboard/app.js` SHA256: `3D944BB2F107E9B4215FD8B99400095514AF2A850533A354B69DFE43329F133B`.
- Input M1 `app.js` SHA256: `CB27B5B5D0BDBCD96371326B648F9233D7218DF29974D50BDE4B42828ABF87F9`.
- This checkpoint integrates source only. Production files, endpoints, Browser, and runtime were not changed or contacted.

## Provenance and hunk decisions

| Capability | Exact source | Decision |
| --- | --- | --- |
| M1 World Map, saved town, direct teleport, Supply mapping, same-map AUTO_FARM, teleport A/B/C/D, configuration editor, Discord link | Input `0cbfd0b4` | `M1_KEEP` |
| Original skill tree grid, controls, layout loader, reset dialog, style and HTML | `0f1feccf6f2423b1ae5761f81b8b7f346190c773`, accepted `494899eb9afe42b96928e1d56c26722bc4b9d096` | `PRODUCTION_SKILL_UI_KEEP` plus `SHARED_MERGE_REQUIRED` in `app.js`, `index.html`, and `styles.css` |
| Original button/cancel sound routing, mute, tab and inventory hooks | `1d6fad99f8e659fc2d1f9e2db9484e653145529d`, accepted `494899eb` | `PRODUCTION_BUTTON_AUDIO_KEEP` plus `SHARED_MERGE_REQUIRED` with M1 travel cues |
| Two skill layout and UI asset JSON files, three original skill-up PNGs, two original button WAVs | Exact Git tree `494899eb` | `PRODUCTION_SKILL_UI_KEEP`, byte-identical to current Production |
| Admin recovery and security | Input `0cbfd0b4` plus accepted `be9ddb39c4786f8d0a6f93a65346d8d73fcf06e9` | `SHARED_MERGE_REQUIRED` |
| Support sessions, test fixture command, canonical farm route and local dependencies | Accepted `494899eb` and `be9ddb39` | `SHARED_MERGE_REQUIRED`; keep M1 route planning |
| Original Prontera floor choices and preview | `3564673315b361e861f64f13995043bfffe4d4ab` | `SHARED_MERGE_REQUIRED`; union with three M1 choices, 13 total |
| Production minimap, mission, NPC, pet modules and active pet assets | Current Production, with exact Git history for all except the four pet paths below | `PRESERVED` |
| Old Production Supply form controls | Current Production | `INTENTIONALLY_SUPERSEDED_BY_CANONICAL`: M1 character configuration editor exposes the current Supply mapping; the old form controls are absent from HTML |
| Old cache query strings in HTML | Current Production | `STALE`; integrated HTML uses `r108-m1-full-superset` |

Skill tree hunks: `app.js` class and job sections, node grid rendering, skill tree controls, three JSON fetches at `/ro/data/skill-trees.json`, `/skill-tree-layouts.json`, `/skill-ui-assets.json`; `index.html` skill controls; `styles.css` grid and node presentation. Skill asset loader hunks: `loadSkillTrees`, `renderSkillTree`, and static JSON serving from `dashboard.mjs`. Button audio hunks: central `combatSounds`, `uiSoundKeys`, delegated button handler, tab/inventory handlers, mute preference and playback counters. No independent button audio player was introduced.

## Exact asset integrity

| Path | Current Production SHA256 | Source candidate SHA256 | Match |
| --- | --- | --- | --- |
| `ops/ro-stack/dashboard/skill-tree-layouts.json` | `B91DBAB11590600C2235F7077B44C0B1ACD438ED4E13B9EE671B9E16309AFF11` | same | YES |
| `ops/ro-stack/dashboard/skill-ui-assets.json` | `EF22247DEF3AB11E94373C4FCBAB173E6FB9AF044E55383EA5FD0279AD4328B3` | same | YES |
| `public/ro/client/sfx/official/ui_button_original.wav` | `9750CBA0BCCC3785731F721FFB05E86CC95F420758152C9CAAC0FD495B86AD38` | same | YES |
| `public/ro/client/sfx/official/ui_cancel_original.wav` | `3C26B38001616DEEC19D998874BF8A998FED255E9E31608403A7FDDA5F749330` | same | YES |

## Production-only artifact classification

The bounded Production dashboard tree contains 95 files. The source tree retains all 72 active files. The remaining 23 are two `app.js.bak-*` copies, seven `assets/pets-candidate` files, and 14 `assets/pets-preview` files, classified `NOT_RELEVANT_RUNTIME_ARTIFACT`. Source integration retained six deferred Web modules and active pet files.

Six accepted files had no reachable clean Git checkpoint at their exact path. Their bytes were copied from the current deployed artifact, with the following SHA256 values. Classification: `DEPLOYED_ARTIFACT_ONLY`, `PRESERVED`.

| Path under `ops/ro-stack/dashboard` | SHA256 |
| --- | --- |
| `admin/server-ops.css` | `D1D257F872917043003BFE94E38D10444C5183A457CB7308027E35391A6F764D` |
| `admin/server-ops.html` | `4AFC69FE435CA553DC4A3A0B90D130F1CE3A13E6395C309652567828BB9D5709` |
| `assets/pets/angeling/walk.webp` | `8B07D6101EC2AEBD03A63283F3AFA12BAECEA7CD65D87D4A8E004CD92A5A7609` |
| `assets/pets/baphomet/walk.webp` | `C745B923904DB5C5B9300702233F21185DE8D1D601F15C02AD9B8E80BC38E5A2` |
| `assets/pets/moonlight/walk.webp` | `111D38B2BC1D58029E4C18D87189C1DD1C491F7962449A365A20DA50F7A51DAB` |
| `assets/pets/terasoid/manifest.json` | `79A86C76F018880AE4F0D6CBE071130B5234727AB26BF4CA7E9E8D1E49F81DD0` |

The 99 original UI files added under `public/ro/client/ui/original` were byte-matched to current Production and to exact historical Git blob objects at the same paths. Their source classification is `HISTORICAL_GIT_OBJECT`, `PRESERVED`. The nine added floor PNG files match the clean `35646733` source and current Production.

The Production `public/ro/client` tree has 5,325 files. The integrated source retains 2,056; the remaining 3,269 are imported runtime client assets: BGM 16, collection 716, items 832, maps 2, monsters 128, NPCs 3, showcase 1,572. Their import/build scripts remain in `scripts/`. These files are `NOT_RELEVANT_RUNTIME_ARTIFACT` for the exact-file source integration and remain in Production. A future deployment manifest must preserve them and pass its runtime delivery closure precheck. This source checkpoint alone does not prove fresh-checkout delivery of those generated files.

## Source verification

- `scripts/test-web-full-production-superset.mjs`: 309 checks, 83 static assets, 71 local import files, 13 floor themes.
- Skill tree layout and icon tests: 24 playable jobs, 587 positions, 348 icons. Two JSON hashes match Production.
- M1 World Map and Supply tests: 70 cutover assertions and 11 preflight cases; same-map AUTO_FARM, teleport presentation, teleport policy and fog eligibility source tests passed.
- Discord source tests: 11 flow checks and 19 identity-store tests. Support session, fixture command, Admin quarantine recovery, Admin control and Admin security source tests passed.
- Player scenario runner dry-run source test: 23 checks.
- Node syntax and `git diff --check` passed. No endpoint or Browser acceptance was run.

`UNEXPLAINED_PRODUCTION_ONLY_CAPABILITY = 0` for this bounded source and runtime-artifact inventory. `WEB_ACCEPTED_CAPABILITIES_MISSING = 0` for the source capabilities and exact deployment-preserved runtime assets listed above. Production and Browser acceptance remain unmeasured for this checkpoint.
