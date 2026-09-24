# rAthena Debugging Reference V1

## Scope and authority

本文件是鬼島傳說的 rAthena debugging reference 與 server-side structured probe
foundation。它服務於：

```text
Synthetic / Support Action
→ Dashboard
→ Controller
→ Command
→ Native / PA
→ rAthena handler / authority
→ Event Ledger / state
```

每一層以 `RECEIVED`、`ACCEPTED`、`REJECTED`、`STATE_CHANGED`、`ERROR_CODE` 與
`NEXT_LAYER_REACHED` 描述證據，並將第一個失敗邊界標記為
`FIRST_BROKEN_TRANSITION`。

Authority order：

1. 當前 native source `C:\Users\Administrator\source\ghost-island-rathena`
2. 本 reference atlas 與專案 integration contract
3. 官方 rAthena source documentation
4. 高價值 upstream wiki／technical discussion，僅作背景

本輪 research 以 native HEAD `1ffd06a07f8d997cf500334f92ccc7df6db354f7`
及 atlas 記錄的 upstream commit 為 provenance。Native helper 僅新增可選觀測
能力，未改 command schema、packet schema、gameplay authority 或 orchestration。

## Current rAthena primitives

| Primitive | Current source pointer | Use | Boundary |
| --- | --- | --- | --- |
| `ShowInfo` / `ShowWarning` / `ShowError` / `ShowDebug` | `src/common/showmsg.hpp:74-100`, `src/common/showmsg.cpp:832-870` | server console／console log 的既有訊息入口 | 訊息層級與 `console_msg_log` 由 runtime config 控制 |
| `console_msg_log` | `conf/map_athena.conf:52-60` | `2` error+SQL、`4` debug、`7` 全部三類 | 預設值為 `0`，追蹤前以受控 debug process 或檔案設定開啟 |
| `Sql_ShowDebug` / `SqlStmt_ShowDebug` | `src/common/sql.hpp:209-214`, `src/map/*` SQL call sites | SQL error／statement diagnostics | 僅記錄 SQL diagnostics，不把 credentials 放入 trace |
| `debugmes` | `src/map/script.cpp:12634-12638` | NPC script-local debug | 適合 script reproduction；跨層 correlation 使用 `gi_trace` |
| `battle_log`、`skill_log`、`etc_log` | `src/map/battle.cpp:8416`, `conf/battle/misc.conf:50-57` | bounded battle diagnostics | 預設關閉；高頻 combat 需 trace cap |
| warp debug | `conf/battle/misc.conf:59-62` | 顯示 warp point 與啟動檢查 | 只協助 map／warp diagnosis，不能代替 authoritative position |
| packet database | `src/map/clif.hpp:68-72,203-204`, `src/map/clif_packetdb.hpp:7-8` | packet id、固定／動態長度、handler registration | `PACKETVER`、packet length 與 obfuscation 必須和 client build 一致 |
| signal crash path | `src/common/core.cpp:58-160,468-481` | signal／shutdown／crash handling | production 不切換 debug build；先保存 binary、symbols、dump |

## Debug escalation ladder

使用可回答問題的最低層級，依序升級：

| Level | Layer | 問題 | 升級條件 |
| --- | --- | --- | --- |
| 0 | Action Trace / Synthetic | action 是否收到、接受、失敗在哪個 transition | trace 尚未涵蓋該層 |
| 1 | Native / PA semantic probe | command 是否抵達 native、PA 是否改變 mode／state | native receive／accept 或 PA state 沒有 evidence |
| 2 | rAthena handler / authority | handler input、pre-state、result、post-state | `PA_STATE → RATHENA_AUTHORITY` 失敗 |
| 3 | packet boundary / clif | packet id、expected／actual length、handler dispatch | handler 從未抵達、版本／長度 mismatch |
| 4 | raw transport / packet capture | socket、obfuscation、malformed payload | Level 0-3 無法解答 transport 問題 |
| 5 | crash dump / debugger | source line、stack、memory／lifecycle | process crash、fatal signal 或 native backtrace 需要定位 |

Raw packet capture 與常駐全流量 sniffer 不屬於 default path。

## Structured probe contract

Native foundation 位於：

```text
C:\Users\Administrator\source\ghost-island-rathena\src\common\gi_trace.hpp
```

