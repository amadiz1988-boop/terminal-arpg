---
name: project-handoff
description: 快速接手 terminal-arpg 的新 Work 或 Codex 任務，建立最小必要上下文並避免無目的掃描。適用於新工作啟動、狀態盤點與任務範圍確認。
---

# Project Handoff

用於新工作接手。先讀取 `AGENTS.md`、`docs/CURRENT_STATUS.md`、`docs/ARCHITECTURE.md`，再依任務需要讀取指定文件、程式與測試。若任務涉及產品規則或 TODO 驗收，再讀 `docs/GAME_DESIGN.md`、`docs/TODO.md`。

接手時先確認：

1. `git status --short --branch`，保留既有修改。
2. 現況文件中的已完成、進行中、下一步與驗證快照。
3. 與本次任務直接相關的 source of truth、完成條件與檔案範圍。

只搜尋已由任務或文件指向的路徑。不要預先讀完整 Git 歷史、`node_modules`、產出目錄或整個 repository。完成範圍判定後停止探索，交由對應的實作或除錯流程處理。
