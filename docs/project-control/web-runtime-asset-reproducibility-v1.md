# W2 Web runtime asset reproducibility, 2026-09-24

## Follow-up: private local package

`web-runtime-private-asset-package-v1.md` records the completed local package,
its pinned manifest and package digests, and the source reconciliation. The
2,476 formerly labeled `GENERATED_REPRODUCIBLE` are now
`PRIVATE_PACKAGE_REQUIRED` until byte-identical regeneration is proved. The
historical pending status below describes the earlier W2 checkpoint.

## Scope and evidence

Input Web commit: `1ca72777e2f7837ffd27a0793a3732d3c2f96eee`. The read-only Production census found 3,269 files in `public/ro/client` absent from that commit, totaling 56,081,686 bytes. The exact path, size, SHA-256, extension, and source evidence for each file are in `web-runtime-assets-manifest-v1.json`. Production supplied accepted runtime bytes and hashes for the census; it has no source or delivery authority.

The required private package has 3,267 files. The other two census files, `public/ro/client/showcase/equipment/thief-male-bow-front-attack.png` and `public/ro/client/showcase/equipment/thief-female-bow-front-attack.png`, are absent from the tracked showcase manifest and scoped Web references. They are generated outputs outside the required deploy payload. They are listed in the manifest's `excluded_assets` and are not a permanent requirement.

The 3,267 required entries comprise 791 Client-source assets and 2,476 generated or derived assets. These labels classify origin; they do not claim byte-for-byte reconstruction has passed. Evidence for 2,711 entries is an exact blob in local Git history, 16 BGM entries match the authorized local Client byte-for-byte, and the remainder have accepted Client import, archive, or tracked showcase manifest references. Some historical blobs are on other local refs, so they do not establish a clean checkout or remote delivery path. Every required entry has a known provenance class. No new licensed binary asset is committed here.

The authorized Client snapshot used for provenance is the local Ragnarok Online installation. Its executable, `data.grf`, `data0.grf`, and `event.grf` hashes are recorded in the machine manifest. The Client location on a deployment host has not been formally designated. Its local presence cannot establish a deployment contract.

## Six previously deployed-only files

All six paths are tracked at the input Web commit. Their earlier deployment without a source checkpoint remains a historical deployment protocol violation. Current canonical source is the input Git commit, with the following accepted Production hashes and provenance:

| Path under `ops/ro-stack/dashboard` | Production SHA-256 | Function and source evidence | Required |
| --- | --- | --- | --- |
| `admin/server-ops.css` | `d1d257f872917043003bfe94e38d10444c5183a457cb7308027e35391a6f764d` | Admin operations presentation; source reconstruction tracked at input commit, Production visual evidence | Yes |
| `admin/server-ops.html` | `4afc69fe435ca553dc4a3a0b90d130f1ce3a13e6395c309652567828bb9d5709` | Admin operations markup; source reconstruction tracked at input commit, Production visual evidence | Yes |
| `assets/pets/angeling/walk.webp` | `8b07d6101ec2aebd03a63283f3afa12baecea7cd65d87d4a8e004cd92a5a7609` | Pet animation; byte-identical to tracked species `run.webp`, local Client ACT/SPR provenance in pet manifest | Yes |
| `assets/pets/baphomet/walk.webp` | `c745b923904db5c5b9300702233f21185de8d1d601f15c02ad9b8e80bc38e5a2` | Pet animation; byte-identical to tracked species `run.webp`, local Client ACT/SPR provenance in pet manifest | Yes |
| `assets/pets/moonlight/walk.webp` | `111d38b2bc1d58029e4c18d87189c1dd1c491f7962449a365a20da50f7a51dab` | Pet animation; byte-identical to tracked species `run.webp`, local Client ACT/SPR provenance in pet manifest | Yes |
| `assets/pets/terasoid/manifest.json` | `79a86c76f018880ae4f0d6cbe071130b5234727ab26bf4ca7e9e8d1e49f81dd0` | Pet source map; five named Stone Age Client source files matched their recorded hashes, tracked at input commit | Yes |

## Delivery contract and remaining gate

The repository is public and has no existing Git LFS assets or private asset registry. Asset publication authorization is `UNRESOLVED`. The chosen delivery model is a **private canonical asset package**, pending a formally designated private source. The package must contain `assets/public/ro/client/...` for all 3,267 required entries and an `asset-package.json` marker with schema version 1, `source_authority` equal to `PRIVATE_CANONICAL_ASSET_PACKAGE`, the manifest asset count, immutable `asset_tree_sha256`, and a nonempty approval reference. The expected tree hash is `6d16b78ba31965c34f58898c19f7a4938be261157c6e19716a949f8de24b1226`.

`scripts/materialize-web-runtime-assets.mjs` verifies the complete package before copying absent files into a clean checkout. It fails on missing, mismatched, or unmanifested assets, package links and special files, checkout conflicts, and Production as package source or target. It never reads Production to fill a gap. The Git-tracked manifest and script establish a deterministic **contract**. They cannot establish successful materialization until the private package exists and passes verification.

Current clean checkout status: 3,267 required package assets missing, zero hash mismatches, zero unmanifested required assets. Therefore `FRESH_CHECKOUT_REQUIRED_ASSETS=FAIL` and `WEB_RUNTIME_ASSET_REPRODUCIBLE=NO`. A private source designation, completed package, and clean checkout byte verification are required before Web candidate deployment. Production remains unchanged.

An independent detached checkout of the asset checkpoint passed 18 of 18 selected offline Web source test programs, including World Map, Supply, same-map AUTO_FARM, teleport presentation, skill tree and icons, original button audio, Admin recovery and control, and the active Web entrypoint canary. The separate player security test needs a local credential fixture absent from this checkout and was not counted as passed. The checkout was clean before and after testing.

A read-only payload inventory compared 2,156 tracked Dashboard and Client paths in the candidate with current Production: 2,097 byte matches, 31 byte differences, and 28 candidate paths absent from Production. The 31 differences include Web modules and four Client manifest files. The 28 additions include current source modules, assets, and archived proof-of-concept files; they require the existing exact deployment manifest review before use. Production has 23 additional Dashboard files previously classified as backup or pet candidate/preview artifacts. The decisive missing deployment capability is the 3,267 required Client asset files. No complete deploy payload can be marked `MATCH` while these bytes remain absent from the candidate.

The source Web asset indices were aligned with accepted Production metadata: the item Client manifest gained the 416 missing icon records and matching derived records, and the showcase manifest gained the two accepted Knight body entries. These are metadata changes only. The `damage` manifest differs by a byte-order mark, and the source combat sound manifest has one additional entry. Neither difference removes a required binary asset. Other Dashboard code differences are outside this asset workline and retain their existing canonical source.

The Dashboard manifest deploy tool has a 256-path limit. The 3,267-file private package needs a separately reviewed, exact-hash private asset placement procedure before F can deploy. This workline does not deploy or change that tool.
