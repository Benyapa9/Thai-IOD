/**
 * Access catalog: the features (what can be done), the tiers (who) and the
 * default grants. Safe for client and server. The live grants are stored in
 * the database (TierFeature) and edited on /admin/tiers; DEFAULT_GRANTS is only
 * the seed (from docs/access-matrix-prompts.md).
 */

export const TIER_IDS = ["basic", "standard", "advanced", "it"] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface TierDef {
  id: TierId;
  name: string;
  /** Role name before the tier system (for migration and display). */
  legacyRole: "staff" | "manager" | "cfo" | "admin";
  level: number;
  /** Tier this one inherits from (Basic → Standard → Advanced → IT). */
  inheritsFromId: TierId | null;
  summary: string;
}

export const TIERS: TierDef[] = [
  { id: "basic", name: "Basic", legacyRole: "staff", level: 1, inheritsFromId: null, summary: "ผู้ใช้ทั่วไป ดูข้อมูลและติดตามประเด็น" },
  { id: "standard", name: "Standard", legacyRole: "manager", level: 2, inheritsFromId: "basic", summary: "Basic + เขียนความเห็น ส่งออกรายงาน ผู้ช่วย AI" },
  { id: "advanced", name: "Advanced", legacyRole: "cfo", level: 3, inheritsFromId: "standard", summary: "Standard + วางแผนสถานการณ์ แก้เกณฑ์แจ้งเตือน" },
  { id: "it", name: "IT", legacyRole: "admin", level: 4, inheritsFromId: "advanced", summary: "ทุกอย่าง รวมถึงจัดการผู้ใช้และระดับสิทธิ์" },
];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<TierId, TierDef>;

export interface FeatureGroup {
  key: string;
  name: string;
  route: string;
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  { key: "dashboard", name: "แดชบอร์ด", route: "/dashboard" },
  { key: "upload", name: "อัปโหลดไฟล์", route: "/upload" },
  { key: "insights", name: "อินไซต์", route: "/insights" },
  { key: "issues", name: "Follow-up Actions", route: "/follow-up" },
  { key: "agent", name: "ผู้ช่วย AI และสร้างกราฟ", route: "FINLEY · /builder" },
  { key: "scenario", name: "วางแผนสถานการณ์", route: "/scenario" },
  { key: "settings", name: "ตั้งค่าและการแจ้งเตือน", route: "/profile" },
  { key: "feedback", name: "แจ้งปัญหา / ข้อเสนอแนะ", route: "/feedback" },
  { key: "admin", name: "ผู้ดูแลระบบ", route: "/admin" },
];

export interface FeatureDef {
  key: string;
  name: string;
  groupKey: string;
  /** Where in the app it applies (shown in the matrix). */
  route: string;
  sortOrder: number;
  /** Level not specified by the spec yet — shown with a "รอยืนยัน" badge. */
  pending?: boolean;
}

const f = <K extends string>(key: K, name: string, groupKey: string, route: string, pending = false) => ({
  key,
  name,
  groupKey,
  route,
  pending,
});

