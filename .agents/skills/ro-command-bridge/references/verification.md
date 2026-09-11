# Verification gate

For each command-backed feature:

1. Record exact syntax, local source line, commit, connection state, and permission level.
2. Test invalid arguments, unavailable items, insufficient points/SP, wrong NPC state, and offline characters where applicable.
3. Test through the dashboard, then verify the result in the OpenKore snapshot and rAthena/MariaDB state.
4. Repeat rapidly to expose duplicate consumption, ordering, and stale-state bugs.
5. Reconnect the browser and confirm persistence and offline automation.
6. Restart the account worker and confirm rAthena stays authoritative.
7. Confirm another account cannot target this character or command queue.
8. For routes, record every map transition and the exact Zeny, ticket, item, or skill consumption. Reject a claimed transport integration when the test silently walked a different route.
9. Prepare dangerous or long-running scenarios with isolated test fixtures. Verify every fixture has a persistent test flag and is absent from player rankings, guild discovery, public population, achievements, and investor statistics.
10. For social features, use at least two live characters. Verify sender echo, recipient delivery, channel identity, Traditional Chinese round-trip, unavailable membership errors, and raw-command rejection.
11. For voice, test actual browser microphone capture at mobile viewport, upload, authenticated same-origin playback, size and duration rejection, and absence of local paths or internal hosts in the media URL.

Do not mark a feature complete when only the command file was created. Release requires server-confirmed state and a visible UI result.
