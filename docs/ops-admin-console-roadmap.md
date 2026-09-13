# RO 伺服器管理控制台與執行架構遷移 Roadmap

狀態：`active-plan`

建立日期：2026-09-13

本文件規劃可從手機使用的伺服器管理控制台，並定義現行 OpenKore 執行架構遷移至 rAthena Persistent Server Agent 時的穩定邊界。實際完成度仍以 [CURRENT_STATUS.md](CURRENT_STATUS.md) 為準；Persistent Agent 的功能與 runtime 證據以 [persistent-server-agent-roadmap.md](persistent-server-agent-roadmap.md) 為準。

## 1. 核心目標

1. Dashboard 無回應時，管理者仍能從獨立控制面確認服務、連接埠、程序與最近錯誤。
2. 每次故障保存可重播的 incident snapshot，讓停止原因具備程序、日誌、資料庫與網路證據。
3. 管理介面只依賴穩定的 Admin API，不直接解析 OpenKore log、命令目錄或 Persistent Agent 內部格式。
4. 角色執行器可由 OpenKore 切換至 Persistent Server Agent，管理介面與主要 API 保持相容。
5. 高風險操作具備前置檢查、稽核紀錄、有限重試、斷路器與安全 rollback。
6. Docker Compose 與 Portainer 僅在隔離環境通過後接管正式服務。

## 2. 本輪不包含

- 不安裝 Docker、Docker Desktop 或 Portainer。
- 不建立或啟動正式容器。
- 不停止、重新啟動或重新載入現行 Dashboard、MariaDB、rAthena、OpenKore 或 Cloudflare Tunnel。
- 不修改角色、任務、導航、補給、戰鬥或掉落行為。
- 不切換正式角色 ownership。
- 不開放公開管理 API。
- 不移除 OpenKore runtime、FLD2、資料表或來源查核工具。

## 3. 已確認現況

