# Developer Diagnostics & Maintenance Console V1

Canonical local entrypoint: `node ops/ro-stack/ghost-island-dev.mjs`. Run it from
the canonical Web source checkout. `help` and `capabilities [domain]` read the
registry without contacting Production. Add `--json` for a single machine-readable
result. The capability census is
`docs/project-control/developer-console-capability-matrix.json`; prioritized gaps
are in `docs/project-control/developer-tooling-gap-register.json`. The registry in
`ops/ro-stack/dev-console/registry.mjs` is routing metadata, not world authority.
Matrix `CURRENT_STATUS` describes the source capability after this V1 console
integration; `ALREADY_UNIFIED` means the listed command now exists in source.

## Commands and authority

| Command | Source | Mode |
| --- | --- | --- |
| `runtime health`, `runtime processes`, `runtime identity` | Canonical runtime state, listeners, Dashboard loopback health, Windows live executable identity | Read only |
| `runtime logs map --char 150070` | Bounded tracked runtime log tail | Read only |
| `deployment state`, `deployment receipt` | Production state, lease and accepted receipt | Read only |
| `player inspect 150070`, `player fleet`, `player quarantine` | Authenticated Dashboard Admin roster | Read only |
| `player commands 150070`, `events recent 150070` | Fixed, bounded read-only ledger queries | Read only |
| `incident latest`, `incident procdump` | Runtime incident and sentinel files | Read only |
| `config diff` | Source and deployed config files | Read only |
| `action recover-quarantined 150070 --preflight` | Existing developer Admin action | Read only roster preflight |
| `action recover-quarantined 150070 --execute` | Existing developer Admin action → Dashboard → Native | State changing |

`RO_LOCAL_ADMIN_TOKEN` must already be available to the local shell for roster
and recovery commands. It is never a command argument. The CLI talks only to
`127.0.0.1:8788` and does not use Browser cookies or Cloudflare identity.
Event and command queries use the existing local MariaDB client and the canonical
runtime secret file; their SQL and row limits are fixed in the provider. The
console accepts no SQL, shell text, remote host, alternate Production root,
or generic action. Each command runs once. Log reads are bounded to the end
of tracked files.

`--preflight` checks transport and presence in the 200-row Admin roster. It
does **not** evaluate Native recovery eligibility. `--execute` passes the target
to the existing `developer-admin-action.mjs` and inherits its authentication,
admission, audit, request/command IDs, polling, and authoritative confirmation.
Operators must satisfy the normal Production gate and approval before invoking
it. This workline has not exercised the mutating command against Production.

All results report `STATUS`, `AUTHORITY`, `TIMESTAMP`, `TARGET`, `SOURCE`,
`FRESHNESS`, and `RESULT`. An action also reports `REQUEST_ID`, `PRECHECK`,
`ACTION`, `CONFIRMATION`, and `AUDIT_REF`. A successful file read means the
file was read; it does not prove a deployed SHA, healthy runtime, effective
in-process config, or Browser behavior. `deployment state` presents the active
lease's candidate SHA separately from the accepted baseline. `config diff`
sets `effectiveRuntime: UNRESOLVED` pending independent attestation. The Admin
roster is capped at 200; `fleet` and `quarantine` report `STALE` when that cap
is reached. `NOT_FOUND`, `STALE`, `NOT_AUTHORIZED`, `NOT_ELIGIBLE`,
`AUTHORITY_UNAVAILABLE`, `RUNTIME_UNHEALTHY`, `ACTION_REJECTED`,
`TOOLING_MISSING`, and `UNKNOWN` remain distinct.

## Worker use

| Workline | First diagnostic commands |
| --- | --- |
| A Web and Dashboard | `runtime health`; `player inspect <id>`; then Browser for UI acceptance |
| D Native and PA | `runtime processes`; `player inspect <id>`; `player commands <id>`; `events recent <id>`; `incident procdump` |
| F M1 integration | `deployment state`; `deployment receipt`; `config diff`; `runtime health` |
| OPS recovery | `player quarantine`; `player inspect <id>`; recovery preflight; authorized canonical action |
| GOV | `deployment state`; `deployment receipt`; `config diff` |
| I combat | `player inspect <id>`; `events recent <id>`; `runtime logs map --char <id>` |
| M2 Quest | `capabilities quest`; `events recent <id>`; use lower-level quest evidence while the registry gap remains |

When a needed capability is missing, report `DEVELOPER_CONSOLE_GAP` with its
registry ID and use the existing authority in the same owner scope. Add a
provider only after identifying its authoritative source, bounded read or
existing canonical action, output schema, and audit path. Add its metadata to
the registry and regenerate the matrix with
`node scripts/build-developer-console-census.mjs`. No provider should duplicate
gameplay or deployment business rules. Future Life and Social domains stay
`NOT_IMPLEMENTED_PRODUCT` until their separate authorization.

Browser observation remains required for Player/Admin UI acceptance. A CLI
result, HTTP status, API read model, or synthetic fixture cannot prove a
button, layout, rendered state, or mobile viewport. Developer diagnostics can
support the backend half of that acceptance only.
