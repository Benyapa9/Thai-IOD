# Thai IOD — IOD Finance Portal

เว็บแอปพลิเคชันแดชบอร์ดการเงินสำหรับทีม F&A ของ **Thai Institute of Directors (Thai IOD)**
พัฒนาโดย **ZyGen Co., Ltd. — Business Analytics & AI (BAAI) Team**

> ⚠️ **สถานะ:** Architecture / Tech Stack / Data Model — Confirmed · **UX/UI — ยังไม่ Finalize (จะออกแบบใหม่)**

## ฟีเจอร์หลัก

- อัปโหลดและวิเคราะห์ข้อมูลการเงิน (Excel/CSV)
- KPI Dashboard — Revenue, Expense, NOI, Budget Variance
- Year-End Forecast อัตโนมัติ
- What-if Scenario Planning
- Issue Log — แจ้งปัญหา มอบหมายงาน แจ้งเตือนทาง Email
- Management Commentary และ Alert Thresholds
- AI Agent (BAAI Finance Assistant)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts |
| State / Forms | Zustand · TanStack Query · React Hook Form + Zod |
| Backend | Next.js API Routes · Prisma |
| Database | Azure SQL Database |
| Auth | NextAuth.js v5 + Microsoft Entra ID (SSO) |
| Storage / Email | Azure Blob Storage · Azure Communication Services |
| CI/CD / Hosting | GitHub Actions → Azure Static Web Apps |

## หน้าในระบบ (Functional scope — UI TBD)

| Route | หน้า |
|-------|------|
| `/dashboard` | Dashboard |
| `/upload` | Upload Files |
| `/insights` | Insights |
| `/issues` | Issue Log |
| `/agent` | AI Agent |
| `/builder` | Chart Builder |
| `/scenario` | Scenario Planning |
| `/settings` | Settings |

## เริ่มต้นใช้งาน (Local Dev)

```bash
npm install
npx prisma generate
cp .env.example .env.local   # ตั้งค่า NEXTAUTH_SECRET และ AUTH_DEMO_LOGIN="true"
npm run dev                  # http://localhost:3100
```

- ถ้าไม่ตั้ง `DATABASE_URL` ระบบจะทำงานใน **โหมดสาธิต** ใช้ข้อมูลตัวอย่าง ม.ค.–ส.ค. 2569 ในหน่วยความจำ
- `AUTH_DEMO_LOGIN="true"` จะแสดงปุ่มเข้าสู่ระบบด้วยบัญชีสาธิต (Staff / Manager / CFO / Admin) — ใช้ได้เฉพาะ dev
- ตั้งค่า `AZURE_AD_*` เพื่อเปิด Microsoft SSO, `ANTHROPIC_API_KEY` เพื่อใช้ AI Agent เต็มรูปแบบ
- เชื่อม Azure SQL: ตั้ง `DATABASE_URL` แล้วรัน `npx prisma migrate dev`

## เอกสาร

| ไฟล์ | รายละเอียด |
|------|-----------|
| [`Doc/IOD_Finance_Portal_Spec_v1.1.docx`](Doc/IOD_Finance_Portal_Spec_v1.1.docx) | Technical Foundation Spec ฉบับเต็ม |
| [`Doc/PROJECT_PROMPT.md`](Doc/PROJECT_PROMPT.md) | Project bootstrap prompt, schema, API routes, env vars, deployment checklist |
| [`CLAUDE.md`](CLAUDE.md) | System prompt สำหรับ AI coding assistant |

## Phases

- **Phase 0 — Prototype** ✅ Done
- **Phase 1 — Foundation** (Next.js scaffold, Azure SQL, Entra ID Auth, File Upload, Core API) 📋 Planned
- **Phase 2 — Core Data** (Real data, Issue Log, Commentary, Alert Email) 📋 Planned
- **Phase 3 — AI & Advanced** (AI Agent, Scenario save/load, Reporting) 📋 Planned
- **UX Redesign** ⏳ TBD

---

*ZyGen BAAI Team — September 2026*
