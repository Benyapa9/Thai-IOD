import type { TierId } from "@/lib/access/catalog";
import type {
  AlertThreshold,
  Category,
  Commentary,
  FinancialRecord,
  IssueLog,
  Upload,
  User,
} from "@/types/domain";
import { defaultThresholds } from "@/lib/alert-defs";

/** Illustrative demo data only — not real Thai IOD figures. */

const now = new Date("2026-09-15T09:00:00+07:00");

function user(
  id: string,
  name: string,
  role: User["role"],
  department: string,
  departments: string[] | null = null,
  tierId: TierId = role,
): User {
  return {
    id,
    entraId: `demo-${id}`,
    email: `${id}@demo.iod.local`,
    name,
    role,
    tierId,
    permVersion: 1,
    department,
    departments,
    jobTitle: null,
    image: null,
    consent: null,
    tourSeen: null,
    theme: "navy",
    locale: "th",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Demo accounts, one per access level (+ one Basic user limited to a single department). */
export const seedUsers: User[] = [
  user("staff", "สมชาย ใจดี", "basic", "F&A"),
  user("manager", "สุดา วงศ์ทอง", "standard", "F&A"),
  user("cfo", "ประเสริฐ ศรีสุข", "advanced", "Finance"),
  user("admin", "ทีม IT (ผู้ดูแลระบบ)", "advanced", "Information Technology", null, "it"),
  user("it", "วิภา ไอที", "basic", "Information Technology", ["Information Technology"]),
];

const BASE: Record<Category, { revenue: number; expense: number; budget: number }> = {
  training: { revenue: 4_600_000, expense: 3_050_000, budget: 3_150_000 },
  membership: { revenue: 1_850_000, expense: 620_000, budget: 650_000 },
  sponsorship: { revenue: 1_250_000, expense: 480_000, budget: 450_000 },
  corporate: { revenue: 2_500_000, expense: 1_620_000, budget: 1_700_000 },
};

/** Deterministic wiggle in [-1, 1] so every reload shows the same numbers. */
function wiggle(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export const SEED_UPLOAD_ID = "seed-upload";

export function seedFinancial(): { upload: Upload; records: FinancialRecord[] } {
  const records: FinancialRecord[] = [];
  const months = 8; // Jan–Aug 2026
  let i = 0;
  for (let m = 1; m <= months; m++) {
    const period = `2026-${String(m).padStart(2, "0")}`;
    (Object.keys(BASE) as Category[]).forEach((category, ci) => {
      const base = BASE[category];
      const season = 1 + 0.08 * Math.sin((m / 12) * Math.PI * 2 + ci);
      let revenue = base.revenue * season * (1 + 0.06 * wiggle(m * 7 + ci));
      let expense = base.expense * (1 + 0.05 * wiggle(m * 11 + ci * 3));
      const budget = base.budget;

      // Storylines for Insights / Alerts
      if (category === "training" && m === 8) revenue *= 0.82; // training dip in Aug
      if (category === "sponsorship" && m >= 6) expense *= 1.12 + (m - 6) * 0.04; // overspend trend
      if (category === "corporate" && m >= 5) revenue *= 1.1; // corporate growth

      for (const [type, amount] of [
        ["revenue", revenue],
        ["expense", expense],
        ["budget", budget],
      ] as const) {
        records.push({
          id: `seed-${i++}`,
          period,
          periodType: "monthly",
          category,
          type,
          amount: Math.round(amount),
          currency: "THB",
          uploadId: SEED_UPLOAD_ID,
          createdAt: now,
        });
      }
    });
  }
  return {
    upload: {
      id: SEED_UPLOAD_ID,
      filename: "seed/financial-2026-jan-aug.xlsx",
      originalName: "financial-2026-jan-aug.xlsx",
      blobUrl: "demo://seed/financial-2026-jan-aug.xlsx",
      sizeBytes: 48_213,
      uploadedBy: "staff",
      processedAt: now,
      createdAt: now,
      recordCount: records.length,
    },
    records,
  };
}

type IssueSeed = Pick<
  IssueLog,
  "title" | "description" | "severity" | "category" | "status" | "reporter" | "ownerId" | "dueDate"
> &
  Partial<IssueLog>;

function issue(id: string, partial: IssueSeed): IssueLog {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    plan: null,
    approach: null,
    outcome: null,
    outcomeResult: "pending",
    sourceInsightId: null,
    metricLabel: null,
    baselineValue: null,
    ...partial,
  };
}

export const seedIssues: IssueLog[] = [
  issue("issue-1", {
    title: "ค่าใช้จ่ายสปอนเซอร์เกินงบต่อเนื่อง 3 เดือน",
    description: "ค่าใช้จ่ายหมวด Sponsorship สูงกว่างบตั้งแต่ มิ.ย. ต้องทบทวนสัญญาผู้จัดงาน",
    severity: "high",
    category: "budget",
    status: "in_progress",
    reporter: "staff",
    ownerId: "manager",
    dueDate: new Date("2026-10-05"),
  }),
  issue("issue-2", {
    title: "รายได้หลักสูตรอบรม ส.ค. ต่ำกว่าคาด",
    description: "จำนวนผู้ลงทะเบียน DCP รุ่น ส.ค. ลดลง ตรวจสอบการยกเลิกรุ่น",
    severity: "medium",
    category: "revenue",
    status: "open",
    reporter: "manager",
    ownerId: "staff",
    dueDate: new Date("2026-09-30"),
  }),
  issue("issue-3", {
    title: "ไฟล์ปิดบัญชี ก.ค. มีรหัสหมวดไม่ตรง",
    description: null,
    severity: "low",
    category: "system",
    status: "resolved",
    reporter: "staff",
    ownerId: "admin",
    dueDate: new Date("2026-08-20"),
    resolvedAt: new Date("2026-08-18"),
  }),
  issue("issue-4", {
    title: "เอกสารภาษีหัก ณ ที่จ่าย ไตรมาส 2 ยังไม่ครบ",
    description: "ขาดเอกสารจากผู้สนับสนุน 2 ราย",
    severity: "critical",
    category: "compliance",
    status: "open",
    reporter: "cfo",
    ownerId: "manager",
    dueDate: new Date("2026-09-25"),
  }),
];

export const seedCommentary: Commentary[] = [
  {
    id: "comm-1",
    period: "2026-08",
    content:
      "รายได้รวม ส.ค. ลดลงจากเดือนก่อน เนื่องจากหลักสูตรอบรมมีผู้เข้าร่วมน้อยกว่าคาด ขณะที่รายได้องค์กรยังเติบโตต่อเนื่อง ค่าใช้จ่ายสปอนเซอร์เกินงบ ต้องติดตามใกล้ชิดใน Q4",
    authorId: "manager",
    createdAt: now,
    updatedAt: now,
  },
];

export const seedThresholds: AlertThreshold[] = defaultThresholds().map((t, i) => ({
  ...t,
  id: `th-${i + 1}`,
  updatedBy: null,
  updatedAt: now,
}));
