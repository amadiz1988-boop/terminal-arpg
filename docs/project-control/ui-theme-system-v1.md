# UI Theme System V1

`TASK_ID = UI_THEME_SYSTEM_V1` (replaces the page background approach from
`UI_BACKGROUND_THEME_SYSTEM_V1`, which was never deployed)

A UI theme restyles the RO windows themselves. The page background stays the
RO floor tile chosen in 背景設定; the two settings are independent.

## Canonical Source

| Concern | Source |
| --- | --- |
| Theme registry, persistence, rotation, entitlement hook | `ops/ro-stack/dashboard/ui-theme.js` |
| Window surfaces, veils and title bar colours | `ops/ro-stack/dashboard/ui-theme.css` |
| Settings window | The `UI 主題` window (`#uiTheme`, `#uiThemeVariants`) above 背景設定 on the System page of `ops/ro-stack/dashboard/index.html` |
| Asset provenance, colours and hashes | `docs/project-control/ui-themes-manifest-v1.json` |
| Asset build and verification | `scripts/build-ui-themes.py` |
| Regression | `scripts/test-ui-theme.mjs` |

## What A Theme Changes

1. Title bars of every game window use the heroine's colour, keeping the RO
   light-to-dark gradient and white bold text.

   | Theme | Top | Bottom |
   | --- | --- | --- |
   | 預設 | `#9bb0c9` | `#546d8b` |
   | 洛琪希 | `#7d86c8` | `#3a3f86` |
   | 艾莉絲 | `#d9776a` | `#9a2a24` |
   | 希露菲 | `#9cb77a` | `#4f6d33` |
   | 妓神 | `#c77a8a` | `#7c2438` |

2. Window bodies of these surfaces show soft art on the right:

   | Surface | Selector | Treatment |
   | --- | --- | --- |
   | 基本訊息視窗 | `#game > .window[data-pet-anchor='character-summary']` | light |
   | 對話欄 | `#game > .social-window` | light |
   | 掛機頁 windows | `#hunt > .window:not(.map-window, .combat-window)` | light |
   | 系統頁 windows | `#system > .window` | light |
   | 戰鬥終端 (LOG) | `.combat-window .console` | log |

   Light: white veil at 94% on the left, 90% at 42%, 50% on the right edge.
   Log: the terminal stays black; a 97%/93%/60% dark veil keeps the art dim on
   the right, and log lines get a dark text shadow. Phones (≤700px) use larger
   art (at least 320px tall) and a lighter right edge (28% light, 45% log) so
   the heroine stays visible in narrow windows; the left 30% keeps a 90% veil.

To add or remove a surface, edit that single selector list in `ui-theme.css`.
Do not add page-specific image rules elsewhere.

## Readability Rules

- Text readability wins over art. The left part of every surface stays at or
  above a 90% veil; the regression checks this.
- Art is pre-blurred (soft focus) and its left 60% fades to transparent, so it
  never shows a hard edge behind text.
- The minimap, inputs, buttons, tabs and chat bars keep their own backgrounds.
- The page floor, the login screen and pages outside the table are unchanged.

## Default Rule

`default` is the current RO UI. A player sees a heroine theme only after
choosing it in `UI 主題`. Unknown, inaccessible or missing themes resolve to
`default`. The choice is stored per device in `ghost-island.ui-theme.v1`.

## Images Per Theme

Each theme uses every licensed image in its source folder. There is no image
picker: the next image of the chosen theme appears on every visit and every
page (tab) switch, in manifest order. Clicking the already open tab does not
change it. The last shown image per theme lives in
`ghost-island.ui-theme-rotation.v1`, so rotation continues across visits.

## Asset Rules

1. Only user-provided licensed images are used. Each variant records its
   source folder, file and SHA-256 in the manifest.
2. Binaries live in `ops/ro-stack/dashboard/assets/ui-themes/<theme>/<variant>/`,
   ignored by Git. Public Git never contains the images.
3. Each variant has `panel.webp` (608x760, soft focus, left alpha fade) and
   `thumb.webp` (240x150). An optional `crop` box removes collage panels or
   subtitles; `focus` picks the subject. Registry versions are the first eight
   characters of each output SHA-256.
4. To add an image: add the variant to the manifest, run
   `python scripts/build-ui-themes.py --source-root <dir> --write-hashes`,
   update the registry versions, and run the regression.
5. `--verify` checks the private asset directory before delivery. Production
   delivery must use the private asset package process.
6. A missing image is skipped. If every image of a theme is missing, its card
   is disabled and a saved choice falls back to `default`.

## Supporter Extension

Every theme has `access` and `entitlement`. V1 themes are `OPEN`. A future
supporter theme uses another `access` value and becomes selectable only after
the server provides its entitlement through `GhostIslandUiTheme.setEntitlements()`.
The client never grants entitlements.

## Current Themes

| Theme | Series | Label | Images |
| --- | --- | --- | --- |
| `default` | none | 預設 | none |
| `heroine-roxy` | 無職轉生 | 洛琪希 | 2 |
| `heroine-eris` | 無職轉生 | 艾莉絲 | 3 |
| `heroine-sylphie` | 無職轉生 | 希露菲 | 7 |
| `heroine-red-dress` | 無職轉生 | 妓神 | 4 |

Source folders are named after the player-visible labels (洛琪希, 艾莉絲,
希露菲, 妓神).

A variant may also set `fade` (default 0.6), the share of the panel width
that fades in from the left. `eris-02` crops away its vertical title text and
uses `fade: 0.35` so more of the heroine shows on the right.