| 項目 | 現況 | 依據 |
| --- | --- | --- |
| 玩家入口 | `ops/ro-stack/dashboard.mjs` 提供 `127.0.0.1:8788` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 世界權威 | rAthena 與 MariaDB | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 自動操作 | 每角色 OpenKore worker | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 公開入口 | Cloudflare Named Tunnel 指向 Dashboard；Tunnel watchdog 已有故障注入證據 | [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| 主機層缺口 | Windows 開機自動啟動、主機層監督與長時間多人運作尚未完成驗收 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Persistent Agent | Production patch 與 controller 已存在，正式 stack 預設停用，尚未正式帳號 rollout | [persistent-server-agent-roadmap.md](persistent-server-agent-roadmap.md) |
| OpenKore 退場 | Phase 11 只完成靜態依賴矩陣，正式 runtime 變更為 0 | [persistent-server-agent-roadmap.md](persistent-server-agent-roadmap.md) |
| 容器設定 | Repository 尚無 Dockerfile、Compose 或 Portainer 設定 | 2026-09-13 Repository 掃描 |
| 本機容器工具 | 本機找不到 Docker CLI | 2026-09-13 唯讀環境檢查 |

目前完整容器化後的 rAthena runtime、Windows 主機網路、檔案系統效能與正式資料還原結果為 `【資料不足，無法確認】`。

## 4. 目標控制面

```text
手機管理介面
    │ HTTPS
    ▼
獨立 Ops Agent / Admin API
    ├── Service Supervisor Provider
    │     ├── Windows Native Supervisor
    │     └── Docker Supervisor / Portainer
    ├── Character Runtime Provider
    │     ├── OpenKore Provider
    │     └── Persistent Server Agent Provider
    ├── Incident Snapshot Store
    └── Audit Log

玩家 Dashboard
    └── 玩家工作階段、角色頁與玩家命令

rAthena + MariaDB
    └── 世界、角色、物品、任務與 ownership 權威資料
```

### 4.1 獨立 Ops Agent

Ops Agent 必須是與 8788 Dashboard 分離的程序。Dashboard 停止時，Ops Agent 仍需提供：

- 自身健康狀態。
- Dashboard、Tunnel、MariaDB、login-server、char-server、map-server 與 OpenKore workers 的健康摘要。
- 最後健康時間、最後錯誤、程序 ID、啟動時間、連接埠與 restart count。
- 經遮罩處理的最近日誌。
- incident snapshot 建立與讀取。

第一版只提供唯讀 API。啟停與重啟能力在安全契約完成後另行加入。

### 4.2 玩家面與管理面分離

| 項目 | 玩家 Dashboard | Ops Agent |
| --- | --- | --- |
| 使用者 | 玩家 | 管理者 |
| 工作階段 | 玩家帳號 session | 獨立管理者認證 |
| 角色操作 | 掛機、任務、裝備、配點 | ownership、隔離、復原與服務生命週期 |
| 健康檢查 | 玩家入口可用性 | 全 stack 與 Dashboard 本身 |
| 日誌 | 玩家可見事件 | 遮罩後系統與事故證據 |
| 失效時 | 玩家無法進入 | 仍可診斷 Dashboard |

## 5. 穩定資料契約

管理介面只讀取下列標準模型。Provider 負責轉換現行 Windows/OpenKore 與未來 Docker/Persistent Agent 的實際資料。

### 5.1 ServiceStatus

```json
{
  "serviceId": "map-server",
  "provider": "windows-native",
  "state": "healthy",
  "pid": 1234,
  "port": 5121,
  "startedAt": "2026-09-13T00:00:00+08:00",
  "lastHeartbeatAt": "2026-09-13T00:01:00+08:00",
  "restartCount": 0,
  "lastExitCode": null,
  "lastErrorCode": null,
  "evidence": []
}
```

允許的 `state`：

- `healthy`
- `degraded`
- `unreachable`
- `stopped`
- `starting`
- `stopping`
- `quarantined`
- `unknown`

`unknown` 必須附上缺少的證據，不得自動轉成 `stopped`。

### 5.2 CharacterRuntimeStatus

```json
{
  "accountId": 2000000,
  "characterId": 1500000,
  "owner": "OPENKORE",
  "provider": "openkore",
  "mode": "AUTO_FARM",
  "map": "prt_fild08",
  "lastHeartbeatAt": "2026-09-13T00:01:00+08:00",
  "commandQueueDepth": 0,
  "routeFailureCount": 0,
  "lastErrorCode": null,
  "actionAllowed": false
}
```

允許的 `owner` 以 Persistent Agent roadmap 的 ownership state machine 為準。管理介面不得從 worker process 是否存在自行推導 owner。

### 5.3 IncidentSnapshot

每份 snapshot 至少包含：

- snapshot ID、建立時間與觸發來源。
- 所有服務的 `ServiceStatus`。
- listener 與預期連接埠差異。
- 對應程序 executable path、command line 雜湊、PID、啟動時間、CPU 與 memory。
- Dashboard 本機健康、公開健康與 Tunnel 狀態。
- MariaDB 可連線狀態及只讀一致性摘要。
- 每角色 owner、provider、mode、map、heartbeat、queue depth 與最後錯誤。
- 經遮罩的最近日誌與原始證據路徑。
- snapshot schema version。

Snapshot 寫入 `.local/ro-stack/ops-agent/incidents/`，不加入 Git。密碼、session cookie、Tunnel token、資料庫 DSN 與完整玩家聊天內容不得寫入 snapshot。

### 5.4 AuditRecord

```json
{
  "actionId": "uuid",
  "actor": "admin-user-id",
  "action": "restart-service",
  "target": "map-server",
  "requestedAt": "2026-09-13T00:00:00+08:00",
  "preconditionRevision": 12,
  "result": "rejected",
  "reasonCode": "ACTIVE_AGENT_NOT_DRAINED",
  "completedAt": "2026-09-13T00:00:01+08:00"
}
```

Phase 1 與 Phase 2 不接受 mutation，因此不會建立管理動作紀錄。Phase 3 開始後，每個 mutation 都必須建立 AuditRecord。

## 6. 健康判定規則

單一程序存在不足以標記服務健康。每項服務依多層證據判定：

| 服務 | 必要證據 |
| --- | --- |
| Dashboard | 程序、8788 listener、本機 `/api/health` 回應 |
| 公開入口 | 本機 Dashboard 健康、Tunnel 程序、固定 HTTPS `/api/health` 回應 |
| MariaDB | 程序或服務狀態、3306 listener、只讀 query 成功 |
| login-server | 預期程序、6900 listener、rAthena service link |
| char-server | 預期程序、6121 listener、login/map service link |
| map-server | 預期程序、5121 listener、char service link、runtime heartbeat |
| OpenKore worker | 受管啟動資訊、PID、正確 executable path、角色 status heartbeat、owner=`OPENKORE` |
| Persistent Agent | MariaDB owner、單一 entity、controller heartbeat、mode/revision 一致 |

任一必要證據缺少時使用 `degraded`、`unreachable` 或 `unknown`，並回傳固定 reason code。

## 7. 安全控制契約

Phase 3 前禁止提供 start、stop、restart、claim、release 與 kill 按鈕。

### 7.1 一般服務操作

每個 mutation 依序執行：

1. 驗證管理者工作階段與 CSRF token。
2. 讀取目標服務及依賴服務的最新 revision。
3. 驗證動作 allowlist、目前狀態與冷卻時間。
4. 建立 AuditRecord。
5. 進入有限等待狀態。
6. 執行受管操作。
7. 重新取得程序、listener、health endpoint 與 service link 證據。
8. 將結果記錄為 `confirmed`、`rejected` 或 `failed`。

禁止將 timeout 記為成功。相同服務在固定時間內連續失敗達上限後進入 `quarantined`，停止自動重試。

### 7.2 map-server 安全停止

map-server 停止或重啟前必須：

1. 停止接受新的 Persistent Agent command。
2. 將 Agent drain 至可保存狀態。
3. 保存 intent、mode、phase 與 revision。
4. 停止 movement、attack、timer 與 NPC/service context。
5. 交由 rAthena 原生 shutdown 保存並釋放 entity。
6. 確認 entity 數量、`char.online` 與 ownership 符合 shutdown contract。
7. 保存 shutdown evidence 後才允許停止程序。

任一前置檢查失敗時拒絕動作，保留現行程序並回傳 reason code。

### 7.3 OpenKore 與 Server Agent ownership

- 同一角色禁止 OpenKore、RO Client 與 Server Agent 同時控制。
- fallback 單位為整個角色 ownership。
- OpenKore worker 啟動前驗證 owner/state、角色 offline、無 Agent entity 與無 pending claim。
- Agent claim 前驗證 OpenKore 已停止、角色 offline、無舊 entity 與 revision 相符。
- release 完成並確認 owner 回到 `OPENKORE` 後，才允許啟動 OpenKore。

## 8. 安全與外網邊界

- 管理入口使用與玩家 session 分離的認證。
- Portainer 只位於私人管理網路或受控存取層，不直接暴露於玩家入口。
- 第一版公開路由只允許唯讀 API；mutation 維持關閉。
- 管理 API 使用固定 allowlist，不接受任意 shell、SQL、OpenKore console 或檔案路徑。
- 日誌回應需遮罩密碼、token、cookie、DSN、IP 之外的敏感識別資料與聊天內容。
- 每個 mutation 具有 rate limit、CSRF、revision precondition、audit 與 reason code。
- Ops Agent 使用最小權限帳號；需要提高權限的動作透過受管 helper 執行。

完整管理者身分來源、第二因素驗證與正式授權角色模型為 `【資料不足，無法確認】`，Phase 3 前必須另案裁定。

## 9. 實作階段與 Gate

### Phase 0：Roadmap 與契約

交付：

- 本文件。
- 明確的現況、目標、非目標、資料契約、Git 切片與驗收條件。

完成條件：

- 文件只描述已存在能力與待實作契約。
- 不建立假 service、假 API、假 Portainer 或假 runtime 證據。
- `git diff --check` 通過。

### Phase 1：獨立唯讀 Ops Agent

狀態：`IMPLEMENTED / LOCAL READ-ONLY GATE PASS`

範圍：

- 建立與 Dashboard 分離的本機程序。
- 提供版本化唯讀 API：health、services、characters 與 evidence summary。
- 沿用現有 `ro-stack.ps1 health`、程序狀態、listener、Dashboard health 與公開 health 的已驗證讀取方法。
- 所有檢查具備 timeout，單一檢查失敗不阻塞整份狀態。

Gate：

- Dashboard 停止的隔離測試中，Ops Agent 仍能回覆並將 Dashboard 標為 `unreachable`。
- 低權限網路檢查失敗時不直接宣稱服務停止。
- Phase 1 API 不接受任何 mutation。
- 沒有讀取或回傳秘密。

### Phase 2：Incident Snapshot 與手機管理頁

狀態：`IN PROGRESS / INCIDENT SNAPSHOT GATE PASS / MOBILE UI PENDING`

範圍：

- 建立 incident snapshot、reason code 與保留政策。
- 建立以 390×844 為主要尺寸的管理頁。
- 顯示 stack 摘要、服務、角色 runtime、事故時間線與最近錯誤。
- 沒有 start、stop、restart 或 kill 控制。

Gate：

- Dashboard、Tunnel、單一 OpenKore worker 與 MariaDB 四類隔離故障均產出可辨識 snapshot。
- 390×844 無水平 overflow，主要狀態不依賴 hover。
- 服務狀態、snapshot 與原始證據一致。
- 敏感資料遮罩測試通過。

### Phase 3：Windows Native 安全控制

範圍：

- 先支援 Dashboard 與 Tunnel 的受管 start/restart。
- rAthena 依 shutdown contract 分開開啟。
- OpenKore 以單角色、整體 ownership 為單位操作。
- 建立 action queue、revision precondition、AuditRecord、冷卻與斷路器。

Gate：

- stale revision、未 drain Agent、owner 衝突與重複請求全部拒絕。
- Dashboard restart 後 Ops Agent 持續可用。
- 每項動作具有 accepted、confirmed 或 rejected 證據。
- rollback 以相同測試角色與資料通過。

### Phase 4：Character Runtime Provider

範圍：

- 將 OpenKore status/log/command dir 收斂至 OpenKore Provider。
- 將 Persistent Agent controller/state 收斂至 Server Agent Provider。
- UI 與 Admin API 僅使用標準 `CharacterRuntimeStatus`。
- 以 capability 回傳 runtime 支援範圍，不在前端 hardcode provider 行為。

Gate：

- 相同 UI 可顯示 OpenKore、SERVER_AGENT 與 QUARANTINED 角色。
- provider 切換不改 API schema。
- stat/skill、equipment、onboarding/job change、social 與 pet 尚未通過 Agent gate 時，Server Agent capability 明確為 disabled。
- 禁止混合 ownership 的 regression 通過。

### Phase 5：隔離 Docker Compose 與 Portainer 評估

範圍：

- 在獨立 port、獨立 MariaDB schema/volume 與測試帳號建立 Compose。
- 服務邊界為 MariaDB、login-server、char-server、map-server、Ops Agent、Dashboard、Cloudflared 與 Portainer。
- OpenKore 只保留 migration fallback profile，不做每角色 production 容器化投資。
- 使用 healthcheck、`depends_on.condition: service_healthy`、持久化 volume 與獨立 production override。

Gate：

- Compose config 驗證通過。
- 冷啟動與依賴順序通過。
- MariaDB volume 重建、備份與還原通過。
- login、char、map service link 通過。
- map-server graceful stop、restart recovery 與 entity 唯一性通過。
- Portainer 只能操作隔離環境，沒有正式資料 volume 或秘密存取。

Docker 官方文件確認 Compose 可使用 healthcheck 與 `service_healthy` 控制 readiness，並可用獨立 production override 管理環境差異：

- <https://docs.docker.com/compose/how-tos/startup-order/>
- <https://docs.docker.com/compose/how-tos/production/>

Portainer CE 官方文件確認其 Server 與 Agent 以容器執行，支援 Docker environment 管理：

- <https://docs.portainer.io/start/install-ce/server/docker/linux>

### Phase 6：Selected Account 與 Limited Rollout

範圍：

- 只使用核准測試帳號。
- 以整角色 ownership 切換 OpenKore 與 Server Agent。
- 驗證 lifecycle、combat、loot、skill、survival、death、navigation、NPC、service、quest、restart 與 rollback。
- 每個 cohort 可獨立退回 OpenKore。

Gate：

- Persistent Agent roadmap 的正式 dependency gate 全部具備 server-confirmed evidence。
- entity 永遠不超過 1。
- restart 後 owner、mode、phase、inventory、quest 與位置一致。
- rollback 後 OpenKore 接回同一角色，沒有 ghost entity 或 stale callback。

### Phase 7：OpenKore Runtime 退場

前置條件：

- Phase 6 全部通過。
- OpenKore Dependency Matrix 中每項 runtime dependency 已取得正式 regression。
- 管理控制面、備份、監控、告警、故障演練與 rollback 完成。
- 正式角色按 cohort 完成 Server Agent rollout。

執行原則：

- 逐 cohort 移除每角色 OpenKore runtime。
- 保留 OpenKore 鎖版資料表、FLD2 與來源查核工具，直到另有資產替代與驗證計畫。
- 移除前後保存 RAM、CPU、錯誤率、任務成功率、導航失敗率與 restart recovery 證據。

## 10. Git 功能切片

| Commit | 單一目的 | 預計內容 |
| --- | --- | --- |
| 0 | 建立 Roadmap | 本文件 |
| 1 | 固定 Admin API contract | schema、reason codes、contract tests |
| 2 | 建立唯讀 Ops Agent | health/services/characters providers、timeout 與遮罩測試 |
| 3 | 建立 incident snapshot | snapshot store、retention、redaction、四類故障 fixture |
| 4 | 建立手機管理頁 | 390×844 唯讀 UI、無 overflow、無 mutation controls |
| 5 | 建立 Windows safe actions | action queue、audit、revision、cooldown、circuit breaker |
| 6 | 建立 runtime providers | OpenKore Provider、Server Agent Provider、capability matrix |
| 7 | 建立隔離 Compose | Dockerfiles、Compose、healthcheck、volume、test profile |
| 8 | 評估 Portainer | 隔離 environment、管理網路、權限與操作證據 |
| 9 | Selected account rollout | 正式 gate、rollback、資源與穩定性報告 |

每個 commit 只加入該目的所需檔案。工作樹中其他功能變更不得混入。

## 11. 測試矩陣

### Read-only

- Ops Agent 自身健康。
- Dashboard 無 listener、HTTP timeout、HTTP 500 與 stale heartbeat。
- Tunnel process 存在但公開入口失敗。
- MariaDB listener 存在但 query 失敗。
- rAthena process 存在但 service link 失敗。
- OpenKore process path 錯誤、重複 worker、heartbeat stale 與 owner 衝突。
- 敏感欄位與聊天內容遮罩。
- 390×844 無水平 overflow、觸控目標可用、狀態文字可讀。

### Safe actions

- 重複 action ID 冪等。
- stale revision 拒絕。
- active player、active Agent、pending command 與 ownership conflict 拒絕。
- timeout 不標成功。
- restart loop 觸發斷路器。
- map-server drain、save、shutdown、start 與 recovery 證據完整。
- Ops Agent 在 Dashboard restart 全程可用。

### Runtime migration

- OpenKore 與 Server Agent 回傳相同 Admin API schema。
- 整角色 claim/release。
- lifecycle、combat、loot、skill、survival、death、navigation、NPC、service 與正式 quest regression。
- restart 後單一 entity。
- rollback 回 OpenKore。

## 12. Production 採用門檻

管理控制台標記 `production-ready` 前，必須同時具備：

1. 獨立 Ops Agent 長時間運作證據。
2. Dashboard 故障時仍可進入管理控制面。
3. 管理認證、CSRF、rate limit、audit 與秘密遮罩測試。
4. 服務 health 與實際程序、listener、HTTP、資料庫及 service link 一致。
5. 所有 mutation 的 precondition、reason code、timeout、cooldown 與 rollback。
6. 390×844 與桌面瀏覽器驗收。
7. 備份與還原演練。
8. 本機與公開管理入口安全審查。

Docker 與 Portainer 標記 `production-ready` 前，另需具備：

1. 隔離 Compose runtime 全項 gate。
2. volume 備份與還原。
3. map-server graceful shutdown 與 restart recovery。
4. 正式環境 secrets 管理。
5. Portainer 私有存取與最小權限。
6. 原生 Windows stack 的可執行 rollback。

## 13. 立即下一步

Phase 0 Admin API contract、Phase 1 獨立唯讀 Ops Agent及 Phase 2 incident snapshot 已完成。下一個功能切片固定為 390×844 手機管理頁，顯示 stack 摘要、服務、角色 runtime、事故時間線與最近錯誤。Phase 3 前維持零 mutation API。
