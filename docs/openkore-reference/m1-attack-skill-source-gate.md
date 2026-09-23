# M1 ordered attack-skill source gate

```text
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
CAPABILITY = C04/C05/C13 ordered attackSkillSlot selection
SOURCE_SCOPE = Existing start_farm → PA local attack → rAthena skill authority
PRODUCTION_DEPLOYMENT = NO
```

| Evidence | Exact result |
|---|---|
| OPENKORE_FILE | `control/config.txt:605-632`; `src/AI/Attack.pm:725-775,1057-1083`; `src/Misc.pm:5487-5545,5660-5675,5718-5723`; `src/Utils.pm:1454-1502` |
| OPENKORE_SYMBOL | `AI::Attack::main`, `checkSelfCondition`, `ai_skillUse2`, `inRange` |
| OPENKORE_CONFIG | Repeated numbered `attackSkillSlot_i`; default empty skill, `dist/maxDist=1`, `maxAttempts/maxUses=0`, optional self/monster conditions and per-row timeout. `attackUseWeapon` controls ordinary attack fallback. |
| OPENKORE_DEFAULT | No active attack-skill slot. Weapon attack remains separately controlled. |
| OPENKORE_BEHAVIOR | After any combo, default to weapon when enabled; numbered attack skill slots are scanned in order and the first whose self/target conditions and limits match overrides that method. `checkSelfCondition` skips an unlearned skill or a row whose configured-level SP cost exceeds current SP. The selected row supplies skill level/range/cast parameters. An attempted skill stamps per-row and per-target time and increments attempts before `ai_skillUse2`. |
| OPENKORE_TRANSITION | Target → first matching slot → route/range → skill request → retry/condition reevaluation, or weapon/no-method fallback when no matching slot. |
| CURRENT_GI_BEHAVIOR | `dashboard.mjs` accepts one `skillId` from the player action. `config-schema.mjs` persists `combat.skills.attackSlots` but the rows do not enter `start_farm`. Native `persistent_agent.cpp:8485+` has one skill with rAthena learned/SP/cooldown/action delay/range/cast-condition checks; `SKILL_CAST` excludes weapon fallback and drops an unattackable target after a bounded wait. |
| FIRST_BROKEN_TRANSITION | Stored attackSkillSlot rows → authenticated `start_farm` command; only one browser-supplied `skillId` reaches Native. |
| RATHENA_AUTHORITY | Native `pc_checkskill`, `skill_get_requirement`, `skill_check_condition_castbegin`, `battle_check_range`, `unit_skilluse_id` and authoritative monster HP remain the legality and combat authority. |
| PORT_MAPPING | Carry a bounded ordered subset of numeric skill rows through the existing command. Select the first row whose supported HP/SP/timeout, learned-skill and authoritative SP-cost predicates match, then reuse the current Native attack-skill legality/cast/fallback path. Do not add a second scheduler or infer skill legality in Web. |

M1 source subset admits numeric skill ID, desired level, optional HP/SP `< N%`
or `> N%`, and row timeout. Other configured predicates and target selectors
remain `PARTIAL`, with the Player array disabled. `maxAttempts/maxUses` remain
zero in this slice; the existing bounded Native no-method retarget stays in
force. `SKILL_CAST` continues to prohibit normal attack. The subset is not a
claim of complete OpenKore parity or Player acceptance.
