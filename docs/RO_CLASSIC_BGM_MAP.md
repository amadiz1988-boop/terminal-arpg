# RO 經典 BGM 編號與場景對照

## 使用原則

- 音訊檔以使用者已授權的台版官方客戶端 `BGM/<編號>.mp3` 為素材權威。
- 樂曲名稱與經典地圖用途以 RO Original Soundtrack 清單交叉核對。
- 現行台版客戶端的地圖配樂表與經典版本可能不同。本專案的經典模式依本文件固定，不跟隨現行客戶端覆寫。
- 「玩家印象」只作為體驗設計備註，不能改變地圖、編號或曲名資料。

## 經典主城

| BGM | 樂曲名稱 | 已核實經典場景 | 狀態 |
| --- | --- | --- | --- |
| 01 | Title | 登入畫面 | 已確認 |
| 08 | Theme of Prontera | 普隆德拉 | 已確認 |
| 11 | Theme of Morroc | 夢羅克室內／經典夢羅克主題 | 已確認，原提供表誤植為 12 |
| 13 | Theme of Geffen | 吉芬 | 已確認，原提供表誤植為 09 |
| 14 | Theme of Payon | 斐揚、弓箭手村 | 已確認 |
| 39 | Theme of Al de Baran | 艾爾帕蘭、鍊金術師領域 | 已確認，原提供表誤植為 17 |

補充：BGM 09 是 `Great honor`，使用於普隆德拉城堡等場景。BGM 17 是 `Treasure Hunter`，使用於沉沒之船。

## 經典野外與地下城

| BGM | 樂曲名稱 | 已核實經典場景 | 狀態 |
| --- | --- | --- | --- |
| 03 | Peaceful Forest | 斐揚森林 1 至 4、8、11；蘇克拉特沙漠 2、3、13 | 已確認 |
| 04 | I miss you | 普隆德拉原野 9 至 11；吉芬原野 11 | 已確認 |
| 05 | Tread on the ground | 普隆德拉原野 0、2 至 4、7 | 已確認 |
| 12 | Streamside | 普隆德拉原野 1、5、6、8 | 已確認；`prt_fild08` 使用此曲 |
| 19 | Under the ground | 普隆德拉地下水道 | 已確認 |
| 20 | Ancient groover | 斐揚洞穴 1 至 3 樓 | 已確認 |
| 21 | Through the tower | 吉芬地下城 1 至 2 樓 | 已確認 |
| 47 | Welcome Mr. Hwang | 斐揚洞穴 4 至 5 樓 | 已確認 |
| 58 | Jingle Bell on Ragnarok | 玩具工廠 | 已確認 |
| 59 | Theme of Lutie / Snow In My Heart | 薑餅城 | 已確認 |
| 66 | Wanna Be Free!! | WoE 原野與城堡 | 已確認 |
| 71 | Antique Cowboy | 朱諾原野 1、2、8、9、11、12 | 已確認；原提供表的聖誕配對錯誤 |

`Christmas in love` 對應 BGM 71：**【資料不足，無法確認】**。固定版資料已確認 71 為 `Antique Cowboy`，薑餅城經典場景應使用 58 或 59。

## 本專案目前啟用

| 情境 | 使用檔案 | 狀態 |
| --- | --- | --- |
| 登入／註冊 | `BGM/01.mp3` | 已接入 |
| 普隆德拉 | `BGM/08.mp3` | 已接入 |
| 普隆德拉原野 08 | `BGM/12.mp3` | 已接入 |

新地圖接入流程：先匯入 RSW／地圖代碼，再查經典對照，最後從已授權客戶端複製對應數字檔並保存 SHA-256。禁止依地圖名稱猜測編號。

## 來源

- 已授權台版客戶端：`C:\Program Files (x86)\Gravity\RagnarokOnline\BGM`
- iRO Wiki Original Soundtrack：https://irowiki.org/wiki/Original_Soundtrack
- iRO Wiki BGM Files：https://irowiki.org/wiki/BGM_Files

