import "server-only";
import { createHash } from "node:crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  AccountMap,
  ActivitySource,
  ActivityStat,
  BudgetLine,
  BudgetProgress,
  DatasetBatch,
  Department,
  GlTransaction,
  MemberStat,
  PnlLine,
} from "@/types/dataset";

// ── cell helpers ─────────────────────────────────────────────

type Row = Record<string, unknown>;

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[,฿\s%]/g, "");
  if (!s) return 0;
  const n = Number(s.replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : 0;
}

/** "24/08/2026" (d/m/y). */
export function parseDmy(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const m = String(v ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const monthIndex = (name: unknown) => MONTHS_EN.indexOf(String(name ?? "").trim().slice(0, 3).toLowerCase()) + 1;
export const periodOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

function sheetRows(buffer: Buffer, preferredSheet?: string): Row[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const name = preferredSheet && wb.Sheets[preferredSheet] ? preferredSheet : wb.SheetNames[0];
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: null, raw: true });
}

/** Source CSVs are exported as Windows-874 (Thai) — fall back when not valid UTF-8. */
function decodeText(buffer: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-874").decode(buffer);
  }
}

/** Extract YYYYMM from names like "BG_Capital_202608_20260902.xlsx". */
function periodFromFilename(filename: string) {
  const m = filename.match(/_(20\d{2})(0[1-9]|1[0-2])_/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// ── Actual (GL transaction detail) ───────────────────────────

const ACCOUNT_RE = /^\d{5}-\d{2}$/;

/**
 * Sage "G/L Transaction Details Optional Fields" export. Every row repeats the
 * report header; the transaction segment starts at the account code:
 * [account, name, _, _, _, _, posting seq, batch-entry, date, period,
 *  optional field, value (budget code), description, reference, debit, credit]
 */
export function parseActual(buffer: Buffer): DatasetBatch {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames.find((n) => /gl/i.test(n)) ?? wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });

  const out: GlTransaction[] = [];
  for (const r of rows) {
    const i = r.findIndex((v) => typeof v === "string" && ACCOUNT_RE.test(v));
    if (i < 0) continue;
    const seg = r.slice(i, i + 16);
    if (seg[6] === null || seg[6] === "") continue; // account total line, no transaction
    const date = parseDmy(seg[8]);
    const month = Number(seg[9]) || (date ? date.getUTCMonth() + 1 : 0);
    const year = date ? date.getUTCFullYear() : 0;
    if (!year || !month) continue;
    const optionalValue = str(seg[11]);
    out.push({
      year,
      month,
      period: periodOf(year, month),
      accountCode: String(seg[0]),
      accountName: str(seg[1]) ?? "",
      postingDate: date,
      budgetCode: optionalValue && /^BG\d+/i.test(optionalValue) ? optionalValue.toUpperCase() : null,
      debit: num(seg[14]),
      credit: num(seg[15]),
    });
  }
  if (!out.length) throw new Error("ไม่พบรายการ GL ในไฟล์ (ต้องเป็นรายงาน GLTDOPT)");
  return { kind: "gl", periods: [...new Set(out.map((t) => t.period))], rows: out };
}

// ── BG_YEAR (annual budget register) ─────────────────────────

