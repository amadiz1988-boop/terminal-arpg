# M1 legacy launcher source reconciliation

Scope: first GitHub-first promotion, `ops/ro-stack/ro-stack.ps1` only. Production is a one-time reconstruction input and preimage, not continuing source authority.

| Evidence | Value |
| --- | --- |
| Production preimage | SHA-256 `58DDC2E101F64B47B586CE9C74E9C75D2E3221EEFEC439DA7621DF31262F3CAF`, 60,788 bytes, 860 lines |
| Isolated candidate ancestor | `f90287a35c454dcae38f7d91b14d8658856c9093`, launcher SHA-256 `ADF6D62845260364B58E13C251F2D694A878491D24AFE71A100F6F837680156A`, 489 lines |
| Bounded Git lineage | `6c6fb444` current candidate path history; `b1498f21` M1 preflight/projection; `2ed9ac9f` graceful stop; `044e38d7` earlier 643-line Production ops baseline |
| Secret review | Secret-named assignments are runtime expressions or `New-RandomSecret`; no embedded password, token, key or private-key literal matched the bounded scan. Runtime `secrets.json` is excluded. |
| Preservation proof | `test-m1-supply-launcher-projection.ps1` removes exactly six added source lines and requires normalized SHA-256 `EE6B81E2C0AF6586D890A0296C822152B82256FC342C7198DAE433BFBFA85314`, the captured Production preimage after CRLF normalization. |

## Production-only block classification

| Block | Classification | Decision |
| --- | --- | --- |
| `Get-CanonicalPortHolder`, `Stop-CanonicalPortHolders` and stateless stop | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve exact behavior and identity checks |
| `Get-StackReadiness`, lifecycle lock, stopped-port wait, restart | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve exact behavior and bounded lifecycle |
| `Get-Probe`, guard, inventory actions | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve launcher entrypoints and existing guard implementation |
| Setup patch/NPC/SQL extension and rollout allowlist | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve exact Production behavior; retain candidate M1 preflight migration |
| Server command, character, navigation, NPC, quest, service, Supply, route, live-status environment projections | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve exact explicit mappings and restoration |
| Login, char, map start parameters, PID state and readiness checks | LEGITIMATE_PRODUCTION_EVOLUTION | Preserve exact startup and single-runtime checks |
| Dashboard lifecycle | ALREADY_CANONICAL_ELSEWHERE | Remains in `dashboard-service.ps1`, not copied into Native launcher |

`UNKNOWN_PRODUCTION_CAPABILITY_COUNT = 0`. No Production line is removed by the reconstructed launcher. The additional M1 mapping is explicit: `PersistentAgentM1SupplyEnabled` to `PERSISTENT_AGENT_M1_SUPPLY_ENABLED`; absent/false projects `0`, true projects `1`, and a non-Boolean value fails before map start. The rAthena consumer remains `src/map/persistent_agent.cpp` and only accepts `1`. No generic configuration export is added.

## Capability preservation matrix

| Capability | Production present | Reconstructed source present | Test |
| --- | --- | --- | --- |
| Login lifecycle | yes | yes | Exact preimage-subsequence hash, single-runtime guard |
| Char lifecycle | yes | yes | Exact preimage-subsequence hash, single-runtime guard |
| Map lifecycle and startup arguments | yes | yes | Exact preimage-subsequence hash, Native adapter fixture |
| Dashboard lifecycle | separate launcher | separate launcher | Existing Dashboard launcher source unchanged |
| Graceful stop and restart | yes | yes | Exact preimage-subsequence hash, graceful console signal |
| Shutdown race lock and stopped-port wait | yes | yes | Exact preimage-subsequence hash |
| PID, service/listener and ProcDump integration | yes | yes | Exact preimage-subsequence hash, Native adapter fixture |
| SP thresholds and PA mappings | yes | yes | PA config projection test |
| Supply/service and M1 mapping | Supply/service yes, M1 no | yes | PA projection and M1 projection tests |
| DB/config propagation and Setup | yes | yes | Exact preimage-subsequence hash |
| Single-runtime guard | yes | yes | Guard test and exact preimage-subsequence hash |
| Unknown config key isolation | yes | yes | Exact preimage-subsequence hash, no generic export |

## Manifest adoption and rollback

Only `ops/ro-stack/ro-stack.ps1` may move from unmanaged existing Production path to manifest-managed path under reason `M1_LEGACY_LAUNCHER_GITHUB_FIRST_RECONCILIATION_V1`. Its required preimage is the exact SHA above. The deployer backs up existing files before replacement and rollback restores the verified preimage. A missing/wrong preimage, another unmanaged path, removal, unrelated addition or lease mismatch fails before mutation. After promotion, GitHub canonical source and the sealed complete manifest are the launcher authority.

OpenKore Supply behavior is unchanged: `AUTO_FARM` pauses on `SUPPLY_LOW`, returns to SavePoint for authoritative service, then resumes the farm target. This work changes only the approved startup gate; item, map, inventory, buy and combat outcomes remain rAthena authority. Reference: `docs/openkore-reference/supply.md`, pinned OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030`.
