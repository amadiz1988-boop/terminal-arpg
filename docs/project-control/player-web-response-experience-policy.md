# PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY

VERSION: `PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY_V1.1`

STATUS: CANONICAL

POLICY AUTHORITY:
`AGENTS.md` / `PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY`

PURPOSE:
Permanent governance for Player Web responsiveness, interest-driven
delivery, route/page lifecycle loading, data update principles, and the
separation of Web delivery from PersistentAgent runtime.

This document is an operational / design reference. `AGENTS.md` remains the
highest governance authority. This document does not redefine PA Runtime
Authority, Single Runtime Policy, or any `OPENKORE_*` policy.

Foundation principle:

```text
Only fetch what the player currently needs.
Only update what actually changed.
Prioritize what the player can currently see.
PA runtime continues independently from Web presence.
```

---

## 0. PLAYER_VALUE_FIRST_DATA_PRINCIPLE

`PLAYER_VALUE_FIRST_DATA_PRINCIPLE` is the first principle for this project's
Player Web / data delivery.

Before any Web data acquisition, projection, polling, SSE, stream, cache,
preload, render, re-render, or RUM optimization, answer:

```text
1. Does the player currently really need this data?
2. If needed, how fast does the player need to see it?
3. Has this data actually changed?
4. Can the player currently see / is the player currently using this feature?
```

Only when these conditions support it is it worth paying:

```text
query
fetch
subscribe
poll
transport
serialization
render
re-render
```

```text
Do not deliver data merely because the system has it.
Deliver data when it has current player value.
```

Decision order:

```text
PLAYER NEED
→ REQUIRED RESPONSIVENESS
→ DATA CHANGE
→ CURRENT VISIBILITY / INTEREST
→ MINIMAL AUTHORITATIVE DELIVERY
→ RENDER
```

Short form:

```text
Need?
How fast?
Changed?
Visible?
```

### 0.1 DECISION BEHAVIOR

If:

```text
PLAYER_NEEDS_DATA = NO
```

prefer:

```text
DO NOT LOAD
DEFER
UNSUBSCRIBE
```

If:

```text
VISIBLE = NO
```

prefer:

```text
THROTTLE
EVENT-ONLY
UNSUBSCRIBE
```

If:

```text
DATA_CHANGED = NO
```

```text
DO NOT RESEND FULL PAYLOAD
DO NOT RE-RENDER
```

If the Browser is:

```text
hidden
background
disconnected
```

high-frequency Web delivery MUST stop or be significantly throttled.

But:

```text
PA / SERVER_AGENT Runtime MUST CONTINUE.
```

### 0.2 DATA COST RULE

Every high-frequency Web path MUST check:

```text
DATA_VALUE =
QUERY_COST =
TRANSPORT_COST =
RENDER_COST =
```

Forbidden:

```text
To obtain one small high-frequency datum, e.g. map / x / y,
incidentally query Inventory, Quest, Dialog, Combat history,
Farm Stats, or other unrelated domains.
```

High-frequency data MUST use the smallest authoritative projection that
satisfies the current player need.

### 0.3 NO REFRESH FOR REFRESH'S SAKE

```text
"Forcing a refresh because a timer fired" is forbidden.
```

Polling / refresh MUST have an explicit purpose:

```text
authoritative freshness requirement
active player visibility
missing event-driven alternative
known product responsiveness target
```

If the revision / generation / event cursor has not changed:

```text
prefer not to send the payload.
```

### 0.4 DEVELOPMENT FIRST PRINCIPLE

Apply the same rule to new Web feature development.

Before development, ask:

```text
PLAYER_VALUE =
PLAYER_VISIBLE_BEHAVIOR =
REQUIRED_LATENCY =
AUTHORITATIVE_SOURCE =
MINIMAL_DATA_REQUIRED =
```

Do not build a large data flow first and only later ask whether the player
actually needs it.

### 0.5 DATA DELIVERY EXAMPLES

```text
Login Page:
  player does not need gameplay runtime data
  → do not load Minimap / Combat / Inventory / Farm Stats / Quest runtime

Character Select:
  only character-selection data is needed
  → do not start gameplay subscriptions early

Minimap Active:
  player is looking at it
  → position is high priority
  → cadence close to the authoritative requirement

Minimap Hidden:
  player cannot see it
  → throttle / stop position delivery
  → PA movement continues as normal

Inventory Closed:
  no inventory revision change
  → do not keep sending inventory payload

Combat Page Active:
  combat events have player value
  → real-time / low-latency delivery

Combat Page Inactive:
  event ledger authority is retained
  → no need for continuous high-frequency DOM render

Browser Closed:
  Web delivery = STOP
  PA autonomy = CONTINUE

Browser Return:
  authoritative snapshot
  → revision / event cursor reconcile
  → resume only relevant domains
```

---

## 1. PLAYER-FIRST EXPERIENCE PRINCIPLE

The first objective of Web optimization is NOT:

```text
fewest API calls
fewest DB queries
lowest bandwidth
```

It is:

