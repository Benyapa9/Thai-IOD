import "server-only";
import type { BudgetLine, DatasetSnapshot, PnlLine } from "@/types/dataset";

/** Normalised lookup key: case/spacing/punctuation-insensitive ("Salaries and Benefits-IDL"). */
export const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");

export type Scenario = "actual" | "budget";
export type Kind = "revenue" | "expense";

/** One amount on one month, with every dimension the dashboard slices by. */
export interface Fact {
  scenario: Scenario;
  kind: Kind;
  year: number;
  month: number;
  amount: number;
  budgetCode: string | null;
  budgetName: string;
  department: string;
  profitCenter: string;
  pnlKey: string; // normalised PnlLine.key, or "" when unmapped
  courseCode: string | null;
  className: string | null;
  grouping: string;
  accountCode: string | null;
  activity: string; // กิจกรรม/ประเภทโครงการ
  isCapital: boolean; // ประเภทงบประมาณ = งบลงทุน
  isSpecial: boolean; // ประเภทงบประมาณ = งบโครงการพิเศษ (Special Project)
}

export interface Filters {
  year: number;
  month: number; // YTD cut-off (1–12)
  /** Selected departments (multi-select, MOM D3); empty = all the user may see. */
  departments: string[];
  /** Cross-filter from clicking a profit center on a chart (MOM D6). */
  profitCenter?: string;
}

export const inDepartments = (flt: Pick<Filters, "departments">, department: string) =>
  flt.departments.length === 0 || flt.departments.includes(department);

const INACTIVE_STATUS = new Set(["ยกเลิก", "ปิดการใช้งาน"]);
export const UNASSIGNED = "ไม่ระบุ";

/** Blueprint: กิจกรรม/ประเภทโครงการ = Training(Public), Training(InHouse) (source spells "Traning"). */
const TRAINING_ACTIVITY = new Set(["trainingpublic", "traninginhouse", "traininginhouse"]);
export const isTrainingActivity = (activity: string | null | undefined) => TRAINING_ACTIVITY.has(norm(activity));

export interface DashboardContext {
  facts: Fact[];
  snapshot: DatasetSnapshot;
  lines: Map<string, BudgetLine>;
  pnl: PnlLine[];
  pnlByKey: Map<string, PnlLine>;
  /** Months (per year) that have GL actuals. */
  actualMonths: Map<number, number[]>;
  years: number[];
  departments: string[];
  canonicalDepartment: (name: string | null) => string;
  groupingOf: (accountCode: string | null, courseCode: string | null) => string;
}

