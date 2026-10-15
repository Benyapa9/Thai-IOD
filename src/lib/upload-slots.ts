/**
 * Expected source files (from the prototype's upload page). Files are matched to
 * a slot by filename; the slot is also stored as the blob path prefix so a file
 * picked for a specific row keeps that slot even if its name differs.
 */
export interface UploadSlot {
  key: string;
  name: string;
  pattern: string;
  match: RegExp;
  required: boolean;
}

// Order matters: more specific patterns first ("Master Revenue" before "Master_").
export const UPLOAD_SLOTS: UploadSlot[] = [
  { key: "bg_year", name: "งบประมาณประจำปี", pattern: "BG_YEAR_*.xlsx", match: /^bg_year/i, required: true },
  { key: "actual", name: "ข้อมูลใช้จ่ายจริง", pattern: "Actual_*.xlsx", match: /^actual/i, required: true },
  { key: "bg_capital", name: "งบลงทุน (Capital)", pattern: "BG_Capital_*.xlsx", match: /^bg_capital/i, required: true },
  { key: "master_revenue", name: "Master รายได้และรายจ่าย", pattern: "Master Revenue & Expense_*.xlsx", match: /^master[ _-]?revenue/i, required: true },
  { key: "master", name: "ข้อมูล Master หลัก", pattern: "Master_*.xlsx", match: /^master_/i, required: true },
  { key: "dept_master", name: "ข้อมูลแผนก", pattern: "Dept_Master_*.xlsx", match: /^dept_master/i, required: true },
  { key: "event", name: "ข้อมูลกิจกรรม", pattern: "Event_*.xlsx", match: /^event_/i, required: false },
  { key: "member", name: "ข้อมูลสมาชิก", pattern: "Member_*.xlsx", match: /^member_/i, required: false },
  { key: "sponsor", name: "ข้อมูลผู้สนับสนุน", pattern: "Sponsor_*.xlsx", match: /^sponsor_/i, required: false },
  { key: "template_member", name: "แบบฟอร์มสมาชิก", pattern: "Template Member_*.xlsx", match: /^template[ _-]?member/i, required: false },
];

/** Display order in the UI (required first, in the prototype's order). */
export const SLOT_DISPLAY_ORDER = [
  "bg_year",
  "actual",
  "bg_capital",
  "master",
  "master_revenue",
  "dept_master",
  "event",
  "member",
  "sponsor",
  "template_member",
];

export const SLOT_BY_KEY = Object.fromEntries(UPLOAD_SLOTS.map((s) => [s.key, s])) as Record<
  string,
  UploadSlot
>;

export function detectSlot(filename: string): UploadSlot | undefined {
  const base = filename.replace(/\.(xlsx|xls|csv)$/i, "").trim();
  return UPLOAD_SLOTS.find((s) => s.match.test(base));
}

/** Slot of a stored upload: blob path prefix first, then the original filename. */
export function slotOfUpload(upload: { filename: string; originalName: string }) {
  const prefix = upload.filename.split("/")[0];
  return SLOT_BY_KEY[prefix] ?? detectSlot(upload.originalName);
}

/**
 * Which dashboards each source file feeds, and what it contributes (MOM U1/U2).
 * Keys of DASHBOARD_PAGES in alert-defs.
 */
export const SLOT_USAGE: Record<string, { feeds: string[]; purpose: string }> = {
  bg_year: { feeds: ["kpi", "training", "expenditure", "membership", "pnl", "capital"], purpose: "แผนรายได้ / งบค่าใช้จ่ายรายเดือน และที่นั่งตามแผน" },
  actual: { feeds: ["kpi", "training", "expenditure", "membership", "pnl"], purpose: "รายได้และค่าใช้จ่ายจริงจากบัญชีแยกประเภท (GL) รายเดือน" },
  bg_capital: { feeds: ["training", "capital"], purpose: "ความคืบหน้างบลงทุน ใช้ไป/คงเหลือ และที่นั่งจริงของแต่ละรุ่น" },
  master: { feeds: ["kpi", "training", "expenditure", "membership", "pnl"], purpose: "จับคู่รหัสบัญชีกับประเภทรายได้/ค่าใช้จ่าย" },
  master_revenue: { feeds: ["kpi", "pnl"], purpose: "โครงสร้างบรรทัด P&L และ EBITDA" },
  dept_master: { feeds: ["kpi", "expenditure", "capital"], purpose: "รายชื่อหน่วยงานและชื่อย่อ" },
  event: { feeds: ["membership"], purpose: "จำนวนกิจกรรมและผู้เข้าร่วมสัมมนา" },
  member: { feeds: ["membership"], purpose: "การต่ออายุ / สมาชิกใหม่ รายเดือน" },
  sponsor: { feeds: ["membership"], purpose: "จำนวนผู้สนับสนุน" },
  template_member: { feeds: ["membership"], purpose: "แผนและจำนวนสมาชิกคงอยู่ (Active Members)" },
};
