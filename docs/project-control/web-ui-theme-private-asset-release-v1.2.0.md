# UI Theme Private Asset Release v1.2.0

`WORKLINE_ID = WEB_UI_THEME_PRIVATE_ASSET_RELEASE_V1_2_0`

## Status

| Field | Value |
| --- | --- |
| Release | `web-runtime-assets-v1.2.0` |
| Repository | `amadiz1988-boop/ghost-island-assets` (private) |
| Release ID | `396406644` (immutable, published 2026-09-25T07:42:22Z) |
| Base | `web-runtime-assets-v1.1.0` (5107 assets, unchanged) |
| Asset count | 5139 (5107 + 32 UI theme assets) |
| Package SHA256 | `3d756f09a31bd0f254b6a1296b6850848bf96918fe1c416c48cd63b1aadf3f34` |
| Manifest SHA256 | `17744c6acf75363d819b4b5b4e996da874fde87569559b45e7d7e6696f3eb787` |
| Archive | `ghost-island-web-runtime-assets-v1.2.0.zip`, 96116049 bytes, `13ed604b844b152d8c3c749bc104f12f81030e59b7042598a8d0a13b594a61b3` |
| Web source of theme art | `be2254139ba41856ebd58f78aa5bd83203985e3a` |
| State | `READY_FOR_NEXT_UI_THEME_PROMOTION` |
| Production pin | still `web-runtime-assets-v1.1.0` |

Identity files: `web-runtime-private-release-v1.2.0.json`,
`web-runtime-asset-package-lock-v1.2.0.json`,
`web-runtime-assets-manifest-v1.2.0.json`. The Production-pinned `*-v1.json`
files and `production-release-authority.json` are unchanged.

## UI_THEME_PRODUCT_SCOPE_V1

```text
THEME_SERIES_COUNT            = 1   (無職轉生)
HEROINE_THEME_COUNT           = 4   (洛琪希, 艾莉絲, 希露菲, 妓神)
PLAYER_SELECTABLE_THEME_COUNT = 5   (Default + 4 heroine themes)
LICENSED_SOURCE_FILE_COUNT    = 16  (rotating image variants: 2 + 3 + 7 + 4)
RUNTIME_ASSET_FILE_COUNT      = 32  (each source -> panel.webp + thumb.webp)
DEFAULT_THEME_REQUIRES_PRIVATE_ASSET = NO
ACCESS = ALL_PLAYERS (no Donate gating in this release)
```

16 is the number of source image variants, never a theme count. Default is
the current RO UI and uses no licensed image. This record is also embedded in
the release manifest (`ui_theme_scope`), package provenance and release notes.

## License And Provenance

License authority for all 16 sources: `USER_PROVIDED_LICENSED_IMAGE`. The
project owner supplied them as licensed images for this UI
(`UI_THEME_SYSTEM_V1`); private release approved by Project Control. Source
bytes stay in the owner's private folder; derived runtime bytes live only in the
private release. `PUBLIC_GIT_LICENSED_IMAGE_COUNT = 0`.

Runtime directory: `ops/ro-stack/dashboard/assets/ui-themes/<theme>/<variant>/`.

