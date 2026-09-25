# M1 V15 staged Web lifecycle pin reconciliation

On 2026-09-25, the same-lease Web amendment for candidate
`6c2884fb531b4e448cab9e0b513365c677f2318d` passed its own admission.
The controlled Web deploy precheck then stopped without mutation at
`PINNED_CONTENT_CHANGED`. The two mismatches were Production
`ops/ro-stack/ro-stack.ps1` and `ops/ro-stack/stack.config.psd1`: the
original Native candidate manifest pinned their pre-Web-stage bytes while
an earlier approved Web candidate had changed them.

The Native first-admission path retains those original pins. In an already
verified Native/Web stage, `verifyNativeStage` checks the same lease, Native
receipt, current or prior Web receipt, live bytes, and rollback. The subsequent
complete Web manifest also pins every deployed lifecycle file as a Production
preimage. Only in that staged case, the Native candidate inspector now checks
the lifecycle files against those admitted Web preimage hashes. A missing
lifecycle path or mismatched preimage fails closed.

The source regression `node ops/ro-stack/tests/test-native-promotion.mjs`
passed 44 cases, including original-pin rejection and staged-Web positive,
missing-path, and wrong-hash checks. No Native source, Native binary, runtime
contract, or player state was changed by this governance patch.
