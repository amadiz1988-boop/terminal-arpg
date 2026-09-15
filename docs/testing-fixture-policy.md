# 鬼島傳說｜測試 Fixture 與開發驗證規範

本文件是所有開發工作線（A/B/C/D/E/G）共用的強制測試規範。

目的只有一個：**用最快、最穩定、可重現的方法驗證真正要測的功能，不要讓無關的角色狀態、地圖位置、補給、殘留 ownership 或測試環境雜訊反覆阻塞開發。**

---

## 1. 核心原則

測試固定拆成四個階段：

```text
SETUP / PROVISION
→ EXECUTE
→ ASSERT
→ CLEANUP
```

### SETUP / PROVISION 可以積極建立測試條件

在明確的隔離開發／測試環境中，只要修改是合理、可追蹤、可重現，而且不碰 production，就可以使用：

- 測試 DB 修改
- GM／管理指令
- fixture provisioning script
- 測試角色等級／Job 等級調整
- 合理能力值調整
- HP / SP 補滿
- 測試裝備配置
- 合理數量消耗品
- 測試地圖／座標配置
- 測試怪物生成
- 清場
- 測試旗標
- 測試專用 allowlist / environment variable
- 測試用 ownership / online 殘留清理（若該欄位本身不是本輪被測對象）
- 其他能縮短前置等待且不偽造核心結果的合法開發手段

**測試前置條件可以人工建立。**

### EXECUTE 必須由真正被測系統執行

例如測 AUTO_FARM 時，可以先把角色準備好、傳到合法位置、補滿血、給武器、生成指定普通怪；但以下核心鏈路必須真的由被測系統完成：

```text
claim
→ start_farm
→ target acquisition
→ movement
→ attack
→ authoritative combat mutation
→ stop/release
```

不得用 SQL、GM 指令或假資料直接取代本輪核心被測行為。

### ASSERT 必須驗證真實權威結果

應優先從真正 authority 或可驗證 runtime evidence 判斷：

- rAthena state
- Persistent Agent runtime / logs
- MariaDB authoritative state
- Dashboard / Web authoritative API
- 可重現的遊戲內結果

不能只靠「command 回傳成功」就宣告功能 PASS。

### CLEANUP 必須可預期

每輪測試結束，不論 PASS / FAIL / TIMEOUT，都應清理：

- 測試 process
- 測試 entity
- 測試 ownership
- 測試 spawned mobs / temp resources（若需要）
- fixture-only state
- isolated ports

並確認沒有污染 production。

---

## 2. 環境分級

所有測試先明確標記環境。

### A. `DEV_ISOLATED`

隔離 DB、隔離 ports、隔離 process、test-only fixture。

權限最高。

允許合理直接修改 DB、使用 GM／管理指令、建立怪物、傳送角色、補物資與重建 fixture。

### B. `TEST_SHARED`

共享測試環境，但沒有正式玩家資料。

允許 fixture provisioning，但必須避免影響其他工作線正在使用的 CID/AID、地圖與測試資源。

### C. `PRODUCTION`

正式環境。

不得把本文件對 test fixture 的寬鬆規則套用到 production。

Production 修改必須依正式 release / operator / audit 流程處理。

---

## 3. Fixture 優先於「傻等真實條件」

如果某個條件不是本輪要測的功能，就不要為了它浪費時間。

例如：

- 要測 AUTO_FARM combat，不需要等角色隨機走到怪旁邊。
- 要測 potion recovery，不需要等角色自然把血打到很低；可把 HP 建立到觸發閾值附近。
- 要測 death recovery，可以建立可重現的低血量／死亡 fixture。
- 要測 quest checkpoint，可以把角色 provision 到最近合法 checkpoint，而不是從出生點重跑全部歷史流程。
- 要測 storage，可直接準備有物品、有空格、有 Kafra 可用的測試角色。
- 要測 Web latency，不需要用正式玩家等待自然操作；可先用 test account / synthetic input 建立穩定測量條件。

固定原則：

> **測試從距離被測功能最近、合法、可重現的已知狀態開始。**

---

## 4. 允許直接修改 DB 的範圍

在 `DEV_ISOLATED` 或明確 test-only fixture 中，可以合理修改：

- Base / Job Level
- EXP / Job EXP
- stats
- HP / SP
- Zeny
- inventory / equipment
- consumables
- save point
- current test map / coordinate
- quest precondition（若 quest progression 本身不是被測內容）
- skill points / learned test skills
- test flags
- online/offline test residue
- ownership residue（若 ownership lifecycle 不是本輪被測內容）
- fixture metadata

所有修改應符合：

1. 只影響指定 test account / AID / CID。
2. 數值合理到足以穩定測試，不需要追求正式服養成真實度。
3. 不建立 God Mode 式無敵，除非本輪測試本來就不涉及 combat validity。
4. 不用 DB 直接寫入本輪要驗證的最終結果。
5. 可以重建、可以重跑、可以清理。

---

## 5. 允許使用 GM／管理指令的範圍

在 test-only 環境可使用管理能力加速 SETUP，例如：

- warp / teleport 到合法測試地點
- heal / restore
- give item / equipment
- spawn 指定普通怪
- kill / clear 測試場景中的非核心干擾怪
- set level / stat
- reset fixture
- establish save point
- create deterministic combat arena

但若該指令會直接完成本輪 ASSERT，要避免用它取代被測行為。

例：

- 測 AUTO_FARM：可 `warp + spawn mob`，但不能用 `@kill` 當成 AUTO_FARM 擊殺證據。
- 測 loot：可生成會掉落的怪，但不能直接 `@item` 後宣告 loot PASS。
- 測 navigation：可以把角色 provision 到 route 起點，但不能直接 warp 到終點當作 navigation PASS。

