---
name: navigation-stall-safety
description: Implement or debug quest, NPC, supply, return, or AFK-map navigation without repeated no-progress movement loops. Use whenever repository work changes automated movement, teleportation, route recovery, or task state transitions.
---

# Navigation stall safety

Before changing automated movement, identify the authoritative map flag, portal, NPC, item restriction, and live task state. A route present in a table is insufficient evidence that the character can execute it from the current cell and task state.

Every navigation step must satisfy these invariants:

1. Define observable progress as at least one of: map change, position change, expected NPC dialog state, or task-phase advancement.
2. Do not reissue the same movement or interaction while its prior action is active.
3. Wait a bounded interval for observable progress before retrying. A retry must not refresh the timer used to detect its own failure.
4. Bound identical retries and total elapsed time. After the limit, choose a verified different transport or end the task safely and restore normal automation.
5. Rank transport using current server evidence: valid in-map native service, valid portal, usable teleport item on a map that permits it, then walking.
6. Check map restrictions such as `noteleport` before choosing Fly Wing, Butterfly Wing, Teleport, or similar items.
7. Close or recover stale NPC dialogs before starting another movement action.
8. Emit a task event for the selected route, each fallback, and the terminal failure so the Dashboard exposes forward progress.

For recurrence prevention, add a regression test that proves rapid identical retries are absent, no-progress retries are bounded, the fallback is executable under the verified map rules, and failure restores general automation. Use the closest legal runtime state for live verification and avoid restarting unrelated services.
