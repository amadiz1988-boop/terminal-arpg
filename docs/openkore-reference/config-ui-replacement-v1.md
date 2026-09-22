# OpenKore Supply／Combat 設定介面替換稽核

日期：2026-09-22

本文件記錄本次設定層替換的來源、欄位語意與能力邊界。設定契約位於
`ops/ro-stack/dashboard/config-schema.mjs`，瀏覽器表單由同一份契約描述產生，
`/api/config` 只保存角色設定並回傳 adapter preview。它不建立第二個執行器，
不寫 `.cmd`、`.result`，也不宣稱角色已套用設定。

## 來源與版本

授權的本地 OpenKore 參照為 `.local/ro-stack/openkore`，commit
`51de1ddfc4449ae5217f6886de702f87ca934030`。本次逐項查閱：

| 類別 | 來源 | 採用方式 |
| --- | --- | --- |
| 攻擊選擇 | `src/AI/Attack.pm:724-766`、`src/Misc.pm:6557-6605` | `attackAuto` 與 `attackUseWeapon` 分開保存，距離與成熟布林鍵名沿用 |
| 攻擊技能 | `src/AI/Attack.pm:738-758,1057-1080` | 重複 `attackSkillSlot`、`maxAttempts`、`maxUses`、`maxCastTime` 等欄位保留 |
| 自身／隊伍技能 | `control/config.txt:654-701` | `useSelf_skill`、`partySkill` 可重複編輯；條件使用 checkSelfCondition 語意 |
| 補給 | `control/config.txt:734-803`、`src/AI/CoreLogic.pm` | buy/sell/storage/get 的成熟欄位分組保存 |
| 道具政策 | `control/items_control.txt` | 保留量、存倉、販售、推車旗標順序 |
| 拾取 | `control/pickupitems.txt` | `-1/0/1/2` 丟棄、跳過、拾取、優先拾取 |
| 怪物目標 | `control/mon_control.txt` | attack/teleport/search 等語意只作參照，不寫入角色世界狀態 |
| 原生編輯器 | `src/Interface/Wx/ConfigEditor.pm` | 採用分類、鍵值列、重設與說明的互動模式，不複製 Perl／Wx 程式碼 |
| 批次設定 | `plugins/xConf/xConf.pl` | 採用可重複鍵名與批次編輯概念，不啟用外掛執行期 |

目前專案的舊供給表單、`/api/supply-cycle` 與技能自動化控制已在稽核範圍內
分類。新表單只以 `/api/config` 為保存權威，舊端點不再是新表單的寫入路徑。

## 欄位分類

| 現有能力 | 分類 | 遷移處理 |
| --- | --- | --- |
| 供給開關、負重門檻、存倉／販售／採購 | `PROJECT_POLICY` 加 `MATURE_REFERENCE_EQUIVALENT` | `MIGRATE` 至 `supply` |
| `buyAuto` 數量、單價、Zeny、NPC 交易欄位 | `MATURE_REFERENCE_EQUIVALENT` | `ADAPT`，保留欄位與 UNKNOWN 報告 |
| 逐項拾取、丟棄、販售、存倉、推車 | `MATURE_REFERENCE_EQUIVALENT` | `ADAPT` 至 `pickupitems` 與 `items_control` 形狀 |
| 蝴蝶翅膀與蒼蠅翅膀 | `PROJECT_POLICY` | 固定存在性、不可消耗、重量 0；蒼蠅翅膀預設開啟 |
| 自動拾取／自動存放拾取物 | `PROJECT_POLICY` | 固定 `true`／`false`，表單唯讀 |
| 現有技能自動化列 | `DUPLICATE_CUSTOM` | `MIGRATE` 至重複技能陣列，保留既有條件 |
| 八個戰鬥模式 | `PROJECT_POLICY` 加 `MATURE_REFERENCE_EQUIVALENT` | 以 profile 描述產生基礎行為，欄位仍可個別編輯 |
| 伺服器目前沒有的 per-character native config command | `UNKNOWN`／`CAPABILITY_GAP` | 保存設定，adapter 回報 `applied=false` |
| OpenKore Wx／xConf 的執行器與 GUI 程式碼 | `LEGACY` | `REMOVE_DUPLICATE`，只保留行為證據 |

## 語意保護

`attackAuto=0` 代表反擊模式，並非關閉攻擊。純技能攻擊使用
`attackAuto=2` 加 `attackUseWeapon=0`，支援與被動跟隨使用
`attackAuto=-1` 加 `attackUseWeapon=0`。技能的 `maxCastTime` 與 `minCastTime`
是施法時間；冷卻或目標重試條件以成熟 timeout／condition 欄位保存，不以
施法時間冒充冷卻。

`items_control` 依成熟順序保存最小保留量、存倉、販售、推車加入、推車取出。
`pickupitems` 旗標保留 `-1/0/1/2` 的原義。固定政策覆蓋兩份拾取設定的自動存放
行為，避免把自動存放誤當成玩家可見的拾取開關。

## 遷移契約

每個來源欄位都在 `migration.mappings` 留下 `KEEP`、`ADAPT`、`MIGRATE` 或
`REMOVE_DUPLICATE`。無法由舊資料證實的值進入 `migration.unmapped`，不以預設值
靜默吞掉。保存採角色檔案與 revision，使用暫存檔加 rename，並拒絕過期 revision。

## 執行邊界

`canonicalToOpenKorePreview()` 只輸出可稽核的成熟欄位預覽。後端不呼叫
`ensureWorker`，不載入或重啟 OpenKore，不送出命令，不修改 rAthena。現行
SERVER_AGENT 的 `start_farm` 合約沒有完整 supply/combat profile 設定命令，因而
新 API 回傳：

```text
execution.applied = false
execution.controller = CONFIG_ONLY
execution.reason = CONFIG_ONLY_NO_EXECUTOR_COMMAND
```

這個狀態是設定層完成的事實，也是後續 native adapter work 的明確輸入。
