---
name: ro-command-bridge
description: Research and reuse locked rAthena atcommands, script commands, and OpenKore console commands when implementing Ghost Island RO gameplay, automation, admin, NPC, inventory, movement, combat, or character controls. Use for command-backed features and command-bridge changes, not for unrelated frontend styling.
---

# RO Command Bridge

Use the locked local sources as executable truth. Before designing any new gameplay path, inventory control, NPC service, social feature, or automation setting, inventory the existing rAthena and OpenKore system first:

- rAthena: `../.tmp-rathena-full/doc/atcommands.txt`, `doc/script_commands.txt`, and matching source implementations.
- OpenKore: `../.tmp-openkore-full/src/Commands.pm`, `control/config.txt`, and matching plugins or packet senders.

Resolve these paths from the project parent when the repositories are sibling folders. Record the exact local commit before relying on syntax.

## Renewal version gate

Before implementing any RO system, search the locked rAthena tree for every coexisting implementation of that system and identify which files are enabled by the active Renewal configuration. Treat `npc/re`, Renewal database files, active `scripts_*.conf`, server start settings, and their source implementations as the current product baseline. Treat `npc/pre-re`, disabled scripts, replaced tutorials, and historical comments as reference material only.

Create a short source decision record before product code changes. It must state the active implementation, superseded implementation, enabling configuration, player entry point, and exact evidence paths. When the locked source contains a newer enabled system, use it before designing custom logic or restoring an older route.

If two enabled variants remain valid and choosing one changes progression, economy, map flow, rewards, or player expectations, stop before implementation and ask the user to select the product rule. Do not spend implementation time on either branch until the choice is recorded.

The first-job incident is the permanent regression case: `npc/re/jobs/novice/academy.txt` and `conf/char_athena.conf` define the current Criatura Academy start, while `npc/re/jobs/novice/novice.txt` explicitly states that the `new_1-1` tutorial was replaced in 2012. A first-job implementation fails this gate if it begins from the old training ground or sends players through the six legacy guild routes without an explicit user decision.

## Decision order

1. Pass the Renewal version gate and record the active source decision.
2. Classify the requested subsystem and list its native rAthena NPC/script/database primitives plus OpenKore commands, configuration keys, tasks, plugins, and packet senders.
3. Build a reuse matrix containing the native primitive, player precondition, item or Zeny cost, authority source, UI action, and observable confirmation.
4. Search the authoritative local source for exact syntax and preconditions. Inspect related systems, not only the first command match.
5. Prefer an OpenKore player command or task for normal player actions. It follows the server packet and permission model.
6. Prefer rAthena script commands and original NPC flows for game-authored services and quests.
7. Reserve rAthena `@` and `#` commands for authorized administration, isolated tests, migration, or an explicit product rule.
8. Write custom logic only when the locked sources have no suitable primitive. Record the missing primitive and preserve server authority.

## Built-in system audit

For navigation and world-map work, inspect `Task::CalcMapRoute`, `portals.txt`, `route_maxWarpFee`, `routeweights.txt`, Kafra NPC transportation, Free Ticket for Kafra Transportation item 7060, player Warp Portal, Butterfly Wing, save points, airships, ferries, and map-specific services before adding a custom route. A world-map teleport button may expose only destinations that the server and OpenKore can currently reach with the player's real items, Zeny, skills, quest state, and map restrictions.

Treat the map server's loaded `map_cache.dat` as the collision authority. Resolve cache precedence from `db/import`, `db/re`, then `db`; generate both OpenKore FLD2 and browser minimap data from that same cache, and invalidate matching `.dist` and `.weight` caches after a field change. A client GAT or historical OpenKore field may be used only after its walkability cells match the active server cache.

For supply work, inspect `autosell`, `autobuy`, `autostorage`, `storageAuto`, `buyAuto`, `sellAuto`, `useSelf_item`, death handling, lockMap return, and the original Kafra/shop NPC flows before building new automation.

