You are a senior full-stack developer building the **IOD Finance Portal** —
a financial dashboard web application for Thai Institute of Directors (Thai IOD),
developed and hosted by ZyGen Co., Ltd. (ZyGen BAAI Team).

---

## IMPORTANT: UX/UI STATUS

The UX and UI design for this project is NOT FINALIZED.
Do NOT replicate the prototype's visual design — the HTML prototype at
`reference/iod-dashboard.html` exists only as a functional feature reference.

What IS confirmed:
- Page/feature inventory (which pages and features exist)
- Data model and API contracts
- Tech stack and infrastructure
- Authentication method

What is NOT confirmed (will be designed separately):
- Visual layout, color palette, component choices
- Navigation structure
- Mobile/responsive behavior
- Chart types and data presentation style

When building UI, scaffold with minimal placeholder components.
Wait for UX specifications before implementing visual design.

---

## PROJECT IDENTITY

- **Product Name:** IOD Finance Portal
- **Client:** Thai Institute of Directors (Thai IOD)
- **Developer:** ZyGen Co., Ltd. — Business Analytics & AI (BAAI) Team
- **Repository:** ZyGen GitHub Organization (URL TBD — will be provided)
- **Domain:** *.zygenplay.com (subdomain TBD — will be confirmed at deploy time)
- **Language:** Primary UI in Thai (ภาษาไทย), codebase in English

---

## TECH STACK (CONFIRMED)

### Frontend
- **Framework:** Next.js 14+ with App Router + TypeScript (strict mode)
- **UI Components:** shadcn/ui (base) — visual theme TBD
- **Styling:** Tailwind CSS
- **Charts:** Recharts — specific chart designs TBD
- **State:** Zustand (global) + TanStack Query (server state)
- **Forms:** React Hook Form + Zod

### Backend
- **API:** Next.js API Routes (Node.js runtime)
- **ORM:** Prisma
- **File Processing:** SheetJS (xlsx) + PapaParse (csv)
- **File Storage:** Azure Blob Storage

### Authentication (CONFIRMED)
- **Provider:** Microsoft Entra ID (Azure Active Directory)
- **Library:** NextAuth.js v5 with `@auth/microsoft-entra-id` provider
- **Pattern:** OAuth 2.0 / OIDC — users sign in with their Microsoft 365 account
- **Session:** JWT, 8-hour expiry, auto-refresh
- **RBAC Roles:** `staff` | `manager` | `cfo` | `admin`
  - staff: view + upload + issue log
  - manager: staff + export + commentary
  - cfo: manager + scenario + thresholds
  - admin: all + user management

### Notifications / Email (CONFIRMED — Azure)
- **Service:** Azure Communication Services (Email)
- **SDK:** `@azure/communication-email`
- **Triggers:** Issue assigned, due date approaching, KPI alert breach
- **Template engine:** Simple HTML templates (no external service)

### Database
- **Engine:** Azure SQL Database (Microsoft SQL Server)
- **ORM:** Prisma with `sqlserver` provider
- **Migrations:** `prisma migrate deploy` via CI/CD

### Infrastructure (ZyGen-hosted)
- Azure Static Web Apps — Next.js hosting
- Azure SQL Database — primary data store
- Azure Blob Storage — file uploads (Excel/CSV)
- Azure Entra ID — identity provider
- Azure Communication Services — email notifications
- Azure Key Vault — secrets management
- GitHub Actions (ZyGen Org) — CI/CD pipeline

---

## DATABASE SCHEMA (Prisma — sqlserver provider)

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id         String   @id @default(cuid())
  entraId    String   @unique   // Azure AD Object ID
  email      String   @unique
  name       String
  role       String   @default("staff")
  department String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Upload {
  id          String            @id @default(cuid())
  filename    String
  originalName String
  blobUrl     String
  sizeBytes   Int
  uploadedBy  String            // User.id
  processedAt DateTime?
  records     FinancialRecord[]
  createdAt   DateTime          @default(now())
}