```text
The feature the player can currently see and is currently operating
MUST receive low-latency, authoritative responses.
```

Optimization order:

```text
Correct
→ Player-needed
→ Visible
→ Responsive
→ Efficient
```

Web optimization does NOT treat any of the following as a standalone success
standard:

```text
lowest request count
lowest DB query count
lowest bandwidth
```

Do not sacrifice real-time information the player is actively viewing in
order to save requests.

Do not perform meaningless high-frequency refresh on domains the player
cannot see merely to "look real-time".

---

## 2. ROUTE LIFECYCLE LOADING

Login Page may load only:

- login UI
- auth API
- login-required CSS / assets

Login Page MUST NOT pre-start:

- Minimap runtime
- Combat data
- Inventory polling
- Farm Stats polling
- Quest runtime
- Ranking polling
- Gameplay projections

Character Select may load only:

- character list
- data required for character presentation
- resources required for character selection

Character Select MUST NOT block on loading a full Gameplay bundle merely
because the player "might enter the game next".

Gameplay:

```text
Only after entering the real gameplay route
may the Gameplay data lifecycle start.
```

---

## 3. LAZY DOMAIN ACTIVATION

Gameplay does not mean loading all domains at once.

Domains activate based on actual use. Example:

```text
Player opens Inventory
→ activate INVENTORY interest

Player opens Farm
→ activate FARM interest

Player opens Quest
→ activate QUEST interest

Player opens Minimap
→ activate POSITION / MAP interest
```

Forbidden:

```text
login
→ load everything
```

---

## 4. WEB INTEREST MODEL

Web data delivery MUST be Interest-driven.

Minimum interest states:

```text
ACTIVE
BACKGROUND
INACTIVE
DISCONNECTED
```

```text
ACTIVE:
  player can currently see / is currently using it
  → normal / high priority

BACKGROUND:
  same page but not the primary panel
  → lower cadence or event-only

INACTIVE:
  not used by the current route
  → unsubscribe or very-low-frequency

DISCONNECTED:
  no valid Browser Web session
  → no high-frequency Web delivery
```

---

## 5. PA RUNTIME MUST NOT DEPEND ON WEB PRESENCE

Browser closed, backgrounded, or disconnected only affects:

```text
PA → Web data delivery
```

It MUST NOT stop:

```text
AUTO_FARM
Combat
Supply
Navigation
Quest runtime
PersistentAgent autonomy
```

Production authority remains:

```text
PA / SERVER_AGENT
→ rAthena
```

Web is an observer / controller, not the life-support of the character
runtime.

---

## 6. PAGE VISIBILITY POLICY

Use Browser lifecycle signals, for example:

```text
visibilitychange
pagehide
```

plus a Web session heartbeat / lease.

Do NOT rely on `unload` alone.

When:

```text
document.visibilityState = hidden
```

high-frequency visual data MUST:

```text
pause
or
significantly throttle
```

Examples:

- Minimap position
- Combat rendering animation
- high-frequency Farm Stats

When the Browser returns to the foreground:

```text
authoritative resync first,
then resume normal cadence.
```

---

## 7. RESUME / RECONNECT POLICY

When the Browser returns:

```text
Do NOT replay every high-frequency position frame from the absence period.
```

Required flow:

```text
fetch authoritative current snapshot
→ obtain current revisions / event cursor
→ reconcile UI
→ resume domain subscriptions
```

Only the necessary event differences are fetched.

---

## 8. DOMAIN-SPECIFIC DELIVERY

A single site-wide polling frequency is forbidden.

Initial Experience Targets:

```text
LIVE POSITION / MINIMAP
  authority ≈ 500ms
  Web target ≈ 500–800ms

HP / SP
  ≈ 500ms–1s

COMBAT EVENTS
  player-visible target ≈ 300–800ms

FARM STATS
  ≈ 1s

INVENTORY / EQUIPMENT
  revision / event driven

QUEST
  revision / event driven

RANKING
  low-frequency / manual refresh

SETTINGS
  no polling
```

These are initial targets. They are adjusted later by RUM measurement.

They MUST NOT be treated as fixed magic constants.

---

## 9. INITIAL SNAPSHOT → REVISION / DELTA

Entering a domain:

```text
take an authoritative snapshot first
```

After that, prefer:

```text
revision
generation
eventId
sessionId
cursor
```

to determine whether data changed. Examples:

```text
liveRevision
inventoryGeneration
combatEventId
farmSessionRevision
questRevision
```

If the revision has not changed:

```text
MUST NOT resend the full payload
MUST NOT perform unnecessary DOM render
```

---

## 10. DOMAIN PROJECTION POLICY

High-frequency data MUST use small, explicit projections.

Example:

```text
Minimap MUST NOT read Inventory, Dialog, Quest, Combat history, or Farm
Stats just to obtain x / y.
```

Ideal:

```text
PA live status
→ Position Projection
→ Browser

Farm:
Farm Session + Event Ledger
→ Farm Stats Projection

Inventory:
Inventory Projection
→ Browser
```

Forbidden:

