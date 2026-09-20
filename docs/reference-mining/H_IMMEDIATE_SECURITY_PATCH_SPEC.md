# H_IMMEDIATE_SECURITY_PATCH_SPEC

## H-01

GAP = `OBSERVE_ONLY` 只對部分 pathname 執行 support mutation gate，未涵蓋的 write handlers 仍可被呼叫。

WHY = `OBSERVE_ONLY` 的安全語意要求零 state mutation。route allowlist 漏項會讓新增或既有 mutation 繞過 mode enforcement。

REQUIRED_INVARIANT = 所有 POST、PUT、PATCH、DELETE request 在 route dispatch 前先執行統一 support gate；`OBSERVE_ONLY` 全部拒絕；例外只允許 holder 自行撤銷 support session。

EXPECTED_TEST = 自動枚舉 mutation routes，以 `OBSERVE_ONLY` session 逐一呼叫，全部回傳 403 且 DB、command queue、PA state、Event Ledger 與 projection 無 write side effect。

## H-02

GAP = `PLAYER_ACTIONS` 可達 ownership command surface，包含 `claim_agent`、`release_agent` 與 `run_server_command`。

WHY = H contract 明確禁止 ownership mutation 與 privilege escalation。coarse mode 允許敏感 action 會跨越支援偵錯邊界。

REQUIRED_INVARIANT = `PLAYER_ACTIONS` 使用固定 gameplay capability allowlist；ownership、admin、credential、identity、support-session minting 與 generic server command 永久拒絕；未知 endpoint/action fail-closed。

EXPECTED_TEST = 以 `PLAYER_ACTIONS` session 驗證允許 gameplay action 可通過，並驗證 `claim_agent`、`release_agent`、`run_server_command`、所有 `/api/admin/` 與 credential/identity mutation 固定 403，沒有 command created、dispatch 或 authoritative state change。
