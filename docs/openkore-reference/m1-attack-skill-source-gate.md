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
| CURRENT_GI_BEHAVIOR | Character-configured numeric attack rows enter `start_farm`; Native scans the supported row predicates in order and reuses its rAthena attack-skill loop. `SKILL_CAST` excludes weapon fallback and drops an unattackable target after a bounded wait. The Player skills editor remains disabled while runtime and Browser acceptance are open. |
| FIRST_BROKEN_TRANSITION | A selected row rejected by `skill_check_condition_castbegin` does not advance to a later row in that tick. Broader configured self/monster predicates remain unsupported and fail typed before command creation. |
| RATHENA_AUTHORITY | Native `pc_checkskill`, `skill_get_requirement`, `skill_check_condition_castbegin`, `battle_check_range`, `unit_skilluse_id` and authoritative monster HP remain the legality and combat authority. |
| PORT_MAPPING | Carry a bounded ordered subset of numeric skill rows through the existing command. Select the first row whose supported HP/SP/timeout, learned-skill and authoritative SP-cost predicates match, then reuse the current Native attack-skill legality/cast/fallback path. Do not add a second scheduler or infer skill legality in Web. |

M1 source subset admits numeric skill ID, desired level, optional HP/SP `< N%`
or `> N%`, and row timeout. Other configured predicates and target selectors
remain `PARTIAL`, with the Player array disabled. `maxAttempts/maxUses` remain
zero in this slice; the existing bounded Native no-method retarget stays in
force. `SKILL_CAST` continues to prohibit normal attack.

The ordered Native selector now skips a row when its requested level is
unlearned, its rAthena SP cost is unpayable, or its skill-specific cooldown is
active, and evaluates the next configured row. When no row matches, the
existing profile decides weapon fallback; `SKILL_CAST` waits and drops the
target after its bounded no-method interval without issuing normal attack.
The command-contract checks cover slot-one unavailability, slot-one
insufficient SP, no matching slot, and the weapon-disabled profile. Recovery
policy and Supply regressions pass after the selector change.

`skill_check_condition_castbegin` is invoked only after selection in the
current Native attack loop. rAthena's cast-begin implementation can change
actor or inventory state, so speculative calls for every row are unsafe. A
row rejected by this final cast condition still prevents a later row from
being tried in the same tick. This is a remaining `SKILL_AVAILABILITY` and
`SKILL_FAILURE_FALLBACK` source gap, not a complete OpenKore parity claim.
Authoritative cast, HIT and Player acceptance also remain unmeasured.
