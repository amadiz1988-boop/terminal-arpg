# Canonical Transport Enrichment Stage 2

```text
TASK_ID = OPENKORE_RATHENA_TRANSPORT_GRAPH_ENRICHMENT_V1
BASE_CHECKPOINT = 350cee9
STAGE1_INVENTORY_REUSED = YES
MAP_INDEX_RESCANNED = NO
PRODUCTION_TOUCHED = NO
OPENKORE_RUNTIME = 0
```

本輪沿用 `world-map-inventory.json` 的 1,295 張地圖 inventory，沒有重跑 Stage 1。新增的 transformer 只把目前 active rAthena warp、warp2、script warp 與可辨識的 NPC／airship script transfer 正規化到既有 canonical route model。OpenKore `portals*` 僅作 advisory 與 parity evidence，未覆蓋 rAthena authority。

## Evidence

```text
ECOSYSTEM_REFERENCE_SWEEP_COMPLETED = YES
RATHENA_AUTHORITY = PASS
OPENKORE_REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
CANONICAL_ROUTE_ENGINE_COUNT = 1
PER_MAP_HARDCODE_COUNT = 0
```

增量 graph 統計：`PORTAL=3724`、`SCRIPTED_TRANSFER=1378`、`NPC_TRANSPORT=17`、`AIRSHIP=9`。Stage 1 weighted solver 原始檔案未修改，Stage 1 parity 仍為 9/9 PASS。

49 筆 normal rows 已全部取得明確分類，`NORMAL_UNKNOWN=0`、`OTHER_UNEXPLAINED=0`。其中 41 筆已有 enriched topology route，12 筆依 guild castle evidence 重新歸為 EVENT，3 筆保留 requirement metadata，6 筆為 static portal data gap，2 筆為 nodeless scripted-transfer evidence。

目前仍有 8 筆 normal rows 缺少可由目前 active rAthena source 證明的 root route：

```text
um_dun01
um_dun02
treasure_n1
treasure_n2
prt_fild08a
prt_fild08b
prt_fild08c
prt_fild08d
```

OpenKore 對其中部分 rows 有 advisory portal records，但 rAthena `um_dun` 的 Umbala entrance 目前是 commented pre-re warp，不能直接當成 current authoritative edge。`treasure_n*` 與 `prt_fild08*` 目前也只有 destination/spawn 或 outbound evidence，沒有足夠的 current root-entry proof。這 8 筆屬於明確的 `STATIC_PORTAL_DATA_GAP`，仍不可宣稱 `NORMAL_UNREACHABLE=0`。

## Verification

```text
test-canonical-transport-enrichment = 8/8 PASS
test-canonical-transport-audit = PASS (49 rows, 8 unresolved topology rows)
test-canonical-route-model-stage1 = 9/9 PASS
OPENKORE_RUNTIME = 0
PRODUCTION_TOUCHED = NO
READY_FOR_STAGE2_PA_ADAPTER = NO
```

Stage 2 PA adapter、Production deploy、runtime mutation 與 per-map route hardcode 均未執行。
