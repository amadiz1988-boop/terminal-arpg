# Supply Settings V2 isolated UI

TASK_ID = `SUPPLY_SETTINGS_V2_ISOLATED_UI_V1`

## Scope and reuse gate

`PRE_IMPLEMENTATION_REUSE_GATE = PASS` is recorded in `reuse-gate.json` and evaluated with the repository reuse-gate script. The page is an isolated browser presentation fixture. It does not modify PA, rAthena, Stage2, Production DB, Production config, or the formal Player Web supply endpoint.

Reuse decisions:

- `CURRENT_UI_REUSE`: existing Supply form labels, read model fields, local dashboard supply rule vocabulary, and the existing `ro-ui-kit.css` / `ro-ui-kit.js` primitives.
- `CURRENT_RUNTIME_REUSE`: existing `supplyCycle` read model, `normalizeSupplyCycle` bounds, server-authoritative Supply Journey, service route, return-to-farm, and resume behavior.
- `LEGACY_REUSE`: OpenKore harvest records for `buyAuto`, `sellAuto`, `storageAuto`, item rules, timeout and behavior contracts only.
- `OPENKORE_REUSE`: `ok-storageauto` and `ok-buy-sell` registry entries, `ADAPT_PATTERN`; no OpenKore runtime or source is added.
- `ROBROWSER_UI_REUSE`: `REFERENCE_ONLY`; no roBrowserLegacy code is copied.
- `BUILD_NEW_WHY_NOT_REUSE`: only the missing player-facing presentation layer and local read-only preview model are built.

## Runtime capability matrix summary

| Capability | Current fact | UI treatment |
| --- | --- | --- |
| Supply enabled / weight trigger | Existing supply-cycle contract; runtime bounds 40–88 | Supported control in local preview |
| Red Potion min / target | Existing `buyAuto 501` mapping and `current < min` guard | Supported quantity row |
| Arrow min / target | Item semantics are clear; no current per-player native save contract | Preview-only quantity row |
| Butterfly Wing / Fly Wing | Existing permanent tool policy and authoritative movement semantics | Presence-based, 「持有即可」 |
| NPC buy, sell, storage, return, resume | Existing Supply Journey evidence and route/service contracts | Supported labels and read-only preview |
| Per-player Production save | Formal endpoint fails closed for SERVER_AGENT (`CAPABILITY_NOT_NATIVE`) | Local-only 「套用預覽設定」 |
| Service priority / coordinate editing | Route details are runtime-owned | Disabled concept preview; no map coordinates |

## Semantic rules

- `QUANTITY_BASED`: `current`, `min`, `target`; trigger is `current < min`, restore toward `target`.
- `PRESENCE_BASED`: `nonConsumable === true && weight === 0`; quantity inputs are omitted and presence is shown.
- Butterfly Wing and Fly Wing are rendered as presence-based tools. Quantity unchanged is accepted as a valid authoritative result.

## Browser preflight checklist

- [x] Source contains RO window/title/button/checkbox/select primitives and verified Default Skin asset references.
- [x] Source contains basic supply, quantity-based items, presence-based tools, loot handling, return/resume, journey preview, and advanced rules.
- [x] Add-item dialog source blocks duplicate rules.
- [x] Static validation covers weight 40–88, `min >= 0`, and `target >= min`.
- [x] Actual Chrome 390×844 viewport has `scrollWidth = clientWidth = 375` and no overflowing element.
- [x] Source saves only to `localStorage` and marks the page `PREVIEW DATA`.
- [x] Actual Chrome desktop and 390×844 screenshots show the RO frame, verified skin assets, item rows, dialog, and responsive layout.

## Verification status

`RO_ASSET_INDEX_SCHEMA_PASS = PASS`<br>
`REUSE_GATE = PASS`<br>
`JAVASCRIPT_SYNTAX = PASS`<br>
`STATIC_UI_CONTRACT = PASS`

`ISOLATED_PREVIEW_SERVER = PASS`<br>
`DESKTOP_BROWSER_UI = PASS`<br>
`MOBILE_390X844 = PASS`<br>
`QUANTITY_BASED_BROWSER = PASS`<br>
`PRESENCE_BASED_BROWSER = PASS`<br>
`ADD_ITEM_DIALOG = PASS`<br>
`DUPLICATE_RULE_BLOCK = PASS`<br>
`LOOT_RULE_UI = PASS`<br>
`RETURN_RESUME_UI = PASS`<br>
`SUPPLY_JOURNEY_PREVIEW = PASS`<br>
`PRODUCTION_API_CALL_COUNT = 0`<br>
`ISOLATED_SAVE_MODEL = PASS`<br>
`BROWSER_UI_PASS = PASS`

The isolated host serves only this PoC directory plus read-only mappings to verified `public/ro` assets at `127.0.0.1:8791`. Browser activity contained static asset GETs and one local `/api/ro-assets` metadata GET from the resolver; no Production mutation endpoint, POST, command, DB, PA, or rAthena activity occurred. The canonical Dashboard on `127.0.0.1:8788` remains untouched.

## Files

- `index.html`
- `app.js`
- `styles.css`
- `reuse-gate.json`
- `RESULTS.md`

TEST_PAGE = `ops/ro-stack/dashboard/poc/supply-settings-v2/index.html`
PREVIEW_URL = `http://127.0.0.1:8791/poc/supply-settings-v2/index.html`
GIT_CHECKPOINT = `CREATED_SEPARATELY; see final report for commit id`
READY_FOR_PRODUCT_OWNER_REVIEW = YES
READY_FOR_PRODUCTION_INTEGRATION = NO
PRODUCTION_TOUCHED = NO
PA_TOUCHED = NO
RATHENA_TOUCHED = NO
RUNTIME_RESTARTED = NO
