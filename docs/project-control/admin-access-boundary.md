# Admin Access Boundary

Status: `ADMIN_ACCESS_BOUNDARY_FROZEN = YES`。本文件記錄 Project Control 已接受的 Admin Browser 安全邊界；`AGENTS.md` 為 policy authority。

## Authority

```text
ADMIN_BROWSER_AUTHORITY = CLOUDFLARE_ACCESS_EDGE
APP_LEVEL_ADMIN_BROWSER_IDENTITY_SYSTEM = NOT_REQUIRED
DASHBOARD_REAUTHENTICATION_REQUIRED = NO
CLOUDFLARE_IDENTITY_HEADER_MAPPING_REQUIRED = NO
CLOUDFLARE_JWT_VALIDATION_IN_DASHBOARD_REQUIRED = NO
ADMIN_EMAIL_MAPPING_IN_APPLICATION = NOT_REQUIRED
DO_NOT_REOPEN_ADMIN_BROWSER_IDENTITY_ANALYSIS = YES
```

Admin host 經 Cloudflare Access 的 `ALLOWLISTED_OWNER_IDENTITY` policy 後進入 Dashboard Admin。允許名單由 Cloudflare Access 管理；Git 不記錄實際 Gmail 地址。應用程式不建立第二套 Admin Browser 登入或身分階層。

此決策保留資料隔離：`PUBLIC_PLAYER_HOST`、普通 Player 與 Support-only 對 Admin data 一律 `DENY`；經 Cloudflare Access 的 Admin host 須維持 Admin UI/API 可用。Host routing 不授權 Player host 讀取 Admin data。

## Machine Health Probe

`server_admin_api` 僅以無憑證 loopback `GET /api/admin/server/status` 檢查服務與權限邊界；HTTP 403 列為 `HEALTHY`。健康探針不取得 Admin data，也沒有 Admin 寫入權限。

```text
SERVER_ADMIN_API_HEALTH_AUTHORITY = HEALTH_PROBE_ONLY
SERVER_ADMIN_API_ADMIN_DATA_AUTHORITY = NO
SERVER_ADMIN_API_WRITE_AUTHORITY = NO
```

## Reopen Conditions

只有下列任一條件有實證，或 Project Control／使用者明確作出第六項決策，才可重開 Admin Browser identity 分析：

1. Cloudflare Access policy 被移除或改變。
2. Admin origin 可從公網繞過 Cloudflare 直接存取。
3. 非 `ALLOWLISTED_OWNER_IDENTITY` 實際成功進入 Admin host。
4. Player host 實際取得 Admin data。
5. Cloudflare 已授權的 Admin Browser 因缺少必要 application auth contract 而無法正常使用 Admin UI/API。
6. Project Control／使用者明確決定將 Admin authentication 從 Cloudflare 移回 Application。

其餘情況固定 `REOPEN_ADMIN_IDENTITY_ANALYSIS = FORBIDDEN`；worker 執行 `STOP_ADMIN_IDENTITY_DEEP_DIVE`，回到當前 `FIRST_BROKEN_TRANSITION`。

## Testing

```text
PASSWORD_REQUIRED_FOR_TEST_FIXTURE = NO
MANUAL_PLAYER_LOGIN_AS_TEST_PREREQUISITE = FORBIDDEN_BY_DEFAULT
PASSWORDLESS_AUTHORIZED_TEST_CONTROL_REUSE_FIRST = YES
```

安全驗收優先沿用既有授權的免密碼 fixture／test-control 路徑，不以玩家密碼、人工 TEST_PLAYER 登入、Admin 人工重新登入、Native Client 或 OpenKore 作為前置條件。明確測試登入 UX 的工作不受此預設限制。此規則不授權偽造 session、繞過認證或擴大測試權限。
