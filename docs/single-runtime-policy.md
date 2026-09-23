# Single Runtime Policy（單一 rAthena Runtime 政策）

本文件是 Project Control 於 2026-09-18 生效的正式決策，取代所有先前以「第二套測試
runtime」為前提的測試慣例。`EXTRA_TEST_SERVER_ALLOWED = NO`。

## ONLY AUTHORIZED RUNTIME

唯一允許的正式 runtime：

| 服務 | Port |
| --- | --- |
| login | 6901 |
| char | 6122 |
| map | 5122 |
| dashboard | 8788 |

DB：canonical production DB（`ragnarok`）。

正常穩態必須是：

```text
login-server.exe = 1
char-server.exe  = 1
map-server.exe   = 1
```

## RETIRED

以下測試 runtime 慣例全部退休，不得由任何 Workline（A／B／C 或後續角色）自行重建：

```text
6902 / 6123 / 5123 / 8792
6904 / 6124 / 5124
6905 / 6125 / 5125
```

不得建立：

- `.tmp-*` rAthena live stack
- 第二 login-server
- 第二 char-server
- 第二 map-server

## NORMAL DEVELOPMENT FLOW

一般功能流程：

```text
SOURCE AUDIT
→ surgical fix
→ build
→ controlled canonical restart IF REQUIRED
→ production test character acceptance
```

允許為載入新版 binary 受控重啟正式 map／char／login，但只能重啟 canonical instance，
不得並行建立第二 instance。

## PRODUCTION RESTART SAFETY

任何 canonical restart 前必須依序完成：

1. 確認修改範圍
2. 確認 binary／config
3. 記錄目前 PID
4. graceful stop 優先
5. 確認 port released
6. start exactly ONE replacement
7. health gate
8. Persistent Agent resident gate
9. OpenKore = 0
10. Web smoke test

禁止：

- old + new 同時存活
- 第二套 parallel runtime

## DESTRUCTIVE TEST POLICY

若測試需要以下情境：

- deliberate map crash
- duplicate owner
- quarantine
- stale runtime corruption
- destructive DB mutation
- competing physical map-server

禁止直接在 production 做。改用：

- unit test
- persistence-layer test
- state-machine harness
- controlled claimant fixture

若仍然無法證明：

```text
STOP
回報 Project Control
```

不得自行建立第二套 server。

## PROCESS GUARD

`ops/ro-stack/runtime-guard.ps1` 是唯一的 runtime admission control。它不會自行啟動任何
服務，只做准入判斷，fail-closed。

- 只有 `-Slot Production` 被授權；任何其他 slot 立即回報
  `UNAUTHORIZED_RATHENA_RUNTIME`（token 大小寫固定）並以非零狀態結束。
- 全域偵測 login／char／map 是否超過一個、是否有非 canonical runtime path、是否有
  retired port listener。
- `ops/ro-stack/ro-stack.ps1 start` 與 `restart` 在啟動前會先執行 guard；違規時以
  `SINGLE_RUNTIME_GUARD_BLOCKED` 中止，不會啟動 replacement。
- 操作指令：

```text
ops\ro-stack\ro-stack.ps1 guard        # 單一 runtime 檢查，違規 exit 4
ops\ro-stack\ro-stack.ps1 inventory    # 目前 runtime JSON inventory
```

若偵測 login-server > 1、char-server > 1 或 map-server > 1：

```text
UNAUTHORIZED_RATHENA_RUNTIME
```

不得默認為合法 fixture。

回歸測試：`ops/ro-stack/tests/test-single-runtime-guard.ps1`。

## PRODUCTION RUNTIME SENTINEL

`runtime-guard.ps1` 只在 launcher 路徑把關；為防止有人從 VSCode／Kilo／CMD
直接啟動 `login-server.exe`／`char-server.exe`／`map-server.exe` 繞過 launcher，
另由 `ops/ro-stack/runtime-sentinel.ps1` 做硬性執行。

- 只檢查 live process 與 TCP listener，**不掃描磁碟**（不得再用
  `Get-ChildItem -Recurse` 找 binary）。
- 每個 runtime 記錄 PID／PPID／ExecutablePath／CommandLine／ListeningPort 並追
  parent chain；parent 含 `Code.exe`／`kilo.exe`／`cmd.exe`／`powershell.exe`
  不構成合法理由，只看是否為 canonical PID／path／port。
- 對第二個或非 canonical path 的 rAthena process 允許自動終止，且 fail-safe：
  canonical path 且持有 canonical port 的 process 永不被 kill；某類型沒有
  canonical instance 時只回報、不 kill。
- 終止前寫入 audit（`.local/ro-stack/sentinel-audit.log`）：timestamp、pid、ppid、
  path、command、reason（`UNAUTHORIZED_SECOND_MAP`／`NON_CANONICAL_RUNTIME_PATH`／
  `RETIRED_TEST_RUNTIME`）。
- cloudflared 只稽核、不 kill，輸出 `CLOUDFLARED_MANAGEMENT_MODE`、PID、PPID 與
  parent chain；若為 terminal-owned 先回報，再轉交 Windows Service／hidden
  Scheduled Task。

Sentinel hosting：hidden Scheduled Task `GhostIslandRO-RuntimeSentinel`
（`-WindowStyle Hidden -Continuous -IntervalSeconds 10`，`Settings.Hidden = $true`，
unlimited runtime，logon／boot trigger，restart on failure），不依賴
VSCode／Kilo／可見 CMD window。

