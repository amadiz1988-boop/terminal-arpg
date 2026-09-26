# Kafra Save Point Town Travel Census V1

Source baseline: Native `f7e4097ea2a26c7b204004bfeb5a605324cf2a79`; Web baseline `5f91954787d0c034172473f7a8247ca35e2e2dc9`.

The loaded permanent service scripts are `npc/kafras/kafras.txt` and `npc/re/kafras/kafras.txt`. Native's generated `src/map/persistent_agent_kafra_save_catalog.hpp` contains 39 distinct Save destinations on 26 maps. Web parses those same scripts and tests the full `map:x:y:npc` set against that header. Every authored destination below has a loaded, passable map-cache cell. Runtime NPC availability remains Native's authority.

Selection: Nine maps have multiple authored Save destinations. Prontera stays at `116,73`. The current Web routing graph does not supply actual same-map path costs from each Save cell to a legal M1 merchant, storage service, or town exit. The source-backed fallback is ascending `x,y` order. Arrival and Saved Point remain separate fields, although both initially use the selected authored coordinate. No merchant or existing Town allowlist gates admission.

Values: Y = yes; N = no; U = source not verified for merchant presence. CURRENT_PLAYER_VISIBLE is the four-node Web baseline. The three maps absent from the World Map position index appear in its adjacent destination list. EVIDENCE paths are relative to canonical Native source. EXCLUSION_REASON is NONE for all 26.

