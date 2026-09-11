# Command routing catalog

Locked sources at research time:

- rAthena commit `e985006171d2eb320ee512a653f4c83aea3d81b6`
- OpenKore commit `51de1ddfc4449ae5217f6886de702f87ca934030`

## Player-facing OpenKore commands

| Product action | Command primitive | Required state |
| --- | --- | --- |
| Add a base stat | `st add <str|agi|vit|int|dex|luk>` or `stat_add <stat>` | Character in game, enough points |
| Add a skill point | `skills add <skill #>` | Skill available and enough points |
| Move or route | `move <x> <y> [map]`, `move <map>` | Character in game, route available |
| Random teleport | `tele` | Teleport ability or configured method available |
| Attack or stop | `a <monster #>`, `as` | Visible valid target |
| Use skills | `sm`, `sl`, `sp`, `ss` | Target type, SP, level, range, cooldown valid |
| Inventory | `i`, `i desc <inventory #>` | Inventory ready |
| Use/equip/unequip | `use`, `eq`, `uneq` | Item exists and supports the action |
| Ground pickup | `take <item #>`, `take first` | Visible ground item |
| NPC flow | `talk`, `talknpc` | NPC visible and response state valid |
| Storage | `storage add|get|close|log` | Storage conversation open |
| Buy and sell | `buy`, `sell`, `store`, `vender` | Corresponding shop open |
| Reports | `s`, `st`, `exp report`, `damage`, `weight`, `where` | Character/session available |
| Automation | `ai`, `conf`, `autobuy`, `autosell`, `autostorage` | Valid configuration and state |
| MapRoute and paid transport | `move <map>` through `Task::CalcMapRoute` and `portals.txt` | Route exists; Zeny or allowed ticket satisfies the NPC warp cost |
| Kafra transportation | NPC warp entries with cost and `allow_ticket`; item 7060 is consumed when available | Kafra destination offered; player owns a ticket or enough Zeny |
| Return and supply | `lockMap`, `storageAuto`, `buyAuto`, `sellAuto`, `useSelf_item` | NPC route, inventory thresholds, currency, storage, and shop state valid |
| Player teleport options | `tele`, Warp Portal, Butterfly Wing, save point, airship/ferry portal entries | Corresponding skill, item, memo, quest, fee, or map permission valid |
| Nearby chat | `sendChat()`; receive `packet_selfChat` and `packet_pubMsg` | Character in game; rAthena area scope |
| Whisper | `Misc::sendMessage(..., 'pm', ..., target)`; receive `packet_sentPM` and `packet_privMsg` | Exact character target; target online and not blocking sender |
| Party chat | `sendPartyChat()`; receive `packet_partyMsg` | Joined party |
| Guild chat | `sendGuildChat()`; receive `packet_guildMsg` | Joined guild |
| Clan chat | `sendClanChat()`; receive `packet_clanMsg` | Joined clan |
| Battleground chat | `sendBattlegroundChat()`; receive `packet_pre/battleground_message` | Joined battleground team |
| rAthena channels | private-message target `#map`, `#global`, `#trade`, `#support`, or `#ally`; receive colored `npc_chat` packet | Channel exists; player can join; alliance required for `#ally` |

Use `Commands::run(...)` inside an OpenKore plugin. Do not reproduce packet rules in the dashboard.

## Native transport selection

1. Ask `Task::CalcMapRoute` for the destination with the character's real budget and inventory.
2. Prefer an original NPC route when it reduces risk or travel time. Confirm the actual NPC dialog and resulting map transition.
3. Show the item, Zeny, skill, quest, or map requirement before the player confirms a world-map destination.
4. Preserve walking as a valid fallback only when the route is safe and the player lacks transport resources.
5. Do not implement arbitrary client-side coordinate or map mutation.

The Renewal novice flow in the locked rAthena source awards 30 units of item 7060. If the product deliberately skips that tutorial, restoring the omitted reward is a migration rule and must be recorded separately from generated test resources.

## Social channel selection

1. Keep `all` as a client-side read filter and `system` as read-only. Neither is a command target.
2. Route nearby, whisper, party, guild, clan, battleground, and rAthena channel text through the matching OpenKore packet sender.
3. Parse channel broadcasts from rAthena packet `0x02C1` through OpenKore `npc_chat`, including the server alias and UTF-8 conversion.
4. Never forward player text to `Commands::run`. Validate channel, target, length, control characters, and rate before creating a typed command.
5. Voice recording is a web extension. Scope the initial audience to characters on the same live map, serve media from a session-protected same-origin URL, and retain the RO text channel as the authority for text.

## rAthena command layers

`doc/atcommands.txt` groups commands into system, database, player information, action, administrative, party, guild, pet, homunculus, channel, and clan sections.

- Read-only commands such as `@rates`, `@time`, `@uptime`, `@mobinfo`, `@iteminfo`, `@whereis`, `@who`, and `@where` are suitable for diagnostics when permissions allow.
- Mutating commands such as `@item`, `@warp`, `@go`, `@heal`, `@jobchange`, `@resetstat`, reload commands, and kick commands require explicit administrative or game-rule authorization.
- `@storage` is an administrative convenience. Player storage gameplay should use the Kafra/NPC flow plus OpenKore `storage` commands.
- `@resetstat` exists. Ordinary-player UI must use a player-safe server path or an NPC/script rule and verify the refund against the locked formula.
- Some atcommands are prohibited from console or script execution because they can crash the map server. Check `atcommand.cpp::atcommand_basecommands` before indirect execution.

## Search shortcuts

```powershell
rg -n "@command" ..\.tmp-rathena-full\doc\atcommands.txt
rg -n "command_name" ..\.tmp-rathena-full\doc\script_commands.txt
rg -n "\['command_name'" ..\.tmp-openkore-full\src\Commands.pm
rg -n "config_key" ..\.tmp-openkore-full\control\config.txt
```
