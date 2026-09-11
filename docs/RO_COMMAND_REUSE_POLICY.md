# rAthena 與 OpenKore 指令重用規範

## 結論

鬼島傳說的玩家操作優先呼叫 OpenKore 已有指令，NPC 與任務優先使用 rAthena 腳本命令，管理與測試才使用 rAthena atcommand。網頁層只送出白名單動作，不接受原始命令字串。

## 已核實基線

- rAthena 鎖定提交：`e985006171d2eb320ee512a653f4c83aea3d81b6`
- OpenKore 鎖定提交：`51de1ddfc4449ae5217f6886de702f87ca934030`
- rAthena 的 atcommand 文件分為系統、資料庫、玩家資訊、動作、管理、隊伍、公會、寵物、生命體、頻道與家族等十一類。
- OpenKore `Commands::run()` 是主控台指令入口。指令涵蓋攻擊、AI、尋路、傳送、能力與技能配點、道具、裝備、拾取、NPC、倉庫、買賣及經驗統計。

## 實作分層

| 層級 | 用途 | 範例 |
| --- | --- | --- |
| OpenKore 玩家命令 | 玩家正常可做的即時行為 | `st add`、`skills add`、`move`、`tele`、`a`、`use`、`eq`、`talk`、`storage` |
| rAthena 腳本命令 | NPC、任務、轉職與遊戲規則 | 對話、獎勵、傳送、狀態與任務流程 |
| rAthena atcommand | 管理、診斷、資料維護、明確授權的測試 | `@rates`、`@mobinfo`、`@iteminfo`、`@who`、`@reload*` |
| 自訂橋接 | 現有指令無法涵蓋的安全 API | 白名單佇列、確認回條、帳號隔離 |

## 安全鐵律

1. 玩家端不得傳入原始 OpenKore 指令、封包、SQL、`@` 指令或 `#` 指令。
2. 每個功能映射成固定 action 與強型別參數。
3. 玩家行為由該帳號的 OpenKore 程序發送，rAthena 驗證成本、冷卻、距離、道具與角色狀態。
4. 一般玩家不提高 GM 權限。
5. 指令已排入佇列、伺服器已接受、資料已持久化分開顯示與驗證。
6. 有消耗的操作需序列化並防止重複送出。
7. 找不到內建指令時，先在鎖定源碼確認缺口並留下紀錄，再新增專案邏輯。
8. 玩家介面只送固定路由與白名單 action，不能輸入、拼接或轉送任何原始玩家命令與管理命令。
9. 玩家字串以純文字節點顯示；跨站狀態變更、未知 action、額外權限參數與非本人角色一律拒絕。
10. 完整規則與驗收依 `docs/PLAYER_INTERFACE_SECURITY_BOUNDARY.md` 執行。

## 目前已採用

- 道具使用、穿戴、卸下由 OpenKore 角色程序執行。
- 掛機中能力配點由 OpenKore `st add <stat>` 執行。
- 全部能力重置不向玩家開放 `@resetstat`。控制層暫停帳號 worker，依角色已花費點數完整退還，寫入離線角色資料，再恢復原掛機意圖。

## 主要來源

- [rAthena atcommand 文件](https://github.com/rathena/rathena/blob/master/doc/atcommands.txt)
- [OpenKore Commands.pm](https://github.com/OpenKore/openkore/blob/master/src/Commands.pm)
- [OpenKore Console Commands](https://wiki.openkore.com/index.php?title=Console_Commands&redirect=no)