For social work, inspect rAthena party, guild, clan, battleground, map/public/custom channel, friend, chat-room, whisper, block, and report primitives plus OpenKore receive/send support before creating a parallel database-only system. Keep server/system messages read-only. Treat browser voice messages as a labeled product extension because the locked RO protocol has no native voice-message primitive.

For ranking work, distinguish rAthena's native Blacksmith, Alchemist, and Taekwon fame lists from this product's requested all-class Base/Job ranking. Reuse rAthena character, guild, equipment, appearance, and fame data. Build only the read-only all-class projection that the native fame list does not provide, and always exclude test accounts at the query boundary.

For marketplace work, inspect rAthena Auction, Vending, Buying Store, Offline Vending, Mail/RODEX, item trade restrictions, transaction logs, Zeny limits, and OpenKore shop/buyer/mail packet support before creating a marketplace table or balance ledger. Prefer the active server transaction primitive. If client-version compatibility makes the legacy Auction flow unavailable, record that evidence and ask the user before selecting Vending plus RODEX or a custom consignment facade.

For localized player text, use the active server/client locale table before a handwritten label. For twRO item names, load `tables/twRO/items.txt` by item ID; use `iteminfo_new.lub` to cross-check names, descriptions, and client resource names. Add a player-UI regression that fails when an onboarding reward falls back to an Aegis identifier, `道具 #ID`, or an unexpected English label.

For task telemetry, use OpenKore `%questList` mission `mob_goal` and `mob_count`, `npc_talk` hooks, `Task::Route` status hooks, character `exp`/`exp_max` and `exp_job`/`exp_job_max`. Compose a readable task-action log only from these sources and the verified automation phase. Exclude per-hit combat lines. Show destination, NPC, dialog, battle requirement, current progress, stuck recovery, EXP percentage, and remaining EXP.

When a native system is discovered after a custom path was started, stop extending that path, switch to the native primitive, add an end-to-end regression, and update this skill's catalog.

## Bridge rules

- Allowlist every web-callable action and validate typed arguments before creating a command file.
- Keep the browser unable to submit raw OpenKore commands, raw packets, SQL, `@commands`, or `#commands`.
- Execute player commands inside the account's own OpenKore process.
- Let rAthena validate points, items, ranges, cooldowns, permissions, map state, and NPC state.
- Return accepted, rejected, and server-confirmed states separately. Refresh authoritative snapshots after mutation.
- Serialize commands per account. Use idempotency keys for actions that can consume items or currency.
- Do not grant GM group levels to ordinary players to make a UI feature work.
- Keep automated test resources server-side. Mark fixture accounts as test accounts and exclude them from leaderboards, guild discovery, public population, achievements, and investor-facing statistics.
- Test fixtures may receive levels, stats, HP, Zeny, items, or quest state needed to isolate a feature. Player characters must satisfy progression and resource requirements through gameplay, except for original rewards omitted by a deliberately skipped official flow.
- For progression-flow tests, first complete enough real combat to prove monster selection, damage, reward packets, Base/Job EXP increase, EXP requirements, recovery, and no-death continuity. After that evidence is captured, a server-side admin command may advance an isolated test account to the next required level. Log the acceleration, restrict it to a test-only account and local command path, and keep the account excluded from every public ranking or statistic. Do not spend test time repeating already-proven EXP accumulation.
- When a tutorial quest grants equipment, its rAthena NPC script may equip that reward immediately. Limit this behavior to the tutorial reward script; regular loot and later quest rewards remain player-controlled.
- Keep voice media on an authenticated same-origin route. Enforce MIME, duration, byte-size, rate, and audience checks, and never expose a filesystem path, internal host, or backend address in media URLs.

Read [references/command-catalog.md](references/command-catalog.md) when choosing a command or expanding the bridge. Read [references/verification.md](references/verification.md) before releasing a command-backed feature.
