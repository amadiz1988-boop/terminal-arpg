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
complete Web manifest pins the deployed launcher as a Production preimage.
The Production runtime config is governed separately by the same-lease
reconciliation receipt, sealed in both pending and state records. Only in
that staged case, the Native candidate inspector checks the launcher against
the admitted Web preimage, the config against its sealed receipt and original
Native pin, and all remaining lifecycle files against their original pins.
A missing receipt, path or matching hash fails closed.

The source regression `node ops/ro-stack/tests/test-native-promotion.mjs`
passed 45 cases, including original-pin rejection, staged-Web preimage,
and sealed runtime-config positive and wrong-hash checks. No Native source, Native binary, runtime
contract, or player state was changed by this governance patch.