```text
DIRECT_EXE_BYPASS_DETECTED
SECOND_RATHENA_AUTO_BLOCK
CANONICAL_LOGIN_PROTECTED / CANONICAL_CHAR_PROTECTED / CANONICAL_MAP_PROTECTED
CLOUDFLARED_MANAGEMENT_MODE / CLOUDFLARED_TERMINAL_ATTACHED
SENTINEL_VISIBLE_WINDOW = NO
LOGIN_COUNT / CHAR_COUNT / MAP_COUNT
```

回歸測試：`ops/ro-stack/tests/test-runtime-sentinel.ps1`。

## Production failure evidence

`GhostIslandRO-RuntimeSentinel` also observes the three PIDs already recorded in
`.local/ro-stack/state.json`. It retains process handles while those PIDs are
alive. On exit, the handle supplies the Windows exit time and exit code. If a
process disappears before the first observation, the collector records the poll
detection time, `UNAVAILABLE` exit code, and `UNDETERMINED` first service when
several exits cannot be ordered. It never starts or restarts a game process.

Evidence lives under the existing Production root at
`C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\runtime-incidents`.
Each incident has `incident.json`, `timeline.json`, `runtime-state.json`, bounded
stdout/stderr tails, sentinel and map launcher tails, Windows Application Error
or WER matches, and ProcDump references with SHA256 and size. A map dump remains
under the accepted `crash-capture` sidecar path. The sentinel reattaches the
approved ProcDump sidecar when the canonical map PID changes. It validates
`state.json`, the map path and start time, the sole map process and 5122 listener,
and the existing single-runtime guard decision. Before a new attachment it also
checks login/char/map port owners, Dashboard health, and OpenKore count zero.
After launch it verifies ProcDump's PID, process image, dump folder, ten exact
filters, and unchanged service port owners. It adopts an already running
approved sidecar and records it in `procdump-attachment-state.json`; repeated
ticks do not spawn duplicates. A failed attachment records `FAILED` and retries
after one minute without stopping the map. Arguments remain those in
`docs/project-control/canonical-procdump-map-crash-sidecar-v1.md`; login and char
are never attached. The old generation is evaluated for exits before its
observer state is replaced. Dump and incident
directories grant access to SYSTEM and Administrators only; Player Web has no
evidence route. Text evidence redacts known credential fields and authorization
headers. Dumps can contain process memory and remain sensitive.

Read the latest incident with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops\ro-stack\show-runtime-incident.ps1
```

The first observed unexpected exit opens one incident per runtime generation;
subsequent exits update its timeline. A canonical stop removes `state.json` and
does not create a crash incident. The collector marks `PROCESS_CRASH` only when
Windows Application Error evidence matches. A matching sentinel termination
audit marks `SENTINEL_TERMINATION`. Other exits remain `UNKNOWN` unless an
explicit lifecycle or launcher stop is recorded. A nonzero exit code by itself
does not prove a crash. `PROVEN` requires direct causal evidence, `SUSPECTED`
is a documented hypothesis, and `UNKNOWN` means evidence does not establish
root cause. The collector initializes `rootCauseStatus` as `UNKNOWN`.

The incident bundle has 30 day, 100 incident, and 512 MiB limits. The dump
directory has a 30 day and 2 GiB limit. A dump must be older than one day to be
removed for the size limit; before deletion its path, size, and SHA256 are
appended to `crash-capture/dump-retention-ledger.jsonl`. No active dump is
deleted. Windows events are queried within two minutes of first exit, and
late events/dumps are checked for three minutes. Log tails contain at most 200
lines and 256 KiB per source.

On incident only, `runtime-impact-snapshot.mjs` reads MariaDB with the existing
Dashboard DB credential kept in memory. `char.online=1` supplies online
character and distinct account counts, plus bounded character IDs. The existing
`persistent_agent_live_status` read model supplies resident PA modes and active
farm, journey, and quest counts. Supply and recovery phases take priority over
the enclosing agent mode. A resident PA row older than 15 seconds makes PA
counts `UNAVAILABLE`; DB or PA query failure also yields `UNAVAILABLE`, never
an inferred zero. The bundle remains writable when this read fails. At most 100
character IDs are stored, without names or private messages. Counts describe DB
state at capture time; they do not reconstruct the population before failure.
Process handles cannot report exits that occurred before observation; those
times and codes remain `UNAVAILABLE`. The operator should inspect the bundle,
confirm the first broken transition, then use the existing `ro-stack.ps1`
recovery procedure and the Production restart safety checklist above. Recovery
health is recorded after the existing runtime returns to one PID per game port.

Source regressions: `ops/ro-stack/tests/test-runtime-incident.ps1`,
`ops/ro-stack/tests/test-runtime-procdump-sidecar.ps1`, and
`ops/ro-stack/tests/test-runtime-impact-snapshot.mjs`. They use
synthetic process identities and temporary files; they do not crash Production.

## FINAL POLICY

```text
EXTRA_TEST_SERVER_ALLOWED = NO
PRODUCTION_RESTART_ALLOWED_WHEN_NEEDED = YES
SECOND_RATHENA_STACK_ALLOWED = NO
```
