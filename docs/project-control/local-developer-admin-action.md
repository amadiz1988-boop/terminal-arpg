# Local Developer Admin Action

The local developer entrypoint reuses the Dashboard Admin quarantine-recovery
POST and result GET contract. It accepts only `recover_quarantined_to_idle` and
one numeric character ID. The Dashboard still performs authorization, target
and quarantine checks, Native command admission, and authoritative result
reconciliation. The CLI does not access the database or Native transport.

The operator must use the existing `RO_LOCAL_ADMIN_TOKEN` and
`RO_LOCAL_ADMIN_ACTOR_ID` configuration on the canonical Dashboard and have the
token available in the local shell. Keep the token out of command arguments,
logs, reports, and Git. The CLI connects only to `127.0.0.1` on
`RO_DASHBOARD_PORT` (default `8788`). Cloudflare Access remains the Admin Browser
boundary; this entrypoint does not create a Browser session.

Read-only target discovery:

```powershell
node ops/ro-stack/developer-admin-action.mjs recover_quarantined_to_idle --char-id 150070 --preflight
```

`READ_ONLY_PREFLIGHT` proves local Admin transport and roster lookup only.
`admission: NOT_EVALUATED` means it has not checked Native recovery eligibility
and has not queued a command.

Authorized operator action, after independent approval and the required
Production gates:

```powershell
node ops/ro-stack/developer-admin-action.mjs recover_quarantined_to_idle --char-id $ApprovedCharId
```

The CLI sends the same canonical Admin POST and polls its result GET. A JSON
result of `CONFIRMED` requires both Native `CONFIRMED` and authoritative
recovered idle state. `REJECTED`, `FAILED`, `RESULT_UNAVAILABLE`, and `PENDING`
are not success. The response carries a request ID and command ID for audit
correlation. The Admin recovery audit stores source `LOCAL_DEVELOPER_ACTION`,
actor, action, target, request ID, command ID, result, and timestamp. No
automatic retry or recovery of another character occurs.

This source tool must be promoted through the normal GitHub-first Production
process before the operator can run the action against Production. Source tests
and read-only preflight do not authorize or prove a live recovery.
