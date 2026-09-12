---
name: implement-feature
description: 在 terminal-arpg 內以最小範圍實作一項已定義功能，完成必要測試與現況記錄。適用於功能、介面、API 或遊戲規則變更。
---

# Implement Feature

依序完成以下流程，並把每一步限制在任務範圍：

1. 定位相關模組、source of truth、既有測試與完成條件。
2. 先列出最小修改檔案與不會觸碰的範圍。
3. 以既有分層與契約完成實作；只有必要時才新增檔案。
4. 執行最相關的測試與文件檢查。依變更範圍補做 lint、build 或發布檢查。
5. 將完成內容、驗證結果與未完成項目更新到 `docs/CURRENT_STATUS.md`；必要時同步 `docs/TODO.md` 或來源稽核。
6. 檢查 `git diff`，確認沒有產出目錄或無關修改，回報結果後停止。

不要因測試或搜尋方便而擴大功能範圍，不要把未驗證的 RO／OpenKore 推導寫成正式規則。