| MAP_ID | DISPLAY_NAME | LOCATION_CLASS | MF_TOWN | KAFRA_SAVE_SERVICE | AUTHORITATIVE_SAVE_DESTINATIONS | CANONICAL_SELECTED_DESTINATION | CURRENT_PLAYER_VISIBLE | PLAYER_TOWN_TRAVEL_ELIGIBLE | PLAYER_SAVED_TOWN_ELIGIBLE | FARM_CAPABILITY | DUAL_ROLE | MERCHANT_PRESENT | EXCLUSION_REASON | EVIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| alberta | 港都 艾爾貝塔 | ACTUAL_TOWN | Y | Y | 31,231; 117,57 | 31,231 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:356,371 |
| aldeba_in | 艾爾帕蘭內部 | SERVICE_HUB | N | Y | 96,179 | 96,179 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:46 |
| aldebaran | 運河之都 艾爾帕蘭 | ACTUAL_TOWN | Y | Y | 143,109 | 143,109 | Y | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:124 |
| amatsu | 天水之國 天津町 | ACTUAL_TOWN | Y | Y | 116,94 | 116,94 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:444 |
| ayothaya | 哎喲泰雅 | ACTUAL_TOWN | Y | Y | 149,69 | 149,69 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:459 |
| brasilis | 巴西 | ACTUAL_TOWN | Y | Y | 195,259 | 195,259 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:696 |
| cmd_fild07 | 發樂斯 燈塔島 | FIELD_SAVE_HUB | N | Y | 127,134 | 127,134 | N | Y | Y | Y | Y | U | NONE | npc/kafras/kafras.txt:401 |
| comodo | 海邊之都 克魔島 | ACTUAL_TOWN | Y | Y | 204,143 | 204,143 | Y | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:387 |
| dewata | 德瓦他 | ACTUAL_TOWN | Y | Y | 206,174 | 206,174 | N | Y | Y | N | N | U | NONE | npc/re/kafras/kafras.txt:37 |
| einbech | 採礦村艾音貝赫 | ACTUAL_TOWN | Y | Y | 182,124 | 182,124 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:473 |
| einbroch | 鋼鐵之都 艾音布羅克 | ACTUAL_TOWN | Y | Y | 238,198; 240,197 | 238,198 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:488,501 |
| geffen | 魔法之都 吉芬 | ACTUAL_TOWN | Y | Y | 119,40; 200,124 | 119,40 | N | Y | Y | N | N | Y | NONE | npc/kafras/kafras.txt:139,154 |
| glast_01 | 克雷斯特漢姆古城 | SERVICE_HUB | N | Y | 200,272 | 200,272 | N | Y | Y | Y | Y | U | NONE | npc/re/kafras/kafras.txt:46 |
| gonryun | 神仙之島崑崙 | ACTUAL_TOWN | Y | Y | 160,62 | 160,62 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:516 |
| harboro1 | 洛克理奇岩嶺 | SERVICE_HUB | N | Y | 355,207 | 355,207 | N | Y | Y | N | N | U | NONE | npc/re/kafras/kafras.txt:105 |
| lhz_in02 | 里希塔樂鎮內部 | SERVICE_HUB | N | Y | 278,215 | 278,215 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:555 |
| lighthalzen | 企業之都里希塔樂鎮 | ACTUAL_TOWN | Y | Y | 158,94; 194,313 | 158,94 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:531,543 |
| louyang | 古都龍之城 | ACTUAL_TOWN | Y | Y | 217,92 | 217,92 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:570 |
| malaya | 馬來港 | ACTUAL_TOWN | Y | Y | 44,56; 281,212 | 44,56 | N | Y | Y | N | N | U | NONE | npc/re/kafras/kafras.txt:81,87 |
| morocc | 沙漠之都 夢羅克 | ACTUAL_TOWN | N | Y | 156,46; 157,272 | 156,46 | N | Y | Y | N | N | Y | NONE | npc/kafras/kafras.txt:169,184 |
| moscovia | 莫斯科 | ACTUAL_TOWN | N | Y | 221,194 | 221,194 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:429 |
| payon | 山岳之都 斐揚 | ACTUAL_TOWN | Y | Y | 160,58; 257,242 | 160,58 | N | Y | Y | N | N | Y | NONE | npc/kafras/kafras.txt:199,213 |
| prontera | 首都普隆德拉 | ACTUAL_TOWN | Y | Y | 33,208; 116,73; 150,33; 157,327; 281,203 | 116,73 | Y | Y | Y | N | N | Y | NONE | npc/kafras/kafras.txt:244,257,270,285,299 |
| prt_fild05 | 普隆德拉原野 | FIELD_SAVE_HUB | N | Y | 274,243 | 274,243 | N | Y | Y | Y | Y | U | NONE | npc/kafras/kafras.txt:630 |
| umbala | 雨檀族村落 汶巴拉 | ACTUAL_TOWN | Y | Y | 126,131 | 126,131 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:586 |
| yuno | 秀發茲發德共和國首都朱諾 | ACTUAL_TOWN | Y | Y | 158,125; 274,229; 328,101 | 158,125 | N | Y | Y | N | N | U | NONE | npc/kafras/kafras.txt:314,327,340 |

Counts: ACTUAL_TOWN 20; SERVICE_HUB 4; FIELD_SAVE_HUB 2. All 26 Native-authored Kafra locations have a travel node and Saved Point action. Three maps retain their separate farm capability. The Player destination total is 27 because the previously available `izlude` MF_TOWN node uses a conditional rAthena Save script and is outside Native's 39-entry static Kafra catalog.

## Prior 25 unresolved Town flags

The previous projection marked these 25 map-position entries unresolved. Fifteen now resolve from the permanent Kafra source. The remaining ten have no qualifying permanent Kafra Save declaration in the two loaded scripts; this classification does not assert a general travel ban for their MF_TOWN maps.

| RESOLVED_BY_KAFRA_SOURCE (15) | NO_PERMANENT_KAFRA_SAVE_SERVICE (10) |
| --- | --- |
| yuno, gonryun, einbroch, einbech, brasilis, amatsu, lighthalzen, geffen, umbala, louyang, dewata, ayothaya, payon, malaya, alberta | hugel, eclage, rachel, lasagna, mora, veins, dicastes01, malangdo, pay_arche, moc_ruins |

No source-approved exclusion applies to the 26 Kafra locations. Runtime travel, Saved Town, and death respawn await Native deployment and live acceptance.
