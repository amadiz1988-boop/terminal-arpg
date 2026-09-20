# Continuous Reference Mining

```text
REFERENCE_MINING_IS_CONTINUOUS = YES
OWNER = F
SCOPE = rAthena / OpenKore reference research, project mapping and stale-policy governance
RUNTIME = 0 OpenKore processes; PA / SERVER_AGENT -> rAthena remains production authority
```

本目錄把 reference research 從 reactive lookup 轉成可排序、可重複、可回寫 Atlas 的研究流程。每一輪只處理一個高價值 topic，保留完整來源、版本基線、Project Last-Good 與目前適用性判定。

## 研究順序

1. 讀取 `AGENTS.md`、`WORKSPACE_INDEX.md` 與本任務指定的 canonical source。
2. 先查現有 rAthena Atlas、OpenKore Atlas、Project Last-Good 與相關 flow 文件。
3. 從 backlog 選取最高優先級且 coverage 最弱的單一 topic。已有完整 Atlas 覆蓋時標記 `REUSE`，不重複研究。
4. 以 current project source 為第一個 authority，再核對 current upstream source、官方文件與必要的高價值 forum/wiki pattern。
5. 將每項資料轉成問題、成熟解法、適用條件、目前 source 狀態與 Project 使用方式。
6. 判定 `CURRENT_VERSION_APPLICABLE`、`CLASSIFICATION`、`STALE / VERSION CONFLICT`，再寫回 topic dossier 與兩份 Atlas。
7. 執行 YAML parse、reference path check、`git diff --check`，最後 exact-file checkpoint。

## 研究單位

每個 topic dossier 必須包含：

```text
TOPIC_ID
QUESTION
PROJECT_RELEVANCE
UPSTREAM_SOURCE_CHECKED
FORUM / WIKI FINDINGS
CURRENT_VERSION_APPLICABLE
PROJECT_LAST_GOOD_CHECKED
CLASSIFICATION
CANONICAL_SOURCE_POINTERS
PROJECT_USAGE
KNOWN_RISKS
STALE / VERSION CONFLICT
ATLAS_UPDATED
```

OpenKore capability 同時遵守 `docs/openkore-reference/README.md` 的 dossier schema。Forum 或 Wiki 僅提供 pattern、陷阱或歷史背景，必須回到 current source 驗證後才能進入 Atlas。

## 如何判 stale

- topic 的 upstream commit、source path 或 symbol 已消失時，標記 `STALE_REFERENCE`。
- current source semantics 與舊文不同時，記錄 conflict 與適用版本，不沿用舊解法。
- Project source 與 upstream 行為不同時，保留兩者 provenance，讓 Project authority 優先。
- 缺少證據時寫 `UNKNOWN`，不把 `UNKNOWN` 轉成 `DOES_NOT_EXIST`。

## Duplicate research gate

研究前搜尋：

```text
docs/rathena-reference/reference-index.yml
docs/openkore-reference/reference-index.yml
docs/rathena-reference/*.md
docs/openkore-reference/*.md
docs/openkore-exit-source-of-truth.md
```

若現有 dossier 已回答相同問題，沿用並只補充版本或 current-source 差異。只有 semantic/high-risk gap 才建立新 dossier。一般小任務可直接 reuse Atlas，不因 backlog 狀態阻塞。

## Worker dispatch integration

Runtime 或 gameplay workline 在施工前增加：

```text
REFERENCE_MINING_GAP = YES / NO
```

`NO` 表示 Atlas 已覆蓋，worker 記錄 reuse pointer 後繼續。`YES` 只在高風險 semantic、authority、lifecycle、packet、navigation、combat、supply 或 quest gap 時交由 F 研究。研究完成後，worker 仍需遵守 current source、FIRST_BROKEN_TRANSITION、bounded test 與 Browser acceptance 規則。

## Current completed cycle

`ITEM_LOOT_INVENTORY_STORAGE_WEIGHT` 已完成一次完整 mining cycle。它對應 AutoLoot、Auto-Identify、Inventory、Storage、Supply 與 Weight threshold，並回寫 rAthena / OpenKore Atlas 的 Project Last-Good pointers。

`ADMIN_SUPPORT_IMPERSONATION_SECURITY` 已完成 security mining cycle。它對照 Project H contract、RFC 8693、OWASP、Cloudflare Access、GitLab 與 Keycloak，記錄 actor/effective identity、TTL、revocation、nested impersonation、CSRF、audit、secret handling 與立即修補規格。Dossier：`docs/reference-mining/admin-support-impersonation.md`。

`NAVIGATION_WARP_PORTAL_PATHFINDING` 已完成 navigation mining cycle。它分離 static warp、OnTouch、script warp、NPC/service、instance、mapflag 與 client `navigateto` 語意，並將 `moc_pryd01` 到 `mjolnir_07`／`pay_fild04` 的 `no_direct_route` 定位為 scripted service edge 未進入 static graph。Dossier：`docs/reference-mining/topics/navigation-warp-portal-pathfinding.md`；機讀矩陣：`docs/reference-mining/navigation-capability-matrix.yml`。