`gi_trace::Context` 接收既有 H trace foundation 提供的 optional `traceId`、
`actionKey` 與 `charId`。呼叫端將 context 帶到 native seam，無 trace id 時保持
停用；僅在明確設定 `GI_TRACE_ALL=1` 的 debug process 才允許 unscoped bounded
events。此設計保留 backwards compatibility，沒有建立第二套 trace id。

每個 event 固定輸出下列 machine-readable fields：

```text
GI_TRACE
traceId actionKey charId layer stage timestamp result errorCode reason
map x y paModeBefore paModeAfter targetId itemId metadata
```

支援的 semantic layers：

```text
NATIVE_RECEIVE
NATIVE_ACCEPT
PA_STATE
RATHENA_HANDLER
RATHENA_AUTHORITY
PACKET_BOUNDARY
EVENT_LEDGER
```

`gi_trace::Event` 的 `layer`、`stage`、`result`、位置、target、item、PA mode 與
metadata 都可選。未提供欄位輸出 `none` 或 `-1`，保持 schema 穩定。

### Safety properties

- trace id、action key、map、reason、error code 與 metadata 會轉成 bounded token。
- metadata 最多 128 字元；控制字元、空白、`=` 與未允許字元會被替換。
- 出現 `password`、`token`、`secret`、`cookie`、`authorization` 或 `credential`
  會輸出 `REDACTED`。
- 每個 `Context` 預設最多 64 events，可由 caller 設定較小上限。
- context 未啟用時只做 active branch，沒有 `ShowDebug` 呼叫與 gameplay side effect。
- 超過 cap、格式化失敗或缺少 optional field 時 fail-soft。

### Native trace integration spec

H 提供：

```text
traceId
actionKey
charId
effective identity
```

Native／PA 回傳或暴露：

```text
NATIVE_RECEIVE
NATIVE_ACCEPT
PA_STATE
RATHENA_HANDLER
RATHENA_AUTHORITY
errorCode
```

本輪不修改 `ops/ro-stack/dashboard.mjs`、Dashboard command schema、Controller
或 Event Ledger shared seam。H 完成 shared seam 後，接線工作只需在 native entry、
PA transition 與 authority handler 建立 `Context`，沿用同一個 `traceId`。

G Diagnostic Center 未來直接 consume native event、rAthena event、error code、
failure layer、bounded timeline。I 不建立第二個 Admin UI 或第二個 analyzer。

## Core probe seams

Instrumentation 只放在 semantic seam，保留現有 orchestration：

| Action | Command receive | Command accept | PA state | rAthena authority | Success evidence |
| --- | --- | --- | --- | --- | --- |
| `START_FARM` | native command entry | validation／owner accepted | `STOPPED → AUTO_FARM` | target acquire、attack、hit | mode changed，再有 `MONSTER_TARGET`、`MONSTER_ATTACK`、`MONSTER_HIT` |
| `STOP_FARM` | stop entry | command accepted | `AUTO_FARM → STOPPED` | no new farm action | mode stopped、combat loop ended |
| `CHANGE_FARM_MAP` | destination command | source／target accepted | route phase updated | authoritative map change | map arrival observed |
| `FLY_WING` | `use_item` receive | item accepted | transient action | teleport authority | map/x/y changed、quantity unchanged |
| `BUTTERFLY_WING` | `use_item` receive | item accepted | supply／return phase | savepoint authority | savepoint map/x/y changed |
| `SUPPLY` | low-resource signal | pause accepted | `AUTO_FARM → SUPPLY` | wing、savepoint、service、buy | return map、mode resumed |
| `COMBAT` | target／attack command | target valid | combat active | damage／kill／loot | distinguish target、attack、hit、kill、loot |
| `MAP / WARP` | movement／warp request | route or warp accepted | navigation phase | `pc_setpos`／map authority | authoritative map/x/y after action |

`MONSTER_ATTACK` 只表示 attack attempt。`MONSTER_HIT` 才表示 confirmed hit。
`LOOT_ACQUIRED` 需要 authoritative inventory／event evidence。Fly Wing 為專案
non-consumable rule，quantity unchanged 是預期結果。

## Handler-level procedure

