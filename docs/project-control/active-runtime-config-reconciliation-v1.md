# Active first-promotion runtime config reconciliation V1

Scope: the active lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`, owner `F｜M1 最終整合`, Native SHA `a4c736d865eeedca398aad97aeff1c1036f2dc39`, Web SHA `8cdb13fb88be7199aae15b81e55a9a89a5ec78c5`.

The only approved Production config edits are `PersistentAgentSpThresholdPercent = 20 → 0` and `PersistentAgentSpSafePercent = 40 → 0`. The tool pins the exact old config digest, canonical Git config digest, Native stage receipt, binaries, lease, and runtime identity. Source/Production differences in the two service allowlists and two source-only M1 supply flags are explicitly classified and preserved. Any other source variance or Production config hash blocks the action.

The tool is `ops/ro-stack/reconcile-active-runtime-config.mjs`. Run it from a clean governance checkout whose HEAD is reachable from `terminal-arpg/main`:

```powershell
node ops/ro-stack/reconcile-active-runtime-config.mjs --action dry-run --production-root 'C:\Users\Administrator\ghost-island-production\ro-stack' --owner 'F｜M1 最終整合' --lease '869f1725-dbd0-452d-b9dd-37ee79cc3f9a'
```

The dry run reads the current lease, receipt, config, binaries, and runtime snapshot. It writes no Production file and starts or stops no process. F must review the exact two-key delta, PIDs, ProcDump identity, digests, and rollback availability. Only F may execute the apply step under the same active lease:

```powershell
node ops/ro-stack/reconcile-active-runtime-config.mjs --action apply --execute true --production-root 'C:\Users\Administrator\ghost-island-production\ro-stack' --owner 'F｜M1 最終整合' --lease '869f1725-dbd0-452d-b9dd-37ee79cc3f9a'
```

Apply writes a rollback config copy before the exact patch, then calls the existing Native runtime adapter to stop and start the one Native runtime. The existing SYSTEM runtime sentinel attaches ProcDump to the replacement map PID. Success requires single-runtime health, new Native PIDs, unchanged dashboard and database PIDs, unchanged Native binary hashes, a new generation ProcDump receipt and SYSTEM process identity. The Production launcher is pinned before and after restart. Its config loader and environment assignments, the verified new config digest, and the new map process start time form the startup-value attestation. The receipt records this method explicitly; it does not claim an independent memory read of the map process environment.

Success writes `.local/ro-stack/runtime-config-reconciliation-<lease-id>.json` and references it from the active pending promotion and deployment state. Native stage stays complete. The lease remains active, drift stays OPEN, baseline remains `LEGACY_PRE_GITHUB_FIRST`, and first promotion remains incomplete pending F's live acceptance.

If failure occurs before the stop attempt, the tool restores the exact old config. If a stop or start has been attempted, the tool retains `.local/ro-stack/runtime-config-reconcile.lock/`, the immutable `.local/ro-stack/runtime-config-rollback-<lease-id>.psd1`, the operation record, and the failure record. It does not release the lease or launch another runtime. F uses the recorded current config hash, runtime identity, and rollback digest to plan controlled recovery with Project Control. A second invocation blocks while the failure journal remains. The prior Native promotion receipt is never overwritten.
