# Web candidate source closure V5

WORKLINE_ID = M1_WEB_CANDIDATE_COMPLETENESS_AND_FIRST_PROMOTION_V5

The approved 4a0b69797b7b75ddbd5ffe18dbc3913c911327b1 candidate failed the
`web-complete-v1` independent startup dependency census. The 39ed6e5 governance
checkout names three missing startup JSON files and four missing exports.
Neither Production bytes nor an unreviewed generated artifact was used as the
repair source.

| Gap | Classification | Last-good source evidence | Current source at 39ed6e5 | First broken transition and root cause | Minimal repair |
| --- | --- | --- | --- | --- | --- |
| `persistent-agent/quest-content/first-job.json` | CURRENT_REQUIRED_SOURCE | Canonical Web working tree has the JSON as an untracked source file; `quest-runtime/first-job-content.mjs` parses its schema. | `dashboard.mjs` eagerly reads and parses the file; Git candidate omitted it. | V6 source reconstruction `6c6fb444` retained the startup read but did not track the content. | Track the exact local source content after parser and regression verification. |
| `persistent-agent/quest-sequences/eden-course-a.json` | CURRENT_REQUIRED_SOURCE | Canonical Web working tree has the JSON as an untracked source file; the quest journal contract pins `eden_course_a_v1`. | `dashboard.mjs` eagerly reads it and passes its task, sequence and steps to the quest controller. | `6c6fb444` retained the runtime read but omitted the sequence. | Track the existing sequence after JSON and controller-contract verification. |
| `web-experience/action-registry.json` | CURRENT_REQUIRED_SOURCE | Canonical Web working tree has the JSON as an untracked source file; the telemetry implementation consumes `registry.actions`. | `dashboard.mjs` eagerly reads it for Web experience telemetry. | `6c6fb444` retained telemetry initialization but omitted its registry. | Track the existing registry and verify the canary actions it supplies. |
| `relocation-policy.mjs:coordinatorDeadlineMsForRouteSteps` | CURRENT_REQUIRED_SOURCE | Canonical Web working tree has a bounded route-step deadline implementation. | `dashboard.mjs` imports and calls it; reconstructed policy module omitted the export. | `6c6fb444` combined a caller and policy source from different states. | Restore the exact step budget, cap and grace semantics in the policy module. |
| `combat-sse.mjs:gateCombatSseForServerAgent` | CURRENT_REQUIRED_SOURCE | Canonical Web working tree gates SERVER_AGENT characters to native Event Ledger polling. | `dashboard.mjs` imports and calls the gate; reconstructed SSE module omitted it. | `6c6fb444` retained the caller but omitted the native-owned combat gate. | Restore the pure gate without changing combat or Event Ledger authority. |
| `web-latency-trace.mjs:recordWebDiagnosticQuery` | CURRENT_REQUIRED_SOURCE | Committed Web source `b975021e` implements scoped query counting. | `dashboard.mjs` calls it; reconstructed trace module came from a prior state without diagnostic counting. | `6c6fb444` combined the diagnostic caller with an older trace module. | Restore the committed gated counter and response projection. |
| `web-latency-trace.mjs:webHotPathDiagnosticEnabled` | CURRENT_REQUIRED_SOURCE | Committed Web source `b975021e` gates diagnostics on trace opt-in, loopback and token. | `dashboard.mjs` imports it; reconstructed trace module omitted the opt-in export. | Same mixed-revision source reconstruction. | Restore the committed opt-in and authorization behavior. |

UNKNOWN_CLASSIFICATIONS = 0. No route planner, gameplay policy, Native command,
private asset package or Teleport A/B/C/D semantics were changed. The new
`scripts/test-web-candidate-completeness.mjs` exercises all three startup JSON
loads and four exports, including bounded deadlines, native polling and the
authorized/unauthorized diagnostic header boundary. Full Web offline regression,
complete manifest admission and Production acceptance remain separate gates.
