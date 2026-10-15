---
name: "iod-security-review"
description: "Use when adding or reviewing API routes, auth/RBAC, forms, env/secrets, or the Excel/CSV upload and Azure Blob flow in the IOD Finance Portal, and before any client demo or release."
---

# IOD Finance Portal: Security Review

Context: financial data for a client, Microsoft Entra ID via NextAuth v5 (JWT, 8h, tier/permissions re-read from DB every 60s), access tiers Basic < Standard < Advanced < IT with a dynamic feature matrix (MOM A2–A4; no position-based roles) plus per-user department data access (MOM A5), Prisma on Azure SQL (in-memory store when `DATABASE_URL` is empty), Azure Blob uploads, Anthropic API for the FINLEY assistant. Local-only demo login (`AUTH_DEMO_LOGIN`) and demo persona switch must stay disabled in production.

Report findings as: severity (Critical/High/Medium/Low), file:line, what is wrong, how to exploit it, fix. Do not edit code unless asked; propose diffs.

## 1. Authentication & session
- Every route handler under `src/app/api/**` calls `auth()` itself and returns 401 when no session. Middleware is a convenience, never the only guard.
- Reject users whose `User.isActive` is false, even with a valid token. Re-check role from DB or a short-lived token claim, not from client input.
- `NEXTAUTH_SECRET` set, `AUTH_TRUST_HOST`/URL correct per environment, cookies `Secure`, `HttpOnly`, `SameSite=Lax`.
- Restrict sign-in to the expected tenant (`AZURE_AD_TENANT_ID`) and, if required, an allowed email domain.

## 2. Authorization (RBAC + object level)
Access is a dynamic Tier × Feature matrix (Basic → Standard → Advanced → IT, each inherits the previous; a deny at the nearer tier wins; unspecified = denied). Catalog and defaults: `src/lib/access/catalog.ts`; resolution: `src/lib/access/engine.ts`; live grants are stored in the DB (`Tier`, `Feature`, `TierFeature`, `AccessState.version`) and edited at `/admin/tiers`.
- Every handler calls `requireFeature(featureKey)` from `src/server/http.ts` (reads the DB user + live matrix; 401 inactive, 403 with a Thai message). Pages are guarded by `guardRoute()` in their section layout (`ROUTE_FEATURES` in `src/lib/rbac.ts`). Never compare role strings ad hoc.
- Examples: `PUT /api/alerts/thresholds` → `thresholds.edit`. `DELETE /api/issues/[id]` → `issues.delete`. `PUT /api/access/matrix` → `access.tiers`. `PATCH /api/users` → `users.manage` (must refuse your own row, and 409 if no active IT user would remain).
- Matrix saves: optimistic version check done atomically (409 when stale); IT must always keep `users.manage` and `access.tiers` (lock-out guard); every change writes `AccessAuditLog`.
- Sessions pick up tier/matrix changes within 60 s (`permVersion`, `AccessState.version`); the JWT `features` claim is for UI only — servers re-check.
- Scenarios: everyone with `scenario.use` may read; only the owner may `PATCH`; delete = owner with `scenario.save`, or anyone's with `scenario.delete`.
- **Department scope (A5):** any route returning financial data (dashboard, insights, home, alerts, scenario baseline, AI chat context) must apply `allowedDepartments(user)` server-side; a restricted user must not get other departments by passing `?dept=` or `?pc=`. `departments: []` must be rejected (it would otherwise read as "all").
- IDOR: scenario, issue and upload IDs must be checked for permission, not just existence. Never trust `userId`, `role`, `uploadedBy` from the request body; take them from the session.
- UI hiding a button is not authorization.

## 3. Input validation
- Every handler parses `params`, `searchParams` and body with a Zod schema; use `safeParse`, return 400 with a generic message. Whitelist enums (`severity`, `status`, `periodType`, `category`, `type`), bound string lengths and numeric ranges, validate `period` with a regex.
- Use Prisma query builder only. If `$queryRaw` is used it must be tagged-template parameterized.
- Escape or sanitize anything rendered as HTML (commentary, issue descriptions, AI output). No `dangerouslySetInnerHTML` on user content. Email HTML templates must escape interpolated values.

## 4. Secrets & configuration
- `.env.local` is git-ignored; `.env.example` has no real values. Scan git history/diff for keys (`AccountKey=`, `sk-ant-`, client secrets).
- No secret in a `NEXT_PUBLIC_` variable. `ANTHROPIC_API_KEY`, storage and communication connection strings are used only in server code (`import 'server-only'`).
- Production secrets come from Azure Key Vault / managed identity, not committed files. Prefer `DefaultAzureCredential` over connection strings where possible.
- Logs and error responses never contain tokens, connection strings or stack traces.

## 5. File upload (Excel/CSV) and Blob
- Server-side limits: max size (e.g. 10 MB), max rows/sheets, request timeout. Reject early using `Content-Length` and while streaming.
- Validate extension allow-list (`.xlsx`, `.csv`), MIME type AND magic bytes (xlsx is a ZIP `PK\x03\x04`). Reject `.xlsm`, `.xls` with macros, encrypted or password-protected files.
- Parse only on the server with SheetJS / PapaParse; never evaluate formulas. Treat all cells as untrusted strings; coerce and validate to the `FinancialRecord` shape with Zod; reject the whole upload or report row-level errors, never partially insert silently. Use a transaction.
- Beware prototype-pollution style keys (`__proto__`, `constructor`) when mapping headers to objects; map headers via an explicit allow-list.
- CSV/Excel formula injection: when exporting, prefix cell values starting with `=`, `+`, `-`, `@` with `'`.
- Blob: private container, random server-generated blob names (never the user filename; keep `originalName` only as metadata and sanitize it), no public URLs; serve downloads through an authorized route or a short-lived read-only SAS (minutes). Store `blobUrl` without SAS tokens.
- Duplicate-upload and replay handling: define whether the same period can be uploaded twice and who can overwrite.

## 6. Data integrity
- `amount` is `Float` in the schema; flag as Medium risk for money (rounding). Recommend `Decimal` or integer satang and consistent rounding.
- Audit-log who uploaded, edited thresholds, deleted issues or changed roles (scope is TBD in CLAUDE.md; recommend at least these).

## 7. AI agent endpoint (`/api/ai/chat`)
- Authenticated, rate-limited, max message size and history length. Server builds the context from data the caller is allowed to read; never let the model fetch data beyond the caller's role.
- Treat uploaded file content and issue text as untrusted prompt content (prompt injection): the model has no write tools unless explicitly gated.
- Stream errors must not leak internals.

## 8. Transport & headers
- HTTPS only, HSTS. Configure CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'` in `next.config.ts`.
- CORS: no wildcard on authenticated routes. State-changing routes rely on SameSite cookies plus Origin check.
- Rate-limit login callbacks, upload and AI routes.

## 9. Dependencies
- Run `npm audit`; review `xlsx` (SheetJS CDN tarball, pinned version), `next-auth` beta, `@azure/*`. Lockfile committed. Note anything unpatched in the report.

## Output
End with a table: Area | Status (Pass/Fail/N-A) | Finding count, then a prioritized fix list and any item that must be fixed before the client demo.