export function buildContext(snapshot: DatasetSnapshot): DashboardContext {
  const lines = new Map(snapshot.budgetLines.map((l) => [l.budgetCode, l]));

  // Department master: map old/variant names to the latest department name.
  const deptByCode = new Map(snapshot.departments.map((d) => [d.code, d]));
  const deptCache = new Map<string, string>();
  const canonicalDepartment = (name: string | null) => {
    if (!name) return UNASSIGNED;
    const cached = deptCache.get(name);
    if (cached) return cached;
    const n = norm(name);
    let match = snapshot.departments.find((d) => norm(d.name) === n);
    match ??= snapshot.departments.find((d) => n.startsWith(norm(d.name)) || norm(d.name).startsWith(n));
    while (match?.mergedInto && deptByCode.has(match.mergedInto)) match = deptByCode.get(match.mergedInto);
    const result = match?.name ?? name;
    deptCache.set(name, result);
    return result;
  };

  const groupByAccount = new Map(snapshot.accountMap.map((a) => [a.accountCode, a.grouping]));
  const groupByCourse = new Map(snapshot.accountMap.map((a) => [norm(a.courseCode), a.grouping]));
  const groupingOf = (accountCode: string | null, courseCode: string | null) =>
    (accountCode && groupByAccount.get(accountCode)) ||
    (courseCode && groupByCourse.get(norm(courseCode))) ||
    "OTHER";

  const pnl = [...snapshot.pnlLines].sort(
    (a, b) => a.sort1 - b.sort1 || (a.sort2 ?? 0) - (b.sort2 ?? 0) || (a.sort3 ?? 0) - (b.sort3 ?? 0),
  );
  const pnlByKey = new Map(pnl.filter((p) => p.key).map((p) => [norm(p.key), p]));

  /** Accounting type on the budget line → P&L leaf key. */
  const pnlKeyOf = (kind: Kind, line: BudgetLine | undefined, accountCode: string | null) => {
    if (!line) return "";
    let key = norm(kind === "revenue" ? line.revenueType : line.expenseType);
    if (kind === "expense") {
      if (key === "taxanddepreciation") key = accountCode?.startsWith("61") ? "depreciationamortization" : "tax";
      if (key === "passthroughsponsorship") key = "passthroughcost";
    }
    return pnlByKey.has(key) ? key : "";
  };

  const facts: Fact[] = [];
  const dims = (line: BudgetLine | undefined, accountCode: string | null, kind: Kind) => ({
    budgetCode: line?.budgetCode ?? null,
    budgetName: line?.name ?? UNASSIGNED,
    department: canonicalDepartment(line?.department ?? null),
    profitCenter: line?.profitCenter ?? UNASSIGNED,
    pnlKey: pnlKeyOf(kind, line, accountCode),
    courseCode: line?.courseCode ?? null,
    className: line?.className ?? null,
    grouping: groupingOf(accountCode, line?.courseCode ?? null),
    accountCode,
    activity: line?.activity ?? UNASSIGNED,
    isCapital: !!line?.isCapital,
    isSpecial: /พิเศษ|special/i.test(line?.budgetType ?? ""),
  });

  // Actuals: revenue accounts 4xxxx (credit − debit), expense accounts 5xxxx/6xxxx (debit − credit).
  const actualMonths = new Map<number, Set<number>>();
  for (const t of snapshot.gl) {
    const kind: Kind | null = t.accountCode.startsWith("4")
      ? "revenue"
      : /^[56]/.test(t.accountCode)
        ? "expense"
        : null;
    if (!kind) continue;
    const line = t.budgetCode ? lines.get(t.budgetCode) : undefined;
    facts.push({
      scenario: "actual",
      kind,
      year: t.year,
      month: t.month,
      amount: kind === "revenue" ? t.credit - t.debit : t.debit - t.credit,
      ...dims(line, t.accountCode, kind),
    });
    if (!actualMonths.has(t.year)) actualMonths.set(t.year, new Set());
    actualMonths.get(t.year)!.add(t.month);
  }

  // Budget: monthly revenue plan and expense budget (capital lines are flagged, pages exclude them).
  for (const line of snapshot.budgetLines) {
    if (line.status && INACTIVE_STATUS.has(line.status)) continue;
    for (let m = 1; m <= 12; m++) {
      const rev = line.revenueMonthly[m - 1] ?? 0;
      const exp = line.expenseMonthly[m - 1] ?? 0;
      if (rev) facts.push({ scenario: "budget", kind: "revenue", year: line.year, month: m, amount: rev, ...dims(line, null, "revenue") });
      if (exp)
        facts.push({ scenario: "budget", kind: "expense", year: line.year, month: m, amount: exp, ...dims(line, null, "expense") });
    }
  }

  const years = [...new Set([...actualMonths.keys(), ...snapshot.budgetLines.map((l) => l.year)])].sort();
  const departments = [...new Set(facts.map((f) => f.department))].sort((a, b) => {
    const sa = snapshot.departments.find((d) => d.name === a)?.sort ?? 999;
    const sb = snapshot.departments.find((d) => d.name === b)?.sort ?? 999;
    return sa - sb || a.localeCompare(b);
  });

  return {
    facts,
    snapshot,
    lines,
    pnl,
    pnlByKey,
    actualMonths: new Map([...actualMonths].map(([y, s]) => [y, [...s].sort((a, b) => a - b)])),
    years,
    departments,
    canonicalDepartment,
    groupingOf,
  };
}

// ── query helpers ────────────────────────────────────────────

type Pred = (f: Fact) => boolean;

export function sum(facts: Fact[], ...preds: Pred[]) {
  let s = 0;
  for (const f of facts) if (preds.every((p) => p(f))) s += f.amount;
  return s;
}

export const is = {
  actual: (f: Fact) => f.scenario === "actual",
  budget: (f: Fact) => f.scenario === "budget",
  revenue: (f: Fact) => f.kind === "revenue",
  expense: (f: Fact) => f.kind === "expense",
};

/**
 * Facts for the selected year and department (no month cut-off). Capital budgets
 * (งบลงทุน) are excluded everywhere except the CAPEX page.
 */
export function scoped(ctx: DashboardContext, flt: Filters, { includeCapital = false } = {}) {
  return ctx.facts.filter(
    (f) =>
      f.year === flt.year &&
      (includeCapital || !f.isCapital) &&
      inDepartments(flt, f.department) &&
      (!flt.profitCenter || f.profitCenter === flt.profitCenter),
  );
}

export const ytd = (flt: Filters) => (f: Fact) => f.month <= flt.month;
export const inMonth = (m: number) => (f: Fact) => f.month === m;

export function groupSum<K extends string>(
  facts: Fact[],
  key: (f: Fact) => K,
  pred: Pred = () => true,
) {
  const map = new Map<K, number>();
  for (const f of facts) {
    if (!pred(f)) continue;
    const k = key(f);
    map.set(k, (map.get(k) ?? 0) + f.amount);
  }
  return map;
}

export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

/**
 * Gauge / card block (Blueprint Main L001–L003). `plan` is the plan up to the
 * selected month (YTD); `planFull` is the whole year.
 * - balance  = plan − actual, shown as 0 when negative
 * - over     = actual − plan when the plan is exceeded (Over Plan / Over Budget bar)
 */
export function progress(actual: number, plan: number, planFull: number) {
  const balance = Math.max(plan - actual, 0);
  return {
    actual,
    plan,
    planFull,
    balance,
    achievePct: pct(actual, plan),
    balancePct: pct(balance, plan),
    over: Math.max(actual - plan, 0),
  };
}
export type Progress = ReturnType<typeof progress>;