const REV_MONTH_COLS = ["Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const EXP_MONTH_COLS = REV_MONTH_COLS.map((c) => `${c}_1`);

export function parseBudgetYear(buffer: Buffer, filename: string): DatasetBatch {
  const rows = sheetRows(buffer, "งบประมาณ");
  const fileYear = Number(filename.match(/BG_YEAR_(20\d{2})/i)?.[1]) || 0;
  const out: BudgetLine[] = [];
  for (const r of rows) {
    const budgetCode = str(r["รหัสงบประมาณ"]);
    if (!budgetCode) continue;
    const year = Number(r["Year"]) || fileYear;
    const budgetType = str(r["ประเภทงบประมาณ"]);
    out.push({
      year,
      budgetCode: budgetCode.toUpperCase(),
      name: str(r["ชื่อโครงการหรือชื่องบประมาณ"]) ?? budgetCode,
      department: str(r["หน่วยงาน"]),
      profitCenter: str(r["Profit Center"]),
      budgetGroup: str(r["กลุ่มงบประมาณ"]),
      budgetType,
      revenueType: str(r["ประเภทรายได้ทางบัญชี"]),
      expenseType: str(r["ประเภทค่าใช้จ่ายทางบัญชี"]),
      activity: str(r["กิจกรรม/ประเภทโครงการ"]),
      courseCode: str(r["Course (Code)ชื่อย่อ"]),
      className: str(r["Class"]),
      seat: r["Seat"] === null ? null : num(r["Seat"]),
      status: str(r["สถานะโครงการ"]) ?? (str(r["ยกเลิกเอกสารโดย"]) ? "ยกเลิก" : null),
      isCapital: budgetType === "งบลงทุน" || str(r["รายการ_1"]) === "งบลงทุน",
      revenueMonthly: REV_MONTH_COLS.map((c) => num(r[c])),
      expenseMonthly: EXP_MONTH_COLS.map((c) => num(r[c])),
      startDate: parseDmy(r["วันที่เริ่มต้นโครงการ"]),
      endDate: parseDmy(r["วันที่สิ้นสุดโครงการ"]),
    });
  }
  if (!out.length) throw new Error("ไม่พบรายการงบประมาณ (คอลัมน์ รหัสงบประมาณ)");
  // The register can carry the previous year's lines too — keep every year.
  return { kind: "budgetLines", years: [...new Set(out.map((l) => l.year))].sort(), rows: out };
}

// ── BG_Capital (budget vs actual per project) ────────────────

export function parseBudgetProgress(buffer: Buffer, filename: string): DatasetBatch {
  const rows = sheetRows(buffer);
  const asOf = periodFromFilename(filename) ?? new Date().toISOString().slice(0, 7);
  const out: BudgetProgress[] = [];
  for (const r of rows) {
    const budgetCode = str(r["รหัสงบประมาณ"]);
    if (!budgetCode) continue;
    out.push({
      budgetCode: budgetCode.toUpperCase(),
      name: str(r["ชื่อโครงการ"]) ?? budgetCode,
      department: str(r["หน่วยงาน"]),
      profitCenter: str(r["Profit Center"]),
      courseCode: str(r["Course"]),
      className: str(r["Class"]),
      seat: r["Seat"] === null || r["Seat"] === undefined ? null : num(r["Seat"]),
      revenuePlan: num(r["รายได้ตามงบประมาณ(Revenue Plan)"]),
      budgetCost: num(r["ค่าใช้จ่ายตามงบประมาณ(Budget Cost)"]),
      expenseUsed: num(r["ค่าใช้จ่ายตามงบประมาณใช้ไป(Expense Cost)"]),
      balanceCost: num(r["ค่าใช้จ่ายตามงบประมาณคงเหลือ(Balance Cost)"]),
      expenseActual: num(r["ค่าใช้จ่ายที่เกิดขึ้นจริง(Expense Actual)"]),
      startDate: parseDmy(r["วันที่เริ่มต้นโครงการ"]),
      endDate: parseDmy(r["วันที่สิ้นสุดโครงการ"]),
      asOf,
    });
  }
  if (!out.length) throw new Error("ไม่พบรายการโครงการ (คอลัมน์ รหัสงบประมาณ)");
  return { kind: "budgetProgress", rows: out };
}

// ── Masters ──────────────────────────────────────────────────

export function parseAccountMap(buffer: Buffer): DatasetBatch {
  const rows = sheetRows(buffer);
  const seen = new Set<string>();
  const out: AccountMap[] = [];
  for (const r of rows) {
    const accountCode = str(r["Account Code"]);
    const courseCode = str(r["Course (Code)ชื่อย่อ"]);
    if (!accountCode || !courseCode || seen.has(`${accountCode}|${courseCode}`)) continue;
    seen.add(`${accountCode}|${courseCode}`);
    out.push({
      accountCode,
      courseCode,
      grouping: str(r["Grouping"]) ?? "OTHER",
      trainingName: str(r["Training Name"]) ?? courseCode,
    });
  }
  if (!out.length) throw new Error("ไม่พบคอลัมน์ Account Code / Course (Code)ชื่อย่อ");
  return { kind: "accountMap", rows: out };
}

export function parsePnlLines(buffer: Buffer): DatasetBatch {
  const rows = sheetRows(buffer);
  const out: PnlLine[] = rows
    .filter((r) => r["sort_level1"] !== null && r["sort_level1"] !== undefined)
    .map((r) => ({
      sort1: num(r["sort_level1"]),
      sort2: r["sort_level2"] === null ? null : num(r["sort_level2"]),
      sort3: r["sort_level3"] === null ? null : num(r["sort_level3"]),
      level1: str(r["level1"]),
      level2: str(r["level2"]),
      level3: str(r["level3"]),
      key: str(r["desc"]),
    }));
  if (!out.length) throw new Error("ไม่พบคอลัมน์ level1 / sort_level1");
  return { kind: "pnlLines", rows: out };
}

export function parseDepartments(buffer: Buffer): DatasetBatch {
  const rows = sheetRows(buffer, "Dept_Master");
  const out: Department[] = rows
    .filter((r) => str(r["dept_code"]) && str(r["department_name"]))
    .map((r) => ({
      code: str(r["dept_code"])!,
      name: str(r["department_name"])!,
      sort: num(r["sort"]),
      mergedInto: str(r["merged_into_code"]),
    }));
  if (!out.length) throw new Error("ไม่พบคอลัมน์ dept_code / department_name");
  return { kind: "departments", rows: out };
}

export function parseMemberStats(buffer: Buffer): DatasetBatch {
  const rows = sheetRows(buffer);
  const out: MemberStat[] = [];
  for (const r of rows) {
    const memberType = str(r["Member Type"]);
    const month = monthIndex(r["Month"]);
    const year = Number(r["Year"]);
    if (!memberType || !month || !year || r["Member"] === null) continue;
    out.push({ memberType, year, month, value: num(r["Member"]) });
  }
  if (!out.length) throw new Error("ไม่พบข้อมูลสมาชิก (Member Type / Member / Month / Year)");
  return { kind: "memberStats", rows: out };
}

// ── Activity CSV (Event / Member / Sponsor) ──────────────────

const THAI_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Receipt dates look like "11-พ.ค.-26" (2-digit CE year) or "11-พ.ค.-69" (BE). */
function parseThaiShortDate(v: unknown): { year: number; month: number } | null {
  const m = String(v ?? "").trim().match(/^\d{1,2}-(.+?)-(\d{2,4})$/);
  if (!m) return null;
  const month = THAI_MONTH_ABBR.indexOf(m[1]) + 1 || monthIndex(m[1]);
  let year = Number(m[2]);
  if (year < 100) year = year >= 50 ? year + 2500 - 543 : year + 2000;
  else if (year > 2400) year -= 543;
  return month ? { year, month } : null;
}

const hashKey = (s: string) => createHash("sha1").update(s.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

/**
 * Registration exports contain attendee names — aggregate per event
 * immediately and keep counts only (Blueprint Main 5.4):
 * - event:   participants = distinct first+last name per event (regi_Name)
 * - member:  renew (Annual Fee) / new (Annual New) counts per month and member type
 * - sponsor: rows with a receipt number (Textbox40); month from the receipt date,
 *            prior-year receipts count in January, next-year receipts in December
 */
export function parseActivities(buffer: Buffer, source: ActivitySource, filename = ""): DatasetBatch {
  const rows = Papa.parse<Row>(decodeText(buffer), { header: true, skipEmptyLines: true }).data;
  const fileYear = Number(periodFromFilename(filename)?.slice(0, 4)) || 0;
  const groups = new Map<string, Omit<ActivityStat, "participants" | "companies" | "companyKeys"> & {
    people: Set<string>;
    companySet: Set<string>;
  }>();

  for (const r of rows) {
    const program = str(r["semi_Name"]);
    const eventName = str(r["regi_Name"]) ?? program;
    if (!program || !eventName) continue;

    let year = Number(String(r["regi_startdate"] ?? "").match(/(20\d{2})/)?.[1]);
    let month = monthIndex(r["months"]);
    if (source === "sponsor") {
      if (!str(r["Textbox40"])) continue; // no receipt yet
      const receipt = parseThaiShortDate(r["Textbox34"]);
      if (receipt) {
        const target = fileYear || receipt.year;
        ({ year, month } = receipt.year < target ? { year: target, month: 1 } : receipt.year > target ? { year: target, month: 12 } : receipt);
      }
    }
    if (!month || !year) continue;

    const period = periodOf(year, month);
    const memberType = source === "member" ? (str(r["MemberType"]) ?? "ไม่ระบุ") : null;
    const key = `${period}|${eventName}|${memberType ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        source,
        period,
        department: str(r["department"]),
        program,
        eventName,
        memberType,
        registrations: 0,
        attended: 0,
        amount: 0,
        newMembers: 0,
        renewMembers: 0,
        people: new Set(),
        companySet: new Set(),
      };
      groups.set(key, g);
    }
    g.registrations++;
    if (str(r["AttendeeStatus"]) === "Attended") g.attended++;
    const person = `${str(r["pers_firstnameinthai"]) ?? ""} ${str(r["pers_surnameinthai"]) ?? ""}`.trim();
    if (person) g.people.add(hashKey(person));
    const company = str(r["Comp_Name"]);
    if (company) g.companySet.add(hashKey(company));
    g.amount += num(r["atte_payment"]);
    if (source === "member") {
      if (/annual new/i.test(program)) g.newMembers++;
      else if (/annual fee/i.test(program)) g.renewMembers++;
    }
  }

  const out: ActivityStat[] = [...groups.values()].map(({ people, companySet, ...g }) => ({
    ...g,
    participants: people.size,
    companies: companySet.size,
    companyKeys: [...companySet],
  }));
  if (!out.length) throw new Error("ไม่พบข้อมูลกิจกรรม (semi_Name / regi_Name / months)");
  return { kind: "activities", source, periods: [...new Set(out.map((a) => a.period))], rows: out };
}

// ── dispatcher ───────────────────────────────────────────────

export function parseSlotFile(slot: string, buffer: Buffer, filename: string): DatasetBatch {
  switch (slot) {
    case "actual":
      return parseActual(buffer);
    case "bg_year":
      return parseBudgetYear(buffer, filename);
    case "bg_capital":
      return parseBudgetProgress(buffer, filename);
    case "master":
      return parseAccountMap(buffer);
    case "master_revenue":
      return parsePnlLines(buffer);
    case "dept_master":
      return parseDepartments(buffer);
    case "template_member":
      return parseMemberStats(buffer);
    case "event":
    case "member":
    case "sponsor":
      return parseActivities(buffer, slot, filename);
    default:
      throw new Error(`ไม่รองรับไฟล์ประเภท ${slot}`);
  }
}

export function batchSize(batch: DatasetBatch) {
  return batch.rows.length;
}
