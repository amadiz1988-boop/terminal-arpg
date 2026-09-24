# Private Web runtime asset package V1

Input Web checkpoint: `6aab887d2938f1fc59005d2478dfed58e04e7b1e`.
This document records a local private asset delivery source. It does not authorize
asset publication or Production deployment.

## Canonical local package

- Package ID: `ghost-island-web-runtime-assets-v1`; version: `1.0.0`.
- Location: `C:\Users\Administrator\.codex\private-assets\ghost-island-web-runtime-assets-v1-verified`.
- Manifest: `docs/project-control/web-runtime-assets-manifest-v1.json`; 3,267 required paths.
- Manifest SHA-256: `db44144b004d9665427d2ea580a043b33c2c2221d8ea7b914467568b3e1818cc`.
- Asset tree SHA-256: `6d16b78ba31965c34f58898c19f7a4938be261157c6e19716a949f8de24b1226`.
- Package SHA-256: `dd8a605fc288f8ae343be620115450077d0f70003be131101c8d143daf16b5bf`.

`PACKAGE_SHA256` is a canonical directory digest of the three package metadata
files and the manifest's hashed asset tree. It is pinned in
`web-runtime-asset-package-lock-v1.json`. This content digest, complete file
hash verification, and a versioned path make mutation detectable. The package
contains `asset-package.json`, `manifest.json`, `provenance.json`, and exactly
3,267 files under `assets/public/ro/client/`. It is outside Production and
outside the public Git working tree.
The checkout manifest is checked after CRLF-to-LF normalization so a Windows
Git checkout verifies against the same pinned manifest bytes.

## Source reconciliation

The existing extracted Client/Web asset corpus at the canonical Web working
tree supplied 3,257 exact-hash files. Ten missing Knight body images were
recovered from the exact Git blob IDs recorded in the manifest. All 3,267
source bytes matched the manifest's size and SHA-256 before packaging.
Production was not used as an input.

The authorized local Client root is
`C:\Program Files (x86)\Gravity\RagnarokOnline`. Its `Ragnarok.exe`,
`data.grf`, `data0.grf`, and `event.grf` SHA-256 values matched the recorded
Client snapshot. The 791 entries classified `AUTHORIZED_CLIENT_SOURCE`
matched exact source bytes in the extracted corpus; the 16 BGM files also
matched the installed Client `BGM` files directly. The other 775 BMP files
have accepted extracted-corpus and historical Git/import provenance. This
run did not independently re-extract all 775 BMP files from GRF archives.

The original manifest labeled 2,476 derived outputs
`GENERATED_REPRODUCIBLE`. An exact historical Git blob or a generator name
does not prove byte-for-byte reproduction. No complete per-family generator
input, pinned generator version, and rerun hash comparison was available for
all 2,476, so the manifest now classifies them `PRIVATE_PACKAGE_REQUIRED`.
`GENERATED_BYTE_REPRODUCIBLE_COUNT=0` is the verified count for this run;
all 3,267 assets are delivered by the package.

| Derived family | Count | Known source or generator candidate | Byte reproduction |
| --- | ---: | --- | --- |
| `collection/*.png` | 358 | Client collection BMP; extraction and BMP conversion scripts | Unverified |
| `items/*.png` | 416 | Client item BMP; `convert-ro-item-icons.mjs` and `convert-bmp-transparent.ps1` | Unverified |
| `maps/*.png` | 1 | Client map/minimap extraction scripts | Unverified |
| `monsters/*.webp` | 128 | Client monster sprites; renderer/input version not pinned here | Unverified |
| `npcs/*` | 3 | Client NPC sprites and manifest; renderer/input version not pinned here | Unverified |
| `showcase/body/*.png` | 10 | Client sprites; `build-ro-character-showcase.mjs`, plus exact historical blobs | Unverified |
| `showcase/equipment/*.png` | 1,558 | Client sprites; equipment renderer/input version not pinned here | Unverified |
| `showcase/ui/*.png` | 2 | `build-ro-character-showcase.mjs` controls | Unverified |

The manifest is the path and expected-hash rule for every output. This table
identifies the known generator family without claiming a verified version or
repeatable byte result. The private package supplies exact bytes in every
family.

## Local materialization

From a clean checkout containing the manifest, lock, and tool:

```powershell
node scripts/materialize-web-runtime-assets.mjs --mode materialize --checkout . --asset-package 'C:\Users\Administrator\.codex\private-assets\ghost-island-web-runtime-assets-v1-verified'
```

The tool rejects a missing package, wrong package or manifest digest, missing
or modified asset, extra package asset, and conflicting checkout asset before
copying. It never falls back to Production. The package can be rebuilt from
the recorded exact source corpus and Client snapshot with
`scripts/build-web-runtime-private-asset-package.mjs`; its builder must target
a new empty private directory.

## Clean checkout proof

An isolated checkout of Web source `6935bbea0749647818d3ef4d60fa8b7c4e017d69`
was clean before materialization. The first materialization attempt at
`22369286dc50ae1923f83381a9a4221d09505ec7` stopped before copying because
Windows Git had converted the checkout manifest to CRLF. The later source
checkpoint normalizes manifest line endings for hash comparison. Its clean
checkout materialized all 3,267 paths and then verified:

```text
MISSING_ASSET_COUNT = 0
HASH_MISMATCH_COUNT = 0
UNMANIFESTED_REQUIRED_ASSET_COUNT = 0
FRESH_CHECKOUT_REQUIRED_ASSETS = PASS
```

Thirteen bounded offline source programs passed after materialization:
`test-web-full-production-superset` (309 checks),
`test-world-map-supply-cutover`, `test-world-map-teleport-presentation`,
`test-auto-farm-same-map-start`, `test-ro-skill-tree-layouts`,
`test-ro-skill-icons`, `test-server-ops-admin-control`,
`test-admin-quarantine-recovery`, `test-active-web-entrypoint`,
`test-world-map-teleport`, `test-supply-service-route-controller`,
`test-farm-map-supply-synthetic`, and `test-m1-attack-skill-profile`.
They cover World Map, Supply, same-map AUTO_FARM, teleport presentation,
Skill Tree, skill assets, original button audio, Admin recovery, the Admin
host boundary, and the active Web canary at source level.

`test-supply-cycle-ui`, `test-class-attack-skills-ui`, and
`test-skill-automation-ui` stopped while opening an absent local credential
fixture. `test-onboarding-recovery-ui` stopped while opening absent local
secrets. These are credentialed live/browser programs and did not enter their
test flows. `test-player-security` was not run because it contacts the 8788
endpoint. No Production endpoint was contacted in this proof. The 13 offline
passes do not assert Browser or Production acceptance.

## Future private remote

Recommended model: a versioned archive attached to a release in an explicitly
authorized private GitHub asset repository, with GitHub's
[immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
enabled before publication. GitHub documents release assets as files attached
to a release, with a per-file limit of 2 GiB
([About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)).
Pin the archive SHA-256 and retain
the manifest and lock in the public source repository. The archive would carry
the already verified directory package; unpack it to a private local path
before materialization. Repository creation and asset publication are not
authorized by this task. Git LFS and binary commits to the public repository
are not used.
