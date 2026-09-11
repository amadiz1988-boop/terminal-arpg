# RO 本機伺服器架構與啟動基準

## 已完成的啟動證據

2026-09-10 在 Windows 11 本機完成隔離測試：

- MariaDB 12.3.3 於 `127.0.0.1:3307` 啟動，主資料庫 60 張表，紀錄資料庫 10 張表；資料庫不接受區網或公網直連。
- rAthena `e985006171d2eb320ee512a653f4c83aea3d81b6` 以 Visual Studio Build Tools 17.14.40 完整編譯。
- 初次隔離測試的 Login、Character、Map Server 分別於 6900、6121、5121 啟動並互相驗證。持續開發環境改用 6901、6122、5122，避開無法由低權限工作階段回收的舊程序。
- Map Server 載入 3,125 個 NPC 後進入 online 狀態。
- OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030` 使用 `kRO_RagexeRE_2021_11_03` 封包成功登入。
- 測試初心者進入 `prontera.gat (156,191)`，收到附近 NPC 與角色狀態。
- OpenKore 正常離線後，角色 `online=0`、地圖及座標仍保存在 MariaDB。
- OpenKore 測試角色已實際完成登入、跨圖尋路、逐擊戰鬥、受傷、死亡回城、掉落拾取、人物與職業升級。
- 本機控制頁可開始、停止及重新啟動 OpenKore。停止後角色資料寫回 MariaDB，重新啟動會登入同一角色並回到指定掛圖。

## 固定責任分界

```text
瀏覽器 RO 介面
  ↓ HTTPS / JSON
控制平面 API
  ├ 帳號申請與工作階段
  ├ 角色建立與選擇
  ├ 掛機啟動、停止、重啟
  └ 狀態與 LOG 串流
  ↓ 本機程序控制與 SQL
每角色一個 OpenKore 程序
  ↓ RO 封包
rAthena Login / Character / Map Server
  ↓ SQL
MariaDB
```

rAthena 與 MariaDB 是角色、物品、地圖與世界狀態的唯一權威來源。OpenKore 是角色自動操作執行器。瀏覽器只提交玩家設定並呈現伺服器事件。

現有 D1 原型帳號資料不得直接成為正式角色權威資料。正式銜接時由控制平面建立 rAthena 帳號，D1 僅保留網站工作階段或移除，避免雙重帳號來源。

## 本機與未來雲端的對齊方式

| 層 | 本機 | 未來雲端 |
| --- | --- | --- |
| Web UI | 本機預覽或 Sites | Sites |
| 控制平面 | Windows Node 服務 | Linux VM Node 服務 |
| 掛機執行器 | OpenKore 子程序 | OpenKore 容器或受管程序 |
| RO 世界 | rAthena Windows 程序 | rAthena Linux 服務 |
| 資料庫 | MariaDB 本機服務 | 受管 MariaDB 或專用資料庫主機 |

控制平面 API 契約維持一致，搬到雲端時只更換程序驅動器、資料庫連線與密碼來源。

## 對外入口與固定公網 IP

固定公網 IP 可讓 DNS A 記錄長期指向同一台來源主機，也可簡化直接連線與路由器轉發。此模式會讓來源 IP 成為公開攻擊目標，不採用為玩家正式入口。

朋友測試與正式入口採以下路徑：

```text
玩家 HTTPS 網域
→ Cloudflare 邊緣代理
→ outbound-only Tunnel
→ 127.0.0.1:8788 控制平面
→ localhost rAthena／OpenKore／MariaDB
```

- 來源主機不建立玩家可直連的 DNS-only A 記錄。
- 路由器不轉發控制平面、MariaDB、Login、Character、Map 或管理連接埠。
- 固定公網 IP 只作為網路穩定條件與災難復原資訊，不寫入前端、玩家 API、公開文件或錯誤訊息。
- Tunnel 中斷時入口顯示離線，不能自動降級成直連來源 IP。
- 未來遷移雲端時保持相同公開網域與 API 契約，只替換 Tunnel 後方來源。

安全邊界與攻擊驗收依 `docs/PLAYER_INTERFACE_SECURITY_BOUNDARY.md` 執行。

## 本機操作

首次設定前，將 MariaDB root 密碼放在目前終端的 `RO_DB_ROOT_PASSWORD` 環境變數，再執行 `setup-local-ro.cmd`。

- `setup-local-ro.cmd`：取得固定版本、編譯 rAthena、建立隔離資料庫及設定。
- `start-local-ro.cmd`：啟動資料庫與 rAthena 三服務。
- `health-local-ro.cmd`：檢查程序、四個連接埠及資料表。
- `stop-local-ro.cmd`：停止本專案啟動的程序及專用資料庫服務。
- `start-local-playable.cmd`：檢查並啟動整套服務、測試角色 OpenKore 與本機控制頁，接著開啟 `http://127.0.0.1:8788/`。
- `test-local-playable.cmd`：驗證伺服器互連、控制頁、OpenKore 程序、真實攻擊與經驗事件。
- `stop-local-playable.cmd`：停止測試角色 OpenKore 與本機 RO 服務。

所有執行檔、來源、密碼、LOG 與程序狀態位於 `.local/ro-stack`，已排除於 Git。

`health-local-ro.cmd` 的通過條件是專用資料庫服務、四個連接埠、三個受追蹤程序、登入與角色伺服器連線、角色與地圖伺服器連線、60 張主資料表與 10 張紀錄資料表同時正常。啟動狀態檔只接受位於本專案 `.local/ro-stack` 的三個執行檔，避免將其他同名程序誤判為健康。

rAthena 的跨伺服器帳號與密碼封包欄位各為 24 bytes，其中 1 byte 保留給字串結尾。自動產生的內部帳號與密碼必須維持在 23 個 ASCII 字元內。健康檢查必須驗證兩段跨服務連線紀錄，僅有程序和連接埠不足以判定世界服務可用。

## 本機可玩切片已通過

2026-09-10 的實際驗收角色從人物等級 3、職業等級 8 持續掛機至人物等級 6、職業等級 10。停止掛機後 MariaDB 保存人物經驗 809、職業經驗 1456、背包 12 列共 49 件，角色 `online=0`。重新啟動後 OpenKore 顯示同一角色 6／10，從普隆德拉自動進入 `prt_fild08` 並繼續逐擊戰鬥。

## 尚未通過

- 網頁帳號申請同步建立 rAthena 帳號。
- 網頁建立角色並符合固定版 rAthena 欄位與限制。
- 任意玩家角色自動建立專屬 OpenKore 背景程序。
- 多帳號同時掛機、崩潰自動重啟及併發限制。
- 百人測試、備份、TLS、防火牆、密碼輪替與監控。

上述項目狀態為 `【資料不足，無法確認】`，完成整合測試前不得標記為可供百人測試。