當 `FIRST_BROKEN_TRANSITION` 落在 rAthena boundary：

1. 依 packet／command 找到唯一 handler。
2. 在 handler entry emit `RATHENA_HANDLER / RECEIVE`，記錄 trace、char、map、
   target 或 item 的 bounded values。
3. 讀取 authoritative pre-state，emit `RATHENA_AUTHORITY / PRE_STATE`。
4. 執行既有 handler 與 authority，不改變 orchestration。
5. 以 return／result emit `RATHENA_HANDLER / RESULT`。
6. 重新讀取 post-state，emit `RATHENA_AUTHORITY / POST_STATE`。
7. 比較 pre/post state，再由 H analyzer 判斷第一個 failure。

不得在全 server 散落無 correlation 的 `ShowDebug`。

## Packet debugging procedure

只在 handler 未抵達、packet mismatch、`PACKETVER` mismatch、長度 mismatch、
obfuscation mismatch、socket issue 或 malformed packet 時升級。

記錄欄位：

```text
packetId
expectedLength
actualLength
PACKETVER
handler
connection/session identity (redacted, bounded)
timestamp
traceId (when available)
```

不要保存完整敏感 payload。`src/map/clif_packetdb.hpp` 的 `packet`／
`parseable_packet` registration 與 `src/map/clif.hpp` 的 `s_packet_db` 是目前
packet boundary 的 source pointer。Dynamic packet 要同時驗證 minimum length 與
packet-declared length。

## Raw packet capture policy

### WHEN_REQUIRED

Level 0-3 已確認 application、native、handler evidence 不足，且問題落在 socket、
obfuscation、malformed bytes 或 client/server transport compatibility。

### WHAT_TO_CAPTURE

限定單一合法測試 session、單一 action、短時間窗、packet id、長度、方向、時間、
PACKETVER 與既有 trace id。

### HOW_TO_BOUND

固定 byte cap、時間 cap、session allowlist 與自動清除期限；先 hash payload，只有
經核准的欄位採樣保存。

### WHAT_NOT_TO_STORE

密碼、session cookie、auth token、DB credentials、完整聊天、完整 inventory、
未遮罩 payload 與常駐全流量 capture。

## Crash debug playbook

1. 記錄 process、binary hash、source HEAD、build configuration 與最後一筆
   `GI_TRACE`。
2. 保留 crash binary、matching symbols 與 dump，禁止用新 build 覆蓋原物件。
3. 以 `RelWithDebInfo` 或同等 debug-symbol build 重現於隔離環境。
4. Windows 以 Visual Studio／WinDbg／CDB 取得 exception、module、thread 與
   native backtrace；Linux 以 GDB／core 取得相同欄位。
5. 將 backtrace source line 對回 traceId、actionKey、handler 與 authority
   pre/post-state。
6. 以最小修正完成 bounded regression，保留原始 dump 與 provenance。

Native build readiness check on 2026-09-21：一般 PowerShell PATH 沒有 `cl`，但
Visual Studio 2022 Build Tools 可由 `vswhere` 定位。Project Last-Good 使用 solution
root 的 `rAthena.sln`，以 `MSBuild ... /t:Build /p:Configuration=Release
/p:Platform=x64 /m` 執行，讓 `$(SolutionDir)` 正確指向 third-party include 與
project dependencies。先前對 `common.vcxproj` 的直接呼叫遺失 `SolutionDir`，因此
產生了誤導性的 missing-header 結果。

本次 canonical source 的 header readiness：

| HEADER | TYPE | EXPECTED_SOURCE | GENERATION / INSTALL STEP | RESULT |
| --- | --- | --- | --- | --- |
| `src/config/core.hpp` | repository config header | Native checkout `src/config/core.hpp` | Solution include path `$(SolutionDir)src` | PRESENT |
| `3rdparty/libconfig/libconfig.h` | third-party dependency | Repository bundled `3rdparty/libconfig` | `libconfig.vcxproj` dependency build | PRESENT |
| `3rdparty/zlib/include/zlib.h` | third-party dependency | Repository bundled `3rdparty/zlib/include` | `$(SolutionDir)3rdparty\\zlib\\include\\` | PRESENT |
| `3rdparty/rapidyaml/src/ryml_std.hpp` | third-party dependency | Repository bundled rapidyaml | `ryml.vcxproj` dependency build | PRESENT |

