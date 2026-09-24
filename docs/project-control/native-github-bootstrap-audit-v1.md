# Native GitHub bootstrap audit V1

Audit date: 2026-09-24. Proposed private repository: `amadiz1988-boop/ghost-island-rathena`, canonical branch `main`. Creation and first push are **blocked by the user's pre-publication gates**. This record contains no credential, account, character, or email values.

| Git fact | Observed value |
| --- | --- |
| `NATIVE_LOCAL_HEAD` | `de168f566325f140c87b355a1d442dddabf0b8ad` |
| `CURRENT_NATIVE_BRANCH` | `integration/p2-openkore-exit-native-v1` |
| `CURRENT_REMOTES` | `origin` only |
| `origin` fetch/push URL | `C:\Users\Administrator\ghost-island-source-backup\rathena-p2-native.bundle` |
| `M1_NATIVE_HEAD_PRESENT` | `YES`; HEAD is the specified M1 candidate |
| `FULL_HISTORY_CONNECTED` | `YES` after fetching missing ancestors from `https://github.com/rathena/rathena.git` |
| `FULL_REACHABLE_COMMIT_COUNT` | 19,352 |
| `PROJECT_DELTA_COMMIT_COUNT` | 83 after upstream `e985006171d2eb320ee512a653f4c83aea3d81b6` |

The initial local checkout was shallow at `e985006...`, exposing only 84 commits. `git bundle verify` accepted the local bundle's header, but a separate no-checkout clone failed because parent `4e9abfe6f9c20c250b1421cb4349b29b00f6f06d` was absent. `git fetch --unshallow --no-tags` from the rAthena upstream restored the original ancestry without changing Native HEAD, branch, source files, or existing bundle remote. The source is now non-shallow. The local bundle alone is **not a restorable full-history backup**.

## Full-history audit

The [primary scan](native-history-security-scan-v1.json) traversed 177,479 reachable Git objects and 83,465 blobs. It inspected 82,260 text blobs. The [supplemental scan](native-history-supplemental-scan-v1.json) inspected another 1,054 legacy text blobs; 151 binary blob versions map to [77 classified paths](native-history-binary-classification-v1.json). No text blob was skipped for exceeding the 10 MB scan limit. The 39 primary credential-pattern hits were source interpolation in historical `tools/config.pl` versions and one commented third-party Vagrant example. The supplemental pattern scan found zero hits. These regex results do not clear the separate account and log findings below.

The [project delta scan](native-project-delta-security-scan-v1.json) traversed the 83 project commits after the upstream baseline: 766 objects, including 317 blobs. Its 300 text blobs had zero credential-pattern or sensitive-path hits; the delta introduced no tracked binary-extension object. The Native working tree contains untracked build outputs and evidence; none were staged or published.

The [risk inventory](native-history-risk-inventory-v1.json) records exact historical paths, introducing/deleting commits, version counts, and current tracking state:

| Gate class | Count | Evidence |
| --- | ---: | --- |
| `SECRET_RISK` | 3 paths | Historical `log/login.log` includes account activity and a logged default GM-password setting; `log/char.log` includes account IDs and character names; seven reachable versions of `save-tmpl/account.txt` contain populated account rows and nonreserved email addresses. The actual values are omitted. |
| `RUNTIME_ONLY` | 3 paths | The two historical execution logs and `save/castle.txt` are runtime state, absent at current HEAD. |
| `GENERATED_ARTIFACT` | 5 paths | Historical `src/webserver/Webserver.exe` plus four Visual Studio `.ncb`/`.opt` cache files. All were later removed, but their blobs remain reachable through ancestry. |
| `LICENSE_PUBLICATION_RISK` | 2 paths | Historical `dbghelp.dll` was committed from a Microsoft debugger package; current `db/GeoIP.dat` is a third-party binary database. Redistribution terms for these exact files were not established by this audit. |
| `UNKNOWN` | 0 classified risk/binary paths | The 77 binary paths and the path-based risk findings have an explicit classification. This count does not represent a guarantee against patterns the scanner cannot detect. |

The six currently tracked `3rdparty/{mysql,pcre,zlib}/lib/{Win32,x64}/*.dll` files are inherited upstream build dependencies referenced by Visual Studio project files. No `.exe`, `.pdb`, `.grf`, database dump, Production backup, or client asset is tracked at current HEAD. Large historical `item_db_equip.yml` blobs are game database source. `UNNECESSARY_BINARY_TRACKING=5` refers to the five removed historical executable/cache paths; `CURRENT_UNNECESSARY_BINARY_TRACKING=0`.

## Gate decision and required disposition

`SECRET_RISK_COUNT=3`, `LICENSE_PUBLICATION_RISK_COUNT=2`, `UNNECESSARY_BINARY_TRACKING=5`, `UNKNOWN_COUNT=0`. The required zero values for secret risk and unnecessary binary tracking fail. The user explicitly forbade autonomous history rewriting and pushing when these gates fail. Therefore no GitHub repository was created, no GitHub remote was added, no branch was pushed, and no Native production authority was switched.

Project Control must approve a concrete disposition for the inherited upstream account/log data, removed build artifacts, and two licensing questions before any bootstrap retry. Preserve the true upstream ancestry unless an explicitly approved history strategy resolves these exact blockers. The current `production-release-authority.json` keeps `native.github_repository=null` and `native.release_ref=null`; `NATIVE_GITHUB_REMOTE_REQUIRED=YES`. The Web Production promotion gate rejects a Native baseline without a canonical GitHub ref. An integrated Native deployment SHA gate has not been established, so `NATIVE_DEPLOY_SHA_GATE_ACTIVE=NO`; Native promotion remains blocked by policy. Creating a repository later will still require exact SHA reachability, explicit deployment approval, exact build artifact, and receipt checks.

`GITHUB_REPOSITORY_CREATED=NO`; `GITHUB_REPOSITORY_PRIVATE=NOT_APPLICABLE`; `NATIVE_MAIN_GITHUB_REACHABLE=NO`; `M1_NATIVE_HEAD_GITHUB_REACHABLE=NO`; `PRODUCTION_FILES_CHANGED=NO`; `PRODUCTION_ENDPOINT_CONTACTED=NO`; `GAME_RUNTIME_TOUCHED=NO`; `RUNTIME_RESTARTED=NO`.
