# RO 對話頻道與語音設計

更新日期：2026-09-11

## 原生系統盤點

鎖定版 OpenKore 與 rAthena 的文字聊天鏈路如下。網頁只提交型別化頻道與文字，OpenKore 發送封包，rAthena 決定可見範圍、資格與回送結果。

| 玩家頁分頁 | 原生送出 | 原生接收 | 條件 |
| --- | --- | --- | --- |
| 一般 | `sendChat()` | `packet_selfChat`、`packet_pubMsg` | 同畫面附近角色 |
| 密語 | `Misc::sendMessage(..., 'pm', ...)` | `packet_sentPM`、`packet_privMsg` | 指定角色在線且未封鎖 |
| 隊伍 | `sendPartyChat()` | `packet_partyMsg` | 已加入隊伍 |
| 公會 | `sendGuildChat()` | `packet_guildMsg` | 已加入公會 |
| 家族 | `sendClanChat()` | `packet_clanMsg` | 已加入家族 |
| 戰場 | `sendBattlegroundChat()` | `packet_pre/battleground_message` | 已加入戰場隊伍 |
| 地圖 | 密語目標 `#map` | rAthena `0x02C1`、OpenKore `npc_chat` | rAthena 地圖頻道 |
| 全服 | 密語目標 `#global` | 同上 | rAthena 全服頻道 |
| 交易 | 密語目標 `#trade` | 同上 | rAthena 交易頻道 |
| 支援 | 密語目標 `#support` | 同上 | rAthena 支援頻道 |
| 同盟 | 密語目標 `#ally` | 同上 | 已加入公會同盟 |
| 系統 | 唯讀 | `packet_sysMsg` | 伺服器訊息 |
| 全部 | 用戶端篩選 | 顯示全部事件 | 送出時使用一般頻道 |

來源：

- [OpenKore Commands.pm](https://github.com/OpenKore/openkore/blob/master/src/Commands.pm)
- [OpenKore Network Send](https://github.com/OpenKore/openkore/blob/master/src/Network/Send.pm)
- [OpenKore Network Receive](https://github.com/OpenKore/openkore/blob/master/src/Network/Receive.pm)
- [rAthena channels.conf](https://github.com/rathena/rathena/blob/master/conf/channels.conf)
- [rAthena clif.cpp](https://github.com/rathena/rathena/blob/master/src/map/clif.cpp)

## 玩家介面

- 對話欄固定在基本訊息視窗下方，切換其他功能頁仍常駐。
- 頻道列可水平捲動，手機 390×844 不產生頁面橫向溢出。
- 密語分頁顯示角色名稱欄；系統分頁停用輸入；一般頻道提供 RO 表情與語音。
- 顏色區分一般、密語、隊伍、公會、同盟與系統訊息。
- 所有文字以 `textContent` 顯示，玩家內容不進入 OpenKore 命令解析器。

## 語音訊息

語音屬網頁擴充功能，RO 與 OpenKore 鎖定版沒有原生語音訊息封包。

- 瀏覽器以 `MediaRecorder` 取得麥克風，支援 MP4、WebM、Ogg、AAC。
- 每則 0.25 至 30 秒，最大 1 MB，每帳號至少間隔 3 秒。
- 第一階段只開放一般頻道，送出當下與發話者位於同一張地圖的在線角色可見。
- 檔案儲存在本機執行資料夾，資料庫只保存 UUID、角色、地圖、MIME、大小與時間。
- 播放網址為登入保護的同源 `/api/social/voice/<uuid>`，不含檔案路徑、內網 IP 或後台位址。
- 公開測試前仍需加入檢舉、封鎖、保存期限、刪除與管理稽核。

## 2026-09-11 驗收

- 雙玩家實服：一般頻道、密語寄件與收件、地圖、全服、交易、支援、RO 表情均取得 rAthena 回送，繁中內容正確。
- 無資格測試：隊伍、公會、家族、同盟各自回送明確錯誤，未越權送出。
- 手機實機：本機與 Cloudflare HTTPS 均通過 13 分頁、密語欄、錄音、上傳與播放；兩次新錄音分別為 22,101 bytes 與 16,093 bytes，瀏覽器錯誤 0。
- 待驗收：建立真實隊伍、公會、家族、同盟與戰場後的多人雙向收發；聊天房、好友、封鎖、檢舉與語音管理。
