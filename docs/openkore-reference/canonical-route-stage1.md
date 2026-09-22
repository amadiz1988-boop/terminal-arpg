# OpenKore Canonical Route Model Stage 1

本文件記錄 `OPENKORE_CANONICAL_ROUTE_MODEL_STAGE1_V1` 的離線 shadow 結果。

## Scope

- `canonical-route-model.mjs` 是獨立 canonical graph、requirements、weighted solver 與 rAthena warp adapter。
- OpenKore route weights 只作語意基準，沒有複製 GPL source 到 Production。
- 現有 `map-route.mjs`、`relocation-policy.mjs` 保持 runtime adapter 與 policy 狀態，沒有部署或接線變更。
- 沒有啟動 OpenKore、第二套 rAthena、Dashboard 或任何 Production mutation。

## Evidence

`test-canonical-route-model-stage1.mjs`：9/9 PASS。

`audit-canonical-route-coverage.mjs` 以 Production runtime 的唯讀 rAthena warp data 與本地 map-info 執行，觀測到 1,836 條 warp edge、557 個 graph nodes、69 個 map-info entries。覆蓋分類為 34 NORMAL_FIELD、17 NORMAL_DUNGEON、5 TOWN、13 INTERIOR；51 個 normal-world entries 中 19 reachable、32 unreachable、3 無 graph node、2 無 incoming edge。這是目前 map-info 子集的 bounded coverage，不宣稱完整 map-index acceptance。

## Stage 1 disposition

| Component | Disposition |
| --- | --- |
| `map-route.mjs` | KEEP_AS_ADAPTER |
| `relocation-policy.mjs` | KEEP_AS_POLICY |
| `planFarmMapChange()` | KEEP_AS_ADAPTER |
| canonical route model | SHADOW_ONLY |

Production source、Production deployment、runtime routing engine 數量均未改變。
