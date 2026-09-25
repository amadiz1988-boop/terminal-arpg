# UI Background Theme System V1

`TASK_ID = UI_BACKGROUND_THEME_SYSTEM_V1`

The Player Web keeps its simple RO original style. A UI background theme only
adds atmosphere behind that UI. It is a player preference and never a second
interface.

## Canonical Source

| Concern | Source |
| --- | --- |
| Theme registry, persistence, page policy, entitlement hook | `ops/ro-stack/dashboard/ui-background-theme.js` |
| Layer and title bar rules | `ops/ro-stack/dashboard/ui-background-theme.css` |
| Settings selector mount | `#uiBackgroundTheme` in the System page 背景設定 window of `ops/ro-stack/dashboard/index.html` |
| Asset provenance and hashes | `docs/project-control/ui-background-themes-manifest-v1.json` |
| Asset build and verification | `scripts/build-ui-background-themes.py` |
| Regression | `scripts/test-ui-background-theme.mjs` |

## Scope

A theme may change only these layers on every Player Web page:

1. The fixed page background behind all content, including the top brand row.
2. The blue window title bar, where the image shows through the original
   `#9bb0c9 → #546d8b` gradient at no more than 14% visibility.
3. A single decorative page layer (`body::before`) with `z-index: -1` and
   `pointer-events: none`.

A theme must not restyle window bodies, panels, tabs, buttons, inputs, selects,
text, combat logs, minimaps, or dialogs. Windows keep their opaque RO skins, so
images never sit under text or controls. The login stage keeps its RO original
art above the layer.

## Default Rule

The default theme is `default`, which is the current RO floor background. A
player sees a heroine theme only after choosing it. Unknown, inaccessible, or
missing themes resolve to `default`. The choice is stored per device in
`localStorage` key `ghost-island.ui-background-theme.v1`, alongside the RO
floor preference.

## Images Per Theme

Each theme uses every licensed image in its source folder. The settings page
shows a second row for the chosen theme:

- `輪換` (default): each visit shows the next image of that theme.
- A numbered image: the player pins that image.

Preferences live in `ghost-island.ui-background-theme-variant.v1`; the last
rotated image lives in `ghost-island.ui-background-theme-rotation.v1`. The
image changes only on a new visit or on a player click, never while a page is
in use.

## Page Safety

Pages set `data-ui-bg-page` through the global tab hook. `pagePolicy` maps a
page to one level:

| Level | Behavior |
| --- | --- |
| `full` | Image layer with a 34% dark overlay. |
| `soft` | Stronger overlay and lower opacity. Used for the busy Hunt page. |
| `bar-only` | Tint only; title bars keep the theme. Used while the world map overlay is open. |

New pages that need less image use this policy table. They never get separate
per-page image styles.

Phones and portrait windows use the tall image and a stronger overlay. The
desktop image is a 16:9 composite: a smooth colour wash sampled from the source
on the content side, and the full character portrait on the right gutter.

## Asset Rules

1. Only user-provided licensed images are used. The source folder and file
   SHA-256 are recorded in the manifest.
2. Binaries live in `ops/ro-stack/dashboard/assets/ui-themes/<theme-id>/`,
   which is ignored by Git. Public Git never contains the images.
3. Each image variant has `background-wide.webp` (1920x1080),
   `background-tall.webp` (900x1600) and `thumb.webp` (240x150) under
   `<theme-id>/<variant-key>/`. Portrait sources become a colour wash plus the
   portrait on the right; landscape sources are cropped to the frame. An
   optional `crop` box removes collage panels or subtitles. The registry
   version for each file is the first eight characters of its manifest SHA-256.
4. To add a theme or image: add the variant to the manifest, run
   `python scripts/build-ui-background-themes.py --source-root <dir> --write-hashes`,
   add the registry entry with the new versions, and run the regression.
5. `--verify` checks the private asset directory against the manifest before
   delivery. Production delivery of these files must use the private asset
   package process, not public Git.
6. If an image is missing at runtime, it is skipped. If every image of a theme
   is missing, the theme card is disabled and a saved choice falls back to
   `default`.

## Supporter Extension

Every theme has `access` and `entitlement`. V1 themes are `OPEN` for every
player. A future supporter theme uses another `access` value and an
`entitlement` id; it becomes visible only after the server provides that id
through `GhostIslandUiBackgroundTheme.setEntitlements()`. Entitlement grants
must come from server authority; the client never grants them.

## Current Themes

| Theme | Series | Label | Images |
| --- | --- | --- | --- |
| `default` | none | 目前主題 | RO floor |
| `heroine-roxy` | 無職轉生 | 洛琪希 | 2 |
| `heroine-eris` | 無職轉生 | 艾莉絲 | 3 |
| `heroine-sylphie` | 無職轉生 | 西露菲 | 7 |
| `heroine-red-dress` | 無職轉生 | 紅衣短髮女 | 4 |
