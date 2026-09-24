# RO 傳送之陣與瞬移音效考據

查核日：2026-09-24。狀態：`RESEARCHING`。本文件只記錄素材與未來 Presentation Layer 時序；`WARP_PORTAL_OPEN_SFX`、`FLY_TELEPORT_SFX` 均為 `UNRESOLVED`，等待玩家試聽與原廠 Client 事件驗證。

## 證據邊界

本機授權 Client：`C:\Program Files (x86)\Gravity\RagnarokOnline`。`Ragnarok.exe` File Version `2.0.0.1`，SHA-256 `41511e6294eabed6f174667539acd5dd0432de083a43b1869dda4846bb4c621c`。`data0.grf` SHA-256 `913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a`。本輪重新核對兩者 hash，GRF 唯讀。

本機 GRF 證明下列 WAV 位元組存在；現行 rAthena 的 `C:\Users\Administrator\source\ghost-island-rathena\db\re\skill_db.yml` 與同目錄 `item_db_usable.yml` 證明技能及道具規則。音效觸發對照來自已鎖定 `6470972260221c0fe0cd4825b66c5ac5fb20055a` 的 [roBrowserLegacy EffectTable](https://github.com/MrAntares/roBrowserLegacy/blob/6470972260221c0fe0cd4825b66c5ac5fb20055a/src/DB/Effects/EffectTable.js)；它是獨立 Client 實作參考，未等同此版本 Gravity 執行檔的呼叫證據。其 [SkillEffect](https://github.com/MrAntares/roBrowserLegacy/blob/6470972260221c0fe0cd4825b66c5ac5fb20055a/src/DB/Skills/SkillEffect.js#L79-L84) 明寫 `AL_TELEPORT`、`AL_WARP` 的效果對應不在該表。故目前無法宣稱完整 `skill → client effect → WAV` 原廠鏈條已證實。

現有 `docs/ro-ui-sound-index.json` 將 `ef_teleportation.wav` 記為 `ui.travel.fly-wing`，將 `warp.wav` 記為 `ui.travel.warp`，且兩筆 `clientBehaviorVerified=false`。`public/ro/client/sfx/official/combat-manifest.json` 的 `fly_wing.wav`、`warp.wav`、`portal.wav` 是本專案輸出別名，不是 GRF 原始檔名。`docs/RO_OFFICIAL_COMBAT_AUDIO_MAP.md` 的事件對照是本專案語意映射，不能升格為原廠 Client 播放證據。

## 技能、物品與效果鏈

| 對象 | 已核對鏈條 | 證據界線 |
| --- | --- | --- |
| 傳送之陣 | `skillId=27` → `AL_WARP` → `Unit: Warp_Active / Warp_Waiting`；[Gravity kRO 技能頁](https://ro.gnjoy.com/guide/runemidgarts/skillview.asp?lineseq=1&skillid=27) 名稱 `워프 포탈`；[rAthena 效果表](https://github.com/rathena/rathena/blob/master/doc/effect_list.md) 列 `EF_READYPORTAL2=316`、`EF_PORTAL2=317` | 現行 rAthena `src/map/skill.cpp` 的 `UNT_WARP_ACTIVE` 轉 `UNT_WARP_WAITING` 是 server unit 狀態；尚缺此 Client 版本對兩個效果 ID 的實際選擇與播放紀錄。 |
| 蒼蠅翅膀 | `itemId=601` → `Wing_Of_Fly` → `itemskill "AL_TELEPORT",1`；`skillId=26` → `AL_TELEPORT`；[Gravity kRO 技能頁](https://ro.gnjoy.com/guide/runemidgarts/skillview.asp?lineseq=1&skillid=26) 名稱 `텔레포테이션` | 物品腳本沒有獨立 WAV 欄位。此同一路徑只證明 server 技能語意，尚缺物品使用與技能施放在此 Client 上是否播放相同 WAV 的實機紀錄。 |
| 瞬移效果 | roBrowserLegacy `EffectTable` 中 `EF_TELEPORTATION=34`、`EF_TELEPORTATION2=304` 均引用 `effect/ef_teleportation` | 兩效果 ID 的對照屬獨立實作參考；此版本 Client 的瞬移封包與效果呼叫仍待核對。 |
| 傳送陣開啟效果 | 同表 `EF_READYPORTAL=35`、`EF_READYPORTAL2=316` 引用 `effect/ef_readyportal`；`EF_PORTAL2=317` 同時引用 `effect/ef_readyportal` 與 `effect/ef_portal` | `EF_READYPORTAL=35` 被 [rAthena 清單](https://github.com/rathena/rathena/blob/master/doc/effect_list.md) 標為舊版未使用。`316/317` 為較相關的候選，仍待本機原廠實機確認。 |
| 進入或換圖 | 同表 `EF_ENTRY=6` 引用 `effect/ef_portal`；`EF_ENTRY2=344` 也引用該 WAV | 進入傳送陣、普通換圖、目的地進場不可僅憑同一檔名混為一個事件。 |

[ragassets 效果 API 說明](https://github.com/adsonpleal/ragassets#ragnarok-skill-effects-str-visuals-and-audio) 提供 `skill-map → effect table → WAV` 查法。其公開 `skill-map[27].wav=["effect/warp"]` **不構成原廠技能對照證據**：[產生程式](https://github.com/adsonpleal/ragassets/blob/master/tools/gen-effect-tables.mjs#L327-L430) 在沒有明確效果映射時會把 `AL_WARP` 去掉職業前綴，按檔名找到 `warp.wav`。`skill-map[26]` 無明確資料。故 `warp.wav` 保留為試聽候選，不能定為傳送之陣開啟聲。

## 本機音效候選與量測

四檔皆為 `data0.grf` 唯讀解出、16-bit PCM、mono、22,050 Hz；SHA-256 是原始 WAV。時長使用 PCM frame 數除以 sample rate，未剪輯。`KRO_CLASSIC`、`KRO_RENEWAL`、`JRO`、`IRO` 對同名檔的版本差異尚無相應客戶端 hash 可比對，均記 `UNRESOLVED`。本機授權 Client 的伺服器地區及精確 build date 也未由 `2.0.0.1` 推定。

| 試聽代號 | 原始檔名／GRF path | bytes／frames／秒 | SHA-256 | 對應依據及狀態 |
| --- | --- | --- | --- | --- |
| 傳送之陣 A：準備 | `ef_readyportal.wav`；`data0.grf:data/wav/effect/ef_readyportal.wav` | 18,676／9,316／0.422494 | `d011b5576002352515f68a0d1b4a138389cc90a68e9df8fee2363644fb63771a` | EffectTable `35/316/317` → 此 WAV；`CANDIDATE` |
| 傳送之陣 B：開啟／進入 | `ef_portal.wav`；`data0.grf:data/wav/effect/ef_portal.wav` | 84,656／42,240／1.915646 | `fe87f49897cc025485dbb86feeac2b8d4c03a84e9dba6651afaef81d0dea1cfe` | EffectTable `317` 開啟、`6/344` 進出效果 → 此 WAV；`CANDIDATE` |
| 傳送之陣 C：既有 Web 換圖聲 | `warp.wav`；`data0.grf:data/wav/effect/warp.wav` | 251,012／125,440／5.688889 | `d74f63cb03879178d647ee3a3982a93b7ee949083e20e6bc3e8c7ea5715cbe08` | 檔案已證實；`AL_WARP` 關聯目前只見檔名推配及本專案既有映射；`UNRESOLVED` |
| Teleport／Fly Wing A | `ef_teleportation.wav`；`data0.grf:data/wav/effect/ef_teleportation.wav` | 54,828／27,392／1.242268 | `7527a65b58ba61ddc664c9b1da5c03f2058417a6ef1036b6cef6d24c26ff5ffd` | EffectTable `34/304` → 此 WAV；物品 601 → 技能 26；Client 觸發仍待驗證，`CANDIDATE` |

上述四檔位於 `.local/ro-warp-audio/` 供本機試聽；`ef_portal`、`warp`、`ef_teleportation` 另已存在於 `public/ro/client/sfx/official/`，輸出名稱分別為 `portal.wav`、`warp.wav`、`fly_wing.wav`，hash 同上。`.local` 內容不提交、不部署。`listen.html` 僅提供獨立播放控制，不執行遊戲指令。

## 原文、編碼與 alias

四個候選的 `ORIGINAL_FILENAME` 和 `DECODED_FILENAME` 相同，均為表中的 ASCII 檔名。下表 hex 是將 GRF 工具列示的 `data\wav\effect\...` ASCII 路徑回編所得；`RAW_FILENAME_BYTES` 尚未從封裝索引獨立讀出，記 `UNRESOLVED`，不能把回編結果當成原始索引 dump。ASCII 在 CP949、EUC-KR、UTF-8 解碼一致。由於該四條路徑沒有非 ASCII 字元，UTF-8 誤解及 Latin-1 round-trip 不會產生另一個有效名稱。`GRF_PATH` 是 `data0.grf:` 加表中的正規化 path。韓文技能名是搜尋 alias，並非聲音檔原名；不可把技能名推作韓文檔名。

| path／原始檔名 | 工具列示路徑回編 bytes hex | 韓文名稱／英、日 alias／中文描述 |
| --- | --- | --- |
| `data/wav/effect/ef_readyportal.wav` | `646174615c7761765c6566666563745c65665f7265616479706f7274616c2e776176` | `워프 포탈`；Warp Portal／ワープポータル；傳送陣準備候選 |
| `data/wav/effect/ef_portal.wav` | `646174615c7761765c6566666563745c65665f706f7274616c2e776176` | `워프 포탈`；Warp Portal／ワープポータル；傳送陣開啟或入場候選 |
| `data/wav/effect/warp.wav` | `646174615c7761765c6566666563745c776172702e776176` | `워프 포탈`；Warp Portal／ワープポータル；用途未定候選 |
| `data/wav/effect/ef_teleportation.wav` | `646174615c7761765c6566666563745c65665f74656c65706f72746174696f6e2e776176` | `텔레포테이션`／`파리의 날개`；Teleport／Fly Wing；テレポート／ハエの羽；瞬移候選 |

韓文名稱的 CP949 與 EUC-KR 編碼交叉檢查：`워프 포탈` → `bff6c7c120c6f7c5bb`；`텔레포테이션` → `c5dab7b9c6f7c5d7c0ccbcc7`；`파리의 날개` → `c6c4b8aec0c720b3afb0b3`。這些是**查詢詞編碼**，不宣稱是 WAV 原始檔名 bytes。Gravity 官方韓文[技能 27](https://ro.gnjoy.com/guide/runemidgarts/skillview.asp?lineseq=1&skillid=27)、[技能 26](https://ro.gnjoy.com/guide/runemidgarts/skillview.asp?lineseq=1&skillid=26)、[物品列表](https://ro.gnjoy.com/guide/runemidgarts/itemspeciallist.asp) 與 GungHo 官方[日文傳送技能名稱](https://ragnarokonline.gungho.jp/news/information/map_maintenance.html)、[ハエの羽／テレポート關係](https://ragnarokonline.gungho.jp/gameguide/item/special-item/giant-fly-wing.html) 供 alias 核對。`data0.grf` 的某些韓文 Sprite 父資料夾經 GRF 函式庫列示為 `������`；該亂碼未被當成缺檔，技能 ACT 以 basename 取得，原始父資料夾 bytes 仍未確定。

GRF 清單對 `.wav`、`.ogg`、`.mp3`、`.str`、`.spr`、`.act`、`.lub`、`.lua` 均用英文 `warp/portal/teleport/fly` 及韓文 `워프/포탈/텔레` 查詢；排除名稱相近的蝴蝶造型裝飾與 NPC 後，本輪相關檔案為上表 WAV、技能 ACT／SPR 及效果貼圖。未取得 `AL_WARP` 或 `AL_TELEPORT` 對 WAV 的 `.lub/.lua` 明示引用，也未找到同名 OGG／MP3。這是定向檔名與已知索引查核，不能證明 Client 執行檔內沒有其他間接引用。韓文效果「內部符號」目前只找到英文 enum `EF_READYPORTAL2`、`EF_PORTAL2`、`EF_TELEPORTATION2`；韓文內部符號 `UNRESOLVED`。

## 視覺效果素材

`WARP_PORTAL_VISUAL_ASSET_FOUND = YES`，範圍限於「來源與獨立效果表對照」：`EF_READYPORTAL2=316`、`EF_PORTAL2=317` 均用圓環幾何與 `data0.grf:data/texture/effect/ring_blue.tga`；317 另用 `alpha1.tga`；舊版 35 使用 `alpha_down.tga`。[EffectTable 316/317](https://github.com/MrAntares/roBrowserLegacy/blob/6470972260221c0fe0cd4825b66c5ac5fb20055a/src/DB/Effects/EffectTable.js#L6822-L6905) 有對應 texture 與音效欄位。唯讀抽取後 hash：`ring_blue.tga` `4afb6b406b03b119ca39579af295ab2a858123f95d93120f4d9e58f852225f54`；`alpha1.tga` `faa164ba1256cfda6c1c20ef9cb241be6bb5f5cd9759d86801483252c541db51`；`alpha_down.tga` `315a4ae73bfe1a9c59692bea35a18169fe1d1907e7077cd82fc7ed21e3b0ad65`。GRF 另含 `al_warp.act/.spr`、`al_teleport.act/.spr`，目前沒有證據可把它們直接指定為 Portal 地面效果。已檢索 `data0.grf` 的 2,785 筆、`data.grf` 的 510 筆 STR 檔名，沒有名稱直指 warp／portal／teleport 的檔案；上述效果為表內 `CYLINDER`，不依賴同名 STR。視覺效果在本輪不接入 Web。

## 未來 World Travel 音訊銜接

目前 `ops/ro-stack/dashboard/app.js` 用單一 `#bgm`、`setMusicContext(map)` 選曲，沒有 fade 控制；世界地圖傳送在 `waitForWorldMapAuthority` 回傳後播放 `warp` 並顯示抵達。以下只是一份 Presentation Layer 方案，不更動 Server Direct Teleport 或到達判定：

1. `AUTHORITATIVE_PREFLIGHT_PASS` 後，保留已驗證傳送命令，將現有 BGM 拉低至靜音，再播玩家確認的 Portal 開啟素材。fade 時長須依選定素材及實際聆聽決定，本輪不指定常數。
2. Portal 開啟素材結束後，才啟動玩家確認的 Teleport／Fly Wing 素材。若選「準備 A → 開啟 B → 瞬移 A」完整順播，素材長度合計 `0.422494 + 1.915646 + 1.242268 = 3.580408 秒`；這是檔案時長相加，尚非批准的 UX 延遲。其他選法須重算。
3. Server relocation 與音訊並行。只有 `ARRIVAL_CONFIRMED` 且所選音訊序列完成，才能關閉過場、揭露目的地並對目的地 BGM fade in。音訊先結束就保持等待；Server 先到就等音訊。失敗時維持未抵達狀態並恢復當前地圖 BGM。
4. 在過場期間需暫緩現有 `setMusicContext(map)` 的自動 BGM 換曲，確保 old BGM、Portal、Teleport、new BGM 不同時互蓋；完成後才交回既有 map BGM 選曲機制。這項是未來接入需求，本輪未實作或驗收。

## 尚未解決

- 這份 `Ragnarok.exe` 的技能／效果封包到聲音播放呼叫點，尚無直接證據。`AL_WARP → 316/317 → ef_readyportal/ef_portal`、`AL_TELEPORT → 304 → ef_teleportation` 均維持候選鏈，不能標 `CONFIRMED`。
- `warp.wav` 的實際 Client 觸發事件及 5.689 秒是否包含沉默尾段未驗證。
- Fly Wing 與手動 Teleport 技能是否完全同一聲音、同圖瞬移與跨圖是否相同、Classic／Renewal／JRO／IRO 版差異，均未取得同版本實機與多版本 hash。
- 韓文 Sprite 父資料夾的 raw GRF bytes 尚未還原；音效候選檔名為 ASCII，不受此缺口影響。
- 玩家尚未試聽確認。試聽喜好不會替代 Client 事件考據。

## 本輪界線

`PRODUCTION_TOUCHED=NO`；`RUNTIME_RESTARTED=NO`；`M1_RUNTIME_INTEGRATION=NO`。不新增正式音訊 mapping，也不把 `sourceVerified` 推論為 `clientBehaviorVerified`。
