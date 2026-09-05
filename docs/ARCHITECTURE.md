# Architecture

Alpha 0.1 使用 Vinext、React 與 TypeScript。遊戲畫面由單一互動狀態機驅動，事件分為 MOVE、SCAN、CAST、CRIT、KILL、DROP、BOSS 與 EXIT。

後續版本將把計算、地圖事件、掉落及角色資料拆為獨立領域模組，並讓 Dummy DPS 與實際戰鬥共用 Modifier Engine。