| Theme | Source ID | Source (folder/file, SHA256 prefix) | Panel | Thumb |
| --- | --- | --- | --- | --- |
| 洛琪希 | `roxy-01` | `洛琪希/c045cdf28e2ca83bbc74fe6be3ff29d1.jpg` (`b3195a7fa049`) | `heroine-roxy/roxy-01/panel.webp` | `heroine-roxy/roxy-01/thumb.webp` |
| 洛琪希 | `roxy-02` | `洛琪希/9eecfaff37ba2693b7e031b6d799336f.jpg` (`958d114deabe`) | `heroine-roxy/roxy-02/panel.webp` | `heroine-roxy/roxy-02/thumb.webp` |
| 艾莉絲 | `eris-01` | `艾莉絲/ddb7bc2bf6b79fbc82548378758357ad.jpg` (`eb0da6241ea9`) | `heroine-eris/eris-01/panel.webp` | `heroine-eris/eris-01/thumb.webp` |
| 艾莉絲 | `eris-02` | `艾莉絲/663b54c4f68c7fe1724488ec88ed6234.jpg` (`48f3016cea03`) | `heroine-eris/eris-02/panel.webp` | `heroine-eris/eris-02/thumb.webp` |
| 艾莉絲 | `eris-03` | `艾莉絲/f92c50f303039627552b1ba78d846378.jpg` (`af7280abb574`) | `heroine-eris/eris-03/panel.webp` | `heroine-eris/eris-03/thumb.webp` |
| 希露菲 | `sylphie-01` | `希露菲/06cc5fe89ada3d9a962a6570437eab07.jpg` (`b3b27c4db48f`) | `heroine-sylphie/sylphie-01/panel.webp` | `heroine-sylphie/sylphie-01/thumb.webp` |
| 希露菲 | `sylphie-02` | `希露菲/02ae80f610c331c7a99aed5a08f318ea.jpg` (`c8c3d04981e8`) | `heroine-sylphie/sylphie-02/panel.webp` | `heroine-sylphie/sylphie-02/thumb.webp` |
| 希露菲 | `sylphie-03` | `希露菲/5c6339d5b48509664760f162422530b4.jpg` (`0916953a0195`) | `heroine-sylphie/sylphie-03/panel.webp` | `heroine-sylphie/sylphie-03/thumb.webp` |
| 希露菲 | `sylphie-04` | `希露菲/bd6250666ddfa8c5e8439e880e92543f.jpg` (`4e581a207eb6`) | `heroine-sylphie/sylphie-04/panel.webp` | `heroine-sylphie/sylphie-04/thumb.webp` |
| 希露菲 | `sylphie-05` | `希露菲/bfd47cb9951349d5b5fdd042a679c623.jpg` (`3937fc7592d1`) | `heroine-sylphie/sylphie-05/panel.webp` | `heroine-sylphie/sylphie-05/thumb.webp` |
| 希露菲 | `sylphie-06` | `希露菲/e55ab17073ff899da5ee1ab7ba1c85f3.jpg` (`253ac2a5bb49`) | `heroine-sylphie/sylphie-06/panel.webp` | `heroine-sylphie/sylphie-06/thumb.webp` |
| 希露菲 | `sylphie-07` | `希露菲/ef8fcd911bbfd5884c72724dff0a5073.jpg` (`52ce94190327`) | `heroine-sylphie/sylphie-07/panel.webp` | `heroine-sylphie/sylphie-07/thumb.webp` |
| 妓神 | `red-01` | `妓神/HS87GmbbIAAHCu_.PNG` (`7f41f3f0a825`) | `heroine-red-dress/red-01/panel.webp` | `heroine-red-dress/red-01/thumb.webp` |
| 妓神 | `red-02` | `妓神/V7hBi9W.jpg` (`f43a9a15b7f3`) | `heroine-red-dress/red-02/panel.webp` | `heroine-red-dress/red-02/thumb.webp` |
| 妓神 | `red-03` | `妓神/pqdyayrp0frh1.jpg` (`b22f3f8976ce`) | `heroine-red-dress/red-03/panel.webp` | `heroine-red-dress/red-03/thumb.webp` |
| 妓神 | `red-04` | `妓神/thumbnail.jpg` (`8bd83a3b2c68`) | `heroine-red-dress/red-04/panel.webp` | `heroine-red-dress/red-04/thumb.webp` |

## Packaging Rules

The asset allowlist admits only
`ops/ro-stack/dashboard/assets/ui-themes/heroine-<id>/<name>-NN/{panel,thumb}.webp`
(`UI_THEME_ASSET_PATH` in `scripts/materialize-web-runtime-assets.mjs` and
`scripts/fetch-web-runtime-private-release.py`). No other dashboard asset
directory is admitted. New provenance kind:
`USER_PROVIDED_LICENSED_UI_THEME_DERIVATIVE`.

Build: `python scripts/build-ui-themes.py --verify`, then
`node scripts/build-web-runtime-asset-package-v1.2.0.mjs --base-package <verified v1.1.0 package> --package <new dir> --web-head <sha>`.
The builder verifies the v1.1.0 base, each output hash against
`ui-themes-manifest-v1.json`, and each variant version against
`ops/ro-stack/dashboard/ui-theme.js`.

Verify the remote release:
`python -B scripts/fetch-web-runtime-private-release.py --checkout . --release-config web-runtime-private-release-v1.2.0.json --lock web-runtime-asset-package-lock-v1.2.0.json --manifest web-runtime-assets-manifest-v1.2.0.json --destination <new dir>`.

## Pin Switch (later, separate workline)

Only after F completes the first GitHub-first promotion and releases the
Production deployment lease:

1. Replace the three `*-v1.json` identity files with the v1.2.0 contents.
2. Update `production-release-authority.json` `assets` to the v1.2.0 identity.
3. Promote Web at a `main` SHA that contains the UI theme source; the complete
   manifest then includes all 32 UI theme paths as `PRIVATE_ASSET_RELEASE`.