---

## 6. FLOW Fixture 與 BALANCE Fixture 必須分開

### FLOW Fixture

用途：驗證功能流程是否能正確跑通。

可以偏安全：

- 足夠 HP/SP
- 合理偏高戰力
- 正常武器
- 足夠但有限的補品
- 避免被無關怪物快速擊殺

目標是排除平衡噪音。

### BALANCE Fixture

用途：驗證正式玩家強度、死亡率、補給頻率、效率與經濟。

此時才需要接近正式玩家配置。

**不得拿 BALANCE 問題阻塞 FLOW 驗證，也不得拿 FLOW fixture 的安全配置宣告 BALANCE PASS。**

---

## 7. 測試角色最低要求

每個長期使用的測試角色至少應記錄：

```text
fixtureName
AID
CID
purpose
class/job
baseLevel/jobLevel
map/coord
stats
HP/SP
weapon/equipment
consumables
allowedAdminSetup
ownedByWorkline
resetProcedure
cleanupProcedure
```

對 combat FLOW fixture，預設應確保：

- 能對目標怪造成正常傷害
- 不會在數秒內無意義暴斃
- 有合理武器
- HP/SP 已恢復
- 如測試流程可能需要補品，提供有限合理數量
- 不啟用無敵／一擊必殺，除非該能力與本輪測試無關且有明確註記

---

## 8. 被測邊界（Test Boundary）必須先寫清楚

每一輪開始前先寫：

```text
TEST_OBJECTIVE:
TEST_BOUNDARY:
SETUP_ALLOWED:
SETUP_FORBIDDEN:
PASS_EVIDENCE:
CLEANUP:
```

例：

```text
TEST_OBJECTIVE:
OpenKore=0 時 Persistent Agent 能完成真實 AUTO_FARM combat。

TEST_BOUNDARY:
claim → target → move → attack → combat mutation → stop/release

SETUP_ALLOWED:
DB 調整測試角色戰力、GM warp、補滿 HP/SP、給正常武器、生成普通怪、test-only allowlist。

SETUP_FORBIDDEN:
直接寫 SERVER_AGENT 來取代 claim、直接寫 kill_count、直接修改怪 HP 當成 attack evidence。

PASS_EVIDENCE:
OpenKore=0、claim 成功、target acquired、角色移動、rAthena monster HP 真實下降、正常 stop/release。
```

只要先鎖定 Test Boundary，就不會把「測試便利手段」和「被測結果」混為一談。

---

## 9. 遇到 blocker 時的處理順序

不要第一時間擴大架構或換功能。

依序判斷：

1. **Fixture 問題？**
   - 等級太低
   - HP 太少
   - 沒武器
   - 沒補品
   - 地圖沒怪
   - 座標太遠
   - 舊 ownership residue
   - offline/online residue

2. **Harness 問題？**
   - process lifetime
   - timeout
   - port
   - logging
   - allowlist
   - test env variable

3. **Observation 問題？**
   - 功能可能有跑，但沒有足夠 evidence / hook / log

4. **真正 Runtime / Product Bug？**

前 1～3 類應先用最小成本解掉，再決定是否進入 source 修改。

---

## 10. 不要為了「純粹」而降低測試效率

以下不是品質：

- 堅持測試角色不能改 DB
- 堅持不能用 GM 指令建立前置狀態
- 堅持角色必須自然走到測試位置
- 堅持等待隨機怪生成到指定距離
- 明知角色太弱仍反覆讓它死亡
- 明知 fixture 已污染仍一直重跑

只要核心被測行為仍是真實執行，這些限制只會降低開發效率，不會提高證據品質。

---

## 11. 但禁止用 Fixture 偽造 PASS

以下明確禁止：

- 直接寫 ASSERT 結果後宣告 PASS
- 直接改 runtime output / log 讓測試看起來成功
- 用 SQL 假造 claim、combat、loot、navigation 等本輪被測事件
- 把 synthetic/mock evidence 當 production/live evidence
- 在沒有真實 authority mutation 時宣告 gameplay PASS
- 未標註 fixture modification 就提交測試報告

---

## 12. 可重現性要求

重要 fixture 不要只靠人工記憶。

優先建立：

- provisioning script
- reset script
- fixture manifest
- deterministic seed / test command

讓下一個執行者可以一鍵重建相同狀態。

若本輪為一次性人工 setup，至少在 evidence 中保存：

- 使用的 AID/CID
- DB changes
- GM/admin commands
- env overrides
- map/coord
- item/equipment
- before/after state

---

## 13. Production Boundary

任何 fixture shortcut 必須滿足：

```text
production_process_modified = 0
production_db_mutation = 0
production_player_modified = 0
```

除非使用者明確批准正式環境操作，而且該操作本身屬於正式營運／release 流程。

---

## 14. 工作線共用規則

A/B/C/D/E/G 所有執行者都必須遵守本文件。

如果工作指令和本文件衝突：

1. 使用者最新明確指示優先。
2. Production safety 不得被 test convenience 覆蓋。
3. 若只是測試方式不同，優先採用更快、更穩、更可重現的方法。

---

## 15. 最終判斷準則

一個好的開發測試應該回答：

> **我們到底在測什麼？**

然後把其他所有非必要變因盡可能控制掉。

因此本專案固定採用：

> **SETUP 可以積極人工建立；核心被測行為必須真跑；ASSERT 必須看真實權威結果；CLEANUP 必須可重現。**

這是鬼島傳說後續所有開發測試的預設規則。
