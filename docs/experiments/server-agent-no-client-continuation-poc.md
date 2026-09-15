# SERVER_AGENT No-Client Continuation POC

STATUS: EXPERIMENTAL
CANONICAL: NO
PRODUCTION: NO

## Scope

本實驗只驗證隔離 rAthena runtime 中，SERVER_AGENT 在沒有 Native RO Client、沒有 OpenKore、fd=0 的條件下，能否沿用原生 map 與 NPC script authority 完成兩段 continuation。

實驗角色：AID 2000099、CID 150067。

隔離 checkout：`../.tmp-pa-lifecycle-consolidation-v1`

隔離 runtime：login 6900、char 6121、map 5121、MariaDB 3307。

正式 `.local/ro-stack` 未停止、未重啟、未修改。

## Architecture hypothesis

`ControllerMode` 分為 `NATIVE_CLIENT` 與 `SERVER_AGENT`。SERVER_AGENT 不等待不存在的 client packet 或 ACK，Persistent Agent 以 typed command 提供 intent/response，rAthena 保留 map、inventory、item validation、cooldown、NPC script VM、quest、ownership、execution epoch 與 entity lifecycle authority。

`fd=0` 是 runtime property。控制判定使用 `SERVER_AGENT` ownership 與 resident lifecycle。

## POC A: Fly Wing no-client continuation

### Normal client path

1. `persistent_agent_use_item()` 呼叫原生 `pc_useitem()`。
2. Fly Wing 觸發原生 `skill_castend_map()`，再進入 `pc_setpos()`。`pc_setpos()` 會移除 map entity 並更新位置。
3. Native Client 完成地圖載入後送出 packet `0x007d`。
4. rAthena 在 `clif_parse_LoadEndAck()` 內呼叫 `map_addblock(sd)`，再送出 spawn 與 map state。
5. main packet dispatcher 在 `sd->prev == nullptr` 時只放行 `clif_parse_LoadEndAck()`，其餘 client packet 被擋下。

Source evidence：

- `../.tmp-pa-lifecycle-consolidation-v1/src/map/pc.cpp:6930` `pc_setpos()`
- `../.tmp-pa-lifecycle-consolidation-v1/src/map/pc.cpp:7208` `pc_randomwarp()`
- `../.tmp-pa-lifecycle-consolidation-v1/src/map/clif.cpp:10748` `clif_parse_LoadEndAck()`
- `../.tmp-pa-lifecycle-consolidation-v1/src/map/clif.cpp:25794` pre-map packet gate
- `../.tmp-pa-lifecycle-consolidation-v1/src/map/map.cpp:408` `map_addblock()`

### SERVER_AGENT continuation

實驗沿用既有 `attach_map_block(map_session_data*)`。farm tick 發現 `sd->prev == nullptr` 時呼叫它，該函式使用原生 `map_addblock()` 與 `map_addiddb()`，不直接寫入 `sd->prev`，不建立第二個 player entity。

### Runtime evidence

隔離 driver result：

```text
claim=PASS fd=PASS startFarm=PASS target=PASS attack=PASS movement=PASS kills=1 stopFarm=PASS release=PASS orphan=0
```

關鍵順序：

```text
WARP_START cid=150067 item=601 map=pay_dun00 coord=30,183 epoch=2
ITEM_USE cid=150067 item=601 result=ITEM_EFFECT_APPLIED amount=30->30 coord=30,183->125,141 epoch=2
WARP_COMPLETE cid=150067 coord=125,141 prev=0 entity=1
MAP_REATTACH cid=150067 coord=125,141 prev=1 entity=1 ownership=SERVER_AGENT
AUTO_FARM_KILL cid=150067 kills=1 entity=1
```

判定：`POC_A = PASS`。

- `sd->prev`：warp completion `0`，server continuation 後 `1`
- entity count：全程 1
- ownership：SERVER_AGENT 保持
- execution epoch：epoch 2 保持
- Fly Wing：601 數量 30→30，原生非消耗效果
- 座標：30,183→125,141
- fake Client packet：0

Evidence：`../.tmp-pa-iso-runtime/fh-map.out`

SHA-256：`CF8766E58C307DD115C896A16CF1740CA62C37949902573ADC7000DD369ACBE1`

## POC B: TEST_ONLY NPC dialog continuation

### Fixture boundary

隔離測試 NPC：`PA_NoClient_Choice`，位置 `pay_dun00:32,183`。

測試 script 提供 `A / B / Exit`。選項 B 執行原生 script `set #test_result,2`。fixture 僅存在隔離 checkout，不進正式 NPC source。

### Native dialog path

1. Agent 對 NPC 執行 native `npc_click()`。
2. script VM 建立等待狀態，`sd->st->state=STOP`，Agent phase 為 `NPC_WAIT_NEXT`。
3. `dialog_next` 進入 `process_dialog_next()`，呼叫原生 `npc_scriptcont(sd,npc_id,false)`。
4. script VM 產生 menu，Agent phase 變為 `NPC_WAIT_MENU`。
5. `dialog_select` 進入 `process_dialog_select()`，驗證 index 範圍後呼叫原生 `npc_scriptcont()`。
6. script VM 執行 `set #test_result,2`，再由 `dialog_close` 完成 native dialog cleanup。