```text
giant Everything Snapshot
```

that causes:

```text
one slow domain
→ every page becomes slow
```

---

## 11. SINGLE INTEREST / DELIVERY COORDINATION

Each UI module MUST NOT create an unbounded polling loop of its own.

Design toward:

```text
ONE Web Interest / Delivery Coordinator
```

centrally managing:

- active route
- active tab / panel
- Browser visibility
- subscribed domains
- cadence
- last revision
- in-flight request
- cancellation
- reconnect / resync

Forbidden:

```text
Minimap poll
Combat poll
Inventory poll
Quest poll
Farm poll
```

each unaware that the others exist.

---

## 12. STALE REQUEST / CANCELLATION

When:

```text
route changed
tab changed
Browser hidden
a newer request supersedes an older request
```

the older request SHOULD be cancellable or ignorable.

A stale response MUST NOT overwrite newer authoritative state.

---

## 13. RESOURCE LOADING

Critical route resources first.

Non-critical bundles / assets:

```text
lazy load
or
preload only after critical render completes,
when idle / network budget is reasonable.
```

Preload MUST NOT block the current screen, MUST be cancellable, and MUST
not cause login / character-select latency regression.

---

## 14. PLAYER ACTION RESPONSE

For player-initiated actions, for example:

```text
use item
equip
unequip
stat allocate
NPC action
farm start / stop
```

the frontend SHOULD immediately provide:

```text
pending / pressed / processing feedback
```

But the final success state MUST wait for authoritative confirmation.

Optimistic state MUST NOT permanently overwrite Server truth.

Flow:

```text
click
→ immediate visual acknowledgment
→ request
→ authoritative mutation
→ read model revision
→ visible confirmation
```

---

## 15. EXPERIENCE OBSERVABILITY

Use the existing Web Experience / RUM.

At minimum observe:

- route initial render
- player action perceived latency
- position delivery cadence
- data freshness
- requests/minute by route
- bytes/minute by domain
- hidden-page request rate
- duplicate / no-change payload rate
- P50 / P95 / P99
- Network
- Server
- Read Model
- Frontend Render

Optimization MUST be measurement-driven.

---

## 16. NO BACKGROUND WASTE RULE

If:

```text
the player is not on that page
Browser hidden
domain inactive
Web session expired
```

then high-frequency data delivery at ACTIVE-state levels MUST NOT be
maintained.

Exceptions require an explicit product reason.

---

## 17. DO NOT CONFUSE WEB DELIVERY WITH PA EXECUTION

Stated again explicitly:

```text
Stop Web delivery
!=
Stop PersistentAgent
```

PA autonomous runtime MUST continue.

When the player reopens Web, the latest authoritative result is shown.

---

## 18. ACCEPTANCE PRINCIPLE

All Web response optimization MUST finally be accepted with a real Browser.

It is NOT sufficient to declare Player Experience PASS because:

```text
DB is fast
API returns 200
backend projection works
```

At minimum distinguish:

```text
SOURCE_PASS
BACKEND_PASS
BROWSER_UI_PASS
PLAYER_PERCEIVED_PASS
```

---

## 19. SHORT FORM RULE

Referenceable short form for future dispatch:

```text
PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY:

PLAYER_VALUE_FIRST_DATA_PRINCIPLE:
Need? How fast? Changed? Visible?
Do not deliver data merely because the system has it.

Load only what the current route needs.
Subscribe only to currently relevant domains.
Prioritize visible data.
Throttle or stop hidden/inactive delivery.
Stop high-frequency Web delivery when no Browser session exists.
Keep PA runtime independent.
Initial authoritative snapshot first.
Then use revision/delta/event cursor.
No unchanged full-payload refresh.
No Everything Snapshot.
Measure real player latency before optimizing.
```

---

## 20. COMPATIBILITY

This policy MUST remain compatible with:

```text
PC-DISPATCH-STANDARD
WORKLINE_DISPATCH_TEMPLATE_V1
WORKLINE_CONTINUATION_TEMPLATE_V1
OPENKORE_REFERENCE_POLICY
OPENKORE_REFERENCE_GATE_V1.1
Single Runtime Policy
Browser Acceptance Policy
```

It MUST NOT redefine PA Runtime Authority.

Where this document overlaps existing rules, the existing rule is preserved
and this document only references and reinforces it.

---

## 21. SCOPE BOUNDARY

This policy is governance only.

It does not itself modify:

```text
Web source
Native source
Production
Runtime config
```

It defines the rules those changes must satisfy.

---

## VERSION HISTORY

```text
V1
= lifecycle / interest / domain delivery policy

V1.1
= PLAYER_VALUE_FIRST_DATA_PRINCIPLE
  Need / How fast / Changed / Visible
  as mandatory first-principle decision gate
```

## VERSIONING

Version:

```text
PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY_V1.1
```

Future substantive semantic change MUST use `V1.2` / `V2`.

Silent change is forbidden.

`AGENTS.md` reference MUST be updated in the same change as any version
advance.

`AGENTS.md` is always the policy authority.