const RAW_FEATURES = [
  f("dashboard.view", "ดู KPI และกราฟ", "dashboard", "/dashboard"),
  f("forecast.view", "ดูคาดการณ์สิ้นปี (P&L Projection / Outlook)", "dashboard", "/dashboard/pnl"),
  f("commentary.view", "ดู Management Note ประจำงวด", "dashboard", "/dashboard"),
  f("commentary.write", "เขียนและแก้ไข Management Note", "dashboard", "/dashboard"),
  f("report.export", "ส่งออกรายงาน (PDF / CSV)", "dashboard", "/dashboard"),
  f("upload.create", "อัปโหลดไฟล์ Excel/CSV", "upload", "/upload"),
  f("upload.history", "ดูประวัติการอัปโหลด", "upload", "/upload"),
  f("upload.delete", "ลบไฟล์ที่อัปโหลดและข้อมูลที่นำเข้า", "upload", "/upload"),
  f("insights.view", "ดูสัญญาณทางการเงิน", "insights", "/insights"),
  f("issues.view", "ดูรายการ Follow-up", "issues", "/follow-up"),
  f("issues.create", "สร้าง Follow-up", "issues", "/follow-up"),
  f("issues.update", "อัปเดตสถานะ ผู้รับผิดชอบ กำหนดส่ง", "issues", "/follow-up"),
  f("issues.delete", "ลบ Follow-up", "issues", "/follow-up"),
  f("agent.chat", "คุยกับ FINLEY (ผู้ช่วย AI)", "agent", "FINLEY", true),
  f("builder.use", "สร้างกราฟเอง (Chart Builder)", "agent", "/builder", true),
  f("scenario.use", "ใช้ what-if ปรับตัวแปร", "scenario", "/scenario"),
  f("scenario.save", "บันทึกสถานการณ์", "scenario", "/scenario"),
  f("scenario.delete", "ลบสถานการณ์ของผู้อื่น", "scenario", "/scenario"),
  f("settings.profile", "ดูและตั้งค่าโปรไฟล์ของฉัน", "settings", "/profile"),
  f("thresholds.view", "ดูเกณฑ์แจ้งเตือน", "settings", "/dashboard", true),
  f("thresholds.edit", "แก้ไขเกณฑ์แจ้งเตือน", "settings", "/dashboard"),
  f("notify.issue", "รับอีเมลเมื่อถูกมอบหมายหรือใกล้ครบกำหนด", "settings", "อีเมล"),
  f("notify.kpi", "รับอีเมลเมื่อ KPI เกินเกณฑ์", "settings", "อีเมล"),
  f("feedback.send", "ส่งเรื่องแจ้งปัญหา / ข้อเสนอแนะ", "feedback", "/feedback"),
  f("feedback.manage", "ดูเรื่องของทุกคนและเปลี่ยนสถานะ", "feedback", "/feedback"),
  f("users.manage", "จัดการผู้ใช้ (ระดับ แผนก เปิด/ปิดบัญชี)", "admin", "/admin/users"),
  f("access.tiers", "ตั้งค่าระดับสิทธิ์ (Matrix นี้)", "admin", "/admin/tiers"),
] as const;

export type FeatureKey = (typeof RAW_FEATURES)[number]["key"];
export const FEATURES: (FeatureDef & { key: FeatureKey })[] = RAW_FEATURES.map((x, i) => ({ ...x, sortOrder: i + 1 }));
export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((x) => x.key);
export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((x) => [x.key, x])) as Record<FeatureKey, FeatureDef>;
export const isFeatureKey = (k: string): k is FeatureKey => k in FEATURE_BY_KEY;

/**
 * Seed grants (docs/access-matrix-prompts.md). Each tier lists only what it adds;
 * higher tiers inherit the rest. feedback.* and upload.delete are features of the
 * current system that the table didn't cover (placed where they were before).
 */
export const DEFAULT_GRANTS: Record<TierId, FeatureKey[]> = {
  basic: [
    "dashboard.view",
    "forecast.view",
    "commentary.view",
    "upload.create",
    "upload.history",
    "insights.view",
    "issues.view",
    "issues.create",
    "issues.update",
    "settings.profile",
    "notify.issue",
    "feedback.send",
  ],
  standard: ["commentary.write", "report.export", "agent.chat", "builder.use", "thresholds.view", "notify.kpi"],
  advanced: ["scenario.use", "scenario.save", "scenario.delete", "thresholds.edit", "feedback.manage", "upload.delete"],
  it: ["issues.delete", "users.manage", "access.tiers"],
};

/** Features the IT tier must always keep, so nobody can lock the admins out. */
export const LOCKOUT_FEATURES: FeatureKey[] = ["users.manage", "access.tiers"];

/** Old role names → tier (migration of existing users). */
export function tierFromLegacyRole(role: string | null | undefined): TierId {
  switch (role) {
    case "it":
    case "admin":
      return "it";
    case "advanced":
    case "cfo":
      return "advanced";
    case "standard":
    case "manager":
      return "standard";
    default:
      return "basic";
  }
}
