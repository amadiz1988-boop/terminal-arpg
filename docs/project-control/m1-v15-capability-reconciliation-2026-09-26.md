# M1 V15 capability reconciliation

Scope: the 38 `M1_REQUIRED` IDs in `docs/openkore-reference/m1-core-hunting-closure.md` plus R12 Shop Sell and R13 Storage promoted by `canonical-m1-world-travel-supply-ui-v1.md`. Total 40. Pinned OpenKore source and exact symbols remain in `docs/openkore-reference/mature-capability-census-v1.md`. This table uses the active M1 core-loop subset, not every optional OpenKore condition.

Evidence keys: `N` = canonical Native `src/map/persistent_agent.cpp` at f7e4097; `P` = Native `src/map/persistent_agent_m1_supply_policy.hpp`; `W` = Web `ops/ro-stack/dashboard.mjs` at 27f9002e; `C` = `ops/ro-stack/dashboard/config-capabilities.mjs`; `B` = f7 Release x64 canonical 13-group offline suite (a passing shared regression, not per-ID live proof). `LG` = the Project Control last-good assertion in the current F dispatch, not a newly executed test. The live acceptance column names the exact proven chain when available. `NOT_PROVEN` does not mean runtime failure. Production Web remains 055d3427; the 27f source candidate is not deployed. A `PASS` here only marks a bounded M1 core-loop capability backed by both source regression and the preserved last-good live chain; it does not confer final promotion acceptance.