### Runtime evidence

關鍵 log：

```text
IDLE_READY aid=2000099 cid=150067 fd=0 ... entity=1
NPC_REACHED ... distance=2 entity=1
NPC_DIALOG_OPEN ... entity=1
NPC_PHASE ... phase=NPC_WAIT_NEXT script_state=1
SERVER_AGENT_RESPONSE ... response=NEXT
NPC_SCRIPT_CONTINUE ... response=NEXT
NPC_PHASE ... phase=NPC_WAIT_MENU script_state=3 menu=3
SERVER_AGENT_RESPONSE ... response=SELECT index=2
NPC_SCRIPT_CONTINUE ... response=SELECT index=2
NPC_SELECT ... index=2 options=3
NPC_COMPLETE ... cancelled=0
NPC_INTERACTION_END ... result=AUTHORITATIVE_SCRIPT
```

只讀 DB confirmation：

```text
acc 2000099 #test_result 0 2
ownership=OPENKORE control_owner=OPENKORE agent_mode=PERSISTENT_IDLE revision=121
claim_agent=CONFIRMED
talk_to_npc=CONFIRMED
dialog_next=CONFIRMED
dialog_select=CONFIRMED
dialog_close=CONFIRMED
release_agent=CONFIRMED
```

判定：`POC_B = PASS`。

Evidence：`../.tmp-pa-iso-runtime/npc-map.out`

SHA-256：`6747605A531DDCC14F18DE28953F19DC727EA59AB6F1C734A82A467864F10086`

## Isolation and safety result

- 隔離測試 scope 的 OpenKore process：0
- 全部正式 `.local/ro-stack` OpenKore process：10，屬既有線上玩家，未觸碰
- fake Client packet：0
- duplicate entity：0
- ownership leak：0，最終 state 為 OPENKORE
- crash：0
- isolated server orphan：0
- authority logs：Fly Wing 使用原生 item/teleport/map attach；NPC 使用原生 `npc_click`、`npc_scriptcont`、menu validation 與 script variable mutation

## Test-only files

以下只存在隔離 checkout 或隔離 driver：

- `../.tmp-pa-lifecycle-consolidation-v1/src/map/persistent_agent.cpp`
- `../.tmp-pa-lifecycle-consolidation-v1/npc/custom/server_agent_no_client_test.txt`
- `../.tmp-pa-lifecycle-consolidation-v1/npc/scripts_custom.conf`
- `../.tmp-pa-iso-runtime/server-agent-no-client-npc.ps1`

本 Git branch 沒有 production runtime source modification。正式 `ops/ro-stack/patches/persistent-agent-rollout.patch` 未由本實驗修改，現有 raw SHA-256：`F3B8776C247164D077D00A30A33542F8A274FC607871D5AA9EBB6658A6413C11`。

隔離 map-server binary SHA-256：`BE0F6CA4A95B3B03CC2DB3BA5F819EFC833A0F8735B58C03FEF85A736299B6E5`。

## Architecture decision

`ARCHITECTURE_POC = PASS`，範圍只涵蓋：

- Fly Wing map detach 後的 server-owned reattach
- 一個 TEST_ONLY NPC 的 next/menu select/close continuation
- 單一 CID、單一隔離 map-server、無 client、無 OpenKore 控制

`PROMOTE_CANONICAL = NO`。

本實驗未驗證 release/reclaim、完整 AUTO_FARM、loot、death、supply、跨圖導航、正式 quest、多人或正式玩家 rollout。這些能力不得由本 POC 推導。

## Provenance

- experiment base SHA：`113f72ab80ff1fd4aeb4d0d1a81ed2f734f68669`
- experiment branch：`experiment/server-agent-no-client-continuation-poc`
- branch production semantic modification：`0`
- high-cost architecture flag：`NO`
- evidence package：`../.tmp-pa-iso-runtime/fh-map.out`、`../.tmp-pa-iso-runtime/npc-map.out`、隔離 driver 與隔離 checkout

## Final Result

`ARCHITECTURE_POC_PASS = YES`

`PROMOTE_ARCHITECTURE_DIRECTION_RECOMMENDED = YES`

`PROMOTE_EXPERIMENT_CODE_DIRECTLY = NO`

Experiment branch：`experiment/server-agent-no-client-continuation-poc`

Base SHA：`113f72ab80ff1fd4aeb4d0d1a81ed2f734f68669`

Head SHA：`a5d7972b4525fa1dff75f56d11c446b2ac2b99f1`

Tree SHA：`5c28bffa7e683a427517a98f01315abe99a8329e`

Rollout patch SHA256：`F3B8776C247164D077D00A30A33542F8A274FC607871D5AA9EBB6658A6413C11`

本結果只封存 architecture feasibility。`PLAYER_FLOW_PASS`、`OPENKORE_REMOVED` 與正式 production readiness 維持原狀。