model FinancialRecord {
  id         String   @id @default(cuid())
  period     String   // "2026-01" or "2026-Q1"
  periodType String   // "monthly" | "quarterly" | "annual"
  category   String   // "training" | "membership" | "sponsorship" | "corporate"
  type       String   // "revenue" | "expense" | "budget"
  amount     Float
  currency   String   @default("THB")
  uploadId   String
  upload     Upload   @relation(fields: [uploadId], references: [id])
  createdAt  DateTime @default(now())
}

model IssueLog {
  id          String    @id @default(cuid())
  title       String
  description String?
  severity    String    // "critical" | "high" | "medium" | "low"
  category    String    // "budget" | "revenue" | "compliance" | "system" | "other"
  status      String    @default("open")
  reporter    String    // User.id
  ownerId     String?   // User.id
  dueDate     DateTime?
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Commentary {
  id        String   @id @default(cuid())
  period    String   // "2026-08"
  content   String
  authorId  String   // User.id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AlertThreshold {
  id        String  @id @default(cuid())
  metric    String  @unique
  // "budget_variance" | "revenue_gap" | "noi_drop" | "expense_over"
  threshold Float
  operator  String  // "gt" | "lt"
  isActive  Boolean @default(true)
  updatedBy String? // User.id
  updatedAt DateTime @updatedAt
}

model Scenario {
  id          String   @id @default(cuid())
  name        String
  levers      String   // JSON string
  projections String   // JSON string
  savedBy     String   // User.id
  createdAt   DateTime @default(now())
}
```

---

## API ROUTES (to be implemented)

### Auth
- `GET  /api/auth/[...nextauth]` — NextAuth handler (Entra ID)

### Financial Data
- `POST /api/upload`              — Upload + process Excel/CSV file
- `GET  /api/financial`           — Get records (filter: period, category, type)
- `GET  /api/financial/summary`   — Aggregated KPIs for dashboard
- `GET  /api/financial/forecast`  — Year-end forecast calculation

### Issues
- `GET    /api/issues`            — List issues (filter: status, severity, owner)
- `POST   /api/issues`            — Create issue
- `PATCH  /api/issues/[id]`       — Update status/owner/dueDate
- `DELETE /api/issues/[id]`       — Delete (admin only)

### Commentary
- `GET  /api/commentary/[period]` — Get commentary for period
- `PUT  /api/commentary/[period]` — Upsert commentary

### Alerts
- `GET  /api/alerts/thresholds`   — Get all thresholds
- `PUT  /api/alerts/thresholds`   — Update thresholds (cfo/admin only)

### Scenarios
- `GET  /api/scenarios`           — List saved scenarios
- `POST /api/scenarios`           — Save scenario
- `DELETE /api/scenarios/[id]`    — Delete scenario

### AI Agent
- `POST /api/ai/chat`             — Stream chat response (SSE)

### Notifications (internal, triggered server-side)
- Trigger: issue assigned → email owner via Azure Communication Services
- Trigger: due date T-1 day → email owner
- Trigger: KPI threshold breach → email CFO/manager list

---

## PAGES (functional scope confirmed — visual design TBD)

| Route | Page | Core Function |
|-------|------|---------------|
| `/` or `/dashboard` | Dashboard | KPI overview, charts, forecast, commentary |
| `/upload` | Upload Files | File ingestion (Excel/CSV) |
| `/insights` | Insights | Auto-generated financial signals |
| `/issues` | Issue Log | Create/track/assign financial issues |
| `/agent` | AI Agent | Chat with BAAI Finance Assistant |
| `/builder` | Chart Builder | Custom chart creation |
| `/scenario` | Scenario Planning | What-if slider analysis |
| `/settings` | Settings | Thresholds, user profile (admin: user mgmt) |

---

## ENVIRONMENT VARIABLES

```bash
# ── DATABASE ──────────────────────────────────────────────
DATABASE_URL="sqlserver://<server>.database.windows.net:1433;database=<db>;user=<user>;password=<pass>;encrypt=true"

# ── AZURE STORAGE ─────────────────────────────────────────
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="iod-uploads"

# ── MICROSOFT ENTRA ID (Azure AD) ────────────────────────
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""

# ── NEXTAUTH ──────────────────────────────────────────────
NEXTAUTH_SECRET=""          # openssl rand -base64 32
NEXTAUTH_URL=""             # https://<subdomain>.zygenplay.com (TBD)

# ── AI AGENT ──────────────────────────────────────────────
ANTHROPIC_API_KEY=""        # Optional — AI Agent feature

# ── AZURE COMMUNICATION SERVICES ──────────────────────────
AZURE_COMMUNICATION_CONNECTION_STRING=""
AZURE_COMMUNICATION_SENDER_ADDRESS=""   # e.g. donotreply@<domain>.azurecomm.net

# ── AZURE KEY VAULT (optional, recommended for prod) ──────
AZURE_KEY_VAULT_URL=""      # https://iod-finance-kv.vault.azure.net/
```

---

## PROJECT SCAFFOLD COMMANDS

```bash
# 1. Clone from ZyGen GitHub Org (replace with actual repo URL when provided)
git clone https://github.com/zygen/<repo-name>.git
cd <repo-name>

# — OR — create fresh:
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Core dependencies
npm install prisma @prisma/client
npm install @azure/storage-blob @azure/identity @azure/communication-email
npm install next-auth@beta @auth/prisma-adapter
npm install @anthropic-ai/sdk
npm install recharts
npm install react-hook-form zod @hookform/resolvers
npm install zustand @tanstack/react-query
npm install xlsx papaparse
npm install -D @types/papaparse

# 3. shadcn/ui base (visual theme to be chosen later)
npx shadcn@latest init
npx shadcn@latest add button card input select textarea table badge dialog sheet

# 4. Prisma init for Azure SQL
npx prisma init --datasource-provider sqlserver

# 5. Copy schema (paste schema above into prisma/schema.prisma)
# 6. Copy .env.example → .env.local and fill in values
```

---

## FIRST FILES TO CREATE (scaffold order)

```
1. prisma/schema.prisma          ← paste schema above
2. src/lib/prisma.ts             ← singleton PrismaClient
3. src/lib/auth.ts               ← NextAuth + Entra ID config
4. src/lib/azure-blob.ts         ← Blob Storage upload helper
5. src/lib/azure-email.ts        ← Communication Services helper
6. src/middleware.ts             ← Route protection (role check)
7. src/app/layout.tsx            ← Root layout + providers
8. src/app/(auth)/login/page.tsx ← Microsoft SSO login page (minimal)
9. src/app/(app)/layout.tsx      ← App shell (sidebar placeholder)
10. src/app/(app)/dashboard/page.tsx  ← Dashboard scaffold (placeholder)
11. src/app/api/auth/[...nextauth]/route.ts
12. src/app/api/financial/summary/route.ts
13. src/app/api/upload/route.ts
```

---

## TBD — ITEMS PENDING DESIGN DECISION

- [ ] **UX/UI Design** — Color palette, layout, component style (will be redesigned)
- [ ] **Navigation structure** — Sidebar vs top nav vs hybrid
- [ ] **Domain/subdomain** — TBD at deploy time (`*.zygenplay.com`)
- [ ] **GitHub Repo URL** — ZyGen GitHub Org (will be provided)
- [ ] **Azure resource names** — Naming convention for ZyGen's subscription
- [ ] **Email sender domain** — Azure Communication Services domain
- [ ] **AI Model choice** — Anthropic claude-3-5-haiku vs Azure OpenAI
- [ ] **Report export format** — PDF via browser print vs server-side PDF generation
- [ ] **Audit log depth** — Which actions to log and where

---

## REFERENCE FILES

| ไฟล์ | ใช้เพื่อ |
|------|---------|
| `reference/iod-dashboard.html` | Feature reference — ไม่ใช่ UI reference |
| `IOD_Finance_Portal_Spec_v1.0.docx` | Spec document ฉบับเต็ม |
| `PROJECT_PROMPT.md` | ไฟล์นี้ — Bootstrap prompt |

---

*IOD Finance Portal — ZyGen BAAI Team — September 2026*  
*UX/UI redesign pending — do not implement visual design from prototype*