| ID | SOURCE | BOUNDED_TEST | LIVE_ACCEPTANCE | PRODUCTION_EFFECT | STATUS / exact remaining acceptance |
|---|---|---|---|---|---|
| H01 Target | N | B; auto-farm-target | LG Supply-to-HIT | target then HIT reported | PARTIAL: target eligibility matrix |
| H02 Retarget | N | B | NOT_PROVEN | no typed give-up result | PARTIAL: bounded reason-specific retarget |
| H03 Same-map path | N | B | LG HIT | movement component unisolated | PARTIAL: no-progress/repath fixture |
| H04 Farm-map switch | W,N | World Map projection PASS; B | NOT_PROVEN on final Web | 055d town/farm source stale | PARTIAL: final Player Browser arrival to AUTO_FARM |
| H05 No-target Fly search | N | fly-rejection; B | LG Fly-to-HIT | trigger reason unisolated | PARTIAL: no-target trigger/rescan proof |
| H12 Fly item | N | post-warp; fly-rejection; B | LG Fly-to-authoritative-HIT | relocation and HIT reported | PARTIAL: same-action unchanged count record |
| H13 Butterfly | N | post-warp; B | LG Supply-return-to-HIT | save-point leg reported | PARTIAL: same-action unchanged count record |
| H15 Farm-map return | N,P | supply-recovery; B | LG Supply-return-to-HIT and Death-maintenance-to-HIT | original farm resumed | PASS |
| H16 Route replan | N | recovery-policy; B | NOT_PROVEN | city-local navigation retained | PARTIAL: bounded missing-edge fallback |
| C01 Attack mode | W,C,N | config-capability and farm-profile PASS; B | LG authoritative HIT | accepted mode 2 executes | PASS |
| C02 Normal attack | N | B | LG authoritative HIT | one legal attack chain reported | PARTIAL: class/range failure matrix |
| C03 Ranged attack | N | ammo-blocked; B | NOT_PROVEN | ranged profile not accepted | PARTIAL: legal bow/gun HIT and ammo case |
| C04 Attack skills | C,N | attack-skill-profile PASS; B | NOT_PROVEN | no per-slot cast effect | PARTIAL: enabled-slot authoritative effect |
| C05 Skill fallback | N | B | NOT_PROVEN | no fallback transition | PARTIAL: legal failed-skill fallback |
| C06 Attack retry | N | B | NOT_PROVEN | reason ceilings untyped | PARTIAL: bounded approach/cast retry |
| C07 Lost target | N | B | NOT_PROVEN | lost reason untyped | PARTIAL: lost-vs-killed rescan |
| C08 LOS/unreachable | N | B | NOT_PROVEN | server legality exists | PARTIAL: wall/LOS terminal fixture |
| C09 Ammo | N | ammo-blocked; B | NOT_PROVEN | insufficient ammo live result absent | PARTIAL: legal shortage/recovery |
| C10 Equipment | N | B | NOT_PROVEN | prerequisite live result absent | PARTIAL: enabled-action equipment gate |
| C13 Conditions | C,N | config-capability; skill-profile PASS; B | NOT_PROVEN per predicate | source subset admitted | PARTIAL: enabled-predicate action effect |
| C19 Target priority | N | auto-farm-target; B | NOT_PROVEN per priority | target scan exists | PARTIAL: aggressive/party priority matrix |
| R01 HP threshold | N | B | NOT_PROVEN | policy difference recorded | PARTIAL: action-specific HP threshold acceptance |
| R02 SP threshold | N | B | NOT_PROVEN | opt-in runtime effect absent | PARTIAL: SP gate live parity |
| R03 Sit/stand | N | B | NOT_PROVEN | recovery gate unisolated | PARTIAL: safe sit, stand and resume |
| R04 Potion/item | C,N | HP-potion-profile PASS; B | NOT_PROVEN | HP/count delta absent | PARTIAL: legal potion effect |
| R05 Recovery skill | C,N | self-recovery-profile PASS; B | NOT_PROVEN | cast effect absent | PARTIAL: enabled-row cast result |
| R07 Loot | N | B | NOT_PROVEN | inventory add absent | PARTIAL: authoritative loot delta and ledger |
| R08 Inventory | N | supply-policy; B | LG Store/Sell | delta reported | PARTIAL: capacity rejection matrix |
| R09 Weight | P,N | supply-policy; B | LG Inventory-maintenance-to-HIT | service trigger reported | PARTIAL: separate sit/loot weight gates |
| R10 Supply trigger | P,N | supply-recovery; supply-policy; B | LG Supply-return-to-HIT | low resource triggers reported | PARTIAL: per-item threshold branch record |
| R11 Shop buy | N,P | supply-recovery; B | LG Supply-return-to-HIT | buy component not isolated | PARTIAL: Zeny/quantity and failure matrix |
| R12 Shop sell | N,P | economy source and B | LG Real Sell; Inventory-maintenance-to-HIT | inventory decrease and Zeny increase reported | PASS |
| R13 Storage | N,P | economy source and B | LG Real Store; Inventory-maintenance-to-HIT | inventory decrease and storage increase reported | PASS |
| R14 Supply return | N,P | supply-recovery; B | LG Supply-return-to-HIT | original farm HIT reported | PARTIAL: KILL and LOOT in same chain |
| R15 Retry/timeout | N | recovery-policy; B | NOT_PROVEN | shared timer exists | PARTIAL: per-action ceiling fixture |
| R16 Stuck | N | recovery-policy; B | NOT_PROVEN | no-progress terminal unproven | PARTIAL: bounded safe terminal |
| R18 Resume | N,P | supply-recovery; B | LG Supply/Death-maintenance-to-HIT | two resume chains reported | PARTIAL: navigation/reconnect resume |
| R19 Quarantine | N | quarantine-idle-recovery; B | current roster count 0 only | no live blocked terminal | PARTIAL: safe terminal and explicit recovery proof |
| R20 State projection | W,N | config/source and B | current Admin read model LIVE | Web final not deployed | PARTIAL: final Player Browser freshness/reconcile |
| R21 Factual events | N,W | B | LG authoritative HIT | full event set not linked | PARTIAL: TARGET/ATTACK/HIT/KILL/LOOT ledger linkage |

Result: `TOTAL=40`, `PASS=4`, `PARTIAL=36`, `MISSING=0`, `UNCLASSIFIED=0`. The four PASS IDs are H15, C01, R12 and R13. Source/test evidence is preserved; the remaining 36 rows each identify one first missing acceptance element. `CAPABILITY_FINAL_GATE=BLOCKED` because the current authorization requires zero currently authorized partial rows before final receipt. This table does not downgrade the separately preserved Store, Sell, Supply, Fly, death and inventory closed-loop results; it keeps their broader per-ID edge cases distinct.