`core.hpp` 沒有額外 generated-header step；四個 header 都由 canonical checkout 或
bundled dependency 提供，沒有 vendor、個人資料夾 include path 或任意網路檔案。`httplib`、
`libconfig`、`ryml`、`yaml-cpp`、`common` 與 `map-server` 均通過 Release|x64 solution
build。`src/common/showmsg.cpp` 以 compile-time anchor include `gi_trace.hpp`，`.obj/.pdb`
依賴紀錄可見該 header，`common.lib` 再鏈入 map-server candidate。

## GUI-free debug contract

以下能力預設可在不開 Browser 的情況下完成 synthetic／server-side diagnosis：

```text
START_FARM
STOP_FARM
CHANGE_FARM_MAP backend
FLY_WING / BUTTERFLY_WING semantics
SUPPLY
COMBAT state
PA state
route planner
native command
rAthena handler
inventory authority
map / position authority
```

Browser 僅在 DOM、CSS、layout、responsive、audio、browser-only JavaScript 或
最後 Player acceptance 時必需。

## Bounded validation contract

本輪 validation 應涵蓋：

```text
trace event schema
traceId/actionKey/charId preservation
secret redaction
disabled overhead
event cap
malformed trace input
unknown trace id
START_FARM fixture
native reject fixture
PA transition failure fixture
Fly Wing position unchanged fixture
combat attack-without-hit fixture
packet-handler-not-reached classification
FIRST_BROKEN_TRANSITION compatibility
```

`scripts/test-rathena-debug-reference.mjs` 以文件、schema 與 native helper 的
靜態 contract 做 bounded checks。Native Release build 已完成；100,000 次 bounded
microbenchmark 顯示 probe disabled 平均 `3 ns`、enabled 平均 `591 ns`，此結果是
無輸出 stub 下的編譯後 helper sanity measurement，不代表 production load test。

## Source pointers

- Project trace contract: `docs/player-action-trace-foundation.md`
- Synthetic runner: `scripts/player-scenario-runner.mjs`
- Trace schema: `scripts/lib/player-scenario/trace-schema.mjs`
- Native probe helper: `C:\Users\Administrator\source\ghost-island-rathena\src\common\gi_trace.hpp`
- Upstream packet database and length validation: [rAthena `src/common/packets.hpp`](https://github.com/rathena/rathena/blob/master/src/common/packets.hpp)
- Upstream client packet registry: [rAthena `src/map/clif_packetdb.hpp`](https://github.com/rathena/rathena/blob/master/src/map/clif_packetdb.hpp)
- Upstream packet notation: [rAthena `doc/packet_struct_notation.md`](https://github.com/rathena/rathena/blob/master/doc/packet_struct_notation.md)
- Upstream source roles: [rAthena `doc/source_doc.txt`](https://github.com/rathena/rathena/blob/master/doc/source_doc.txt)

## Readiness

```text
RATHENA_DEBUG_REFERENCE_CREATED = YES
STRUCTURED_PROBE_FOUNDATION = YES (native header, opt-in, bounded)
TRACE_ID_NATIVE_SUPPORT = OPTIONAL_CONTEXT, NO COMMAND SCHEMA CHANGE
TRACE_PROPAGATION_GAP = PRESENT
BUILD_PASS = YES (Release|x64 rAthena.sln solution build)
COMMON_BUILD = PASS
MAP_SERVER_BUILD = PASS
SOURCE_COMMIT = ff72578f608935d1df5d664b3e9df9d436361043
CANDIDATE_PATH = C:\\Users\\Administrator\\source\\ghost-island-rathena\\map-server.exe
CANDIDATE_SIZE = 6294528
CANDIDATE_SHA256 = 086804201BBDB55B585D752AE41A9929975381D063167C4F965F924811CFE723
GI_TRACE_COMPILED = YES (showmsg.obj dependency record and common.lib link)
PROBE_OVERHEAD_RESULT = disabled_avg_ns=3; enabled_avg_ns=591; ratio=183.777 (stubbed bounded sanity)
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
READY_FOR_RUNTIME_TRACE_INTEGRATION = YES
```
