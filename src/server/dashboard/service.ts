import "server-only";
import { getRepo } from "@/server/repository";
import { type DashboardContext, type Filters, buildContext } from "./context";

/*
 * The dashboard context (≈9,000 GL rows joined with budget, accounts, P&L…) is
 * rebuilt only when the data changes. Uploads replace the dataset arrays, so
 * comparing the array references tells whether the cached build is still valid.
 */
const ctxCache = globalThis as unknown as { __iodContext?: { key: unknown[]; ctx: DashboardContext } };

export async function loadContext(): Promise<DashboardContext> {
  const snap = await (await getRepo()).dataset.snapshot();
  const key = [snap.gl, snap.budgetLines, snap.budgetProgress, snap.accountMap, snap.pnlLines, snap.departments, snap.memberStats, snap.activities];
  const hit = ctxCache.__iodContext;
  if (hit && hit.key.length === key.length && hit.key.every((k, i) => k === key[i])) return hit.ctx;
  const ctx = buildContext(snap);
  ctxCache.__iodContext = { key, ctx };
  return ctx;
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thaiMonthYear = (year: number, month: number) => `${THAI_MONTHS[month - 1]} ${year + 543}`;

function latestActual(ctx: DashboardContext) {
  return [...ctx.actualMonths.entries()]
    .flatMap(([year, months]) => months.map((month) => ({ year, month })))
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
}

/**
 * Selectable periods = months with GL actuals, newest first (MOM D2).
 * Departments are A–Z and limited to what the user may see (MOM A5, D3).
 */
export function dashboardMeta(ctx: DashboardContext, allowed: string[] | null) {
  const periods = [...ctx.actualMonths.entries()]
    .flatMap(([year, months]) => months.map((month) => ({ year, month })))
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .map(({ year, month }) => ({ value: `${year}-${String(month).padStart(2, "0")}`, label: thaiMonthYear(year, month) }));
  const s = ctx.snapshot;
  const departments = ctx.departments
    .filter((d) => !allowed || allowed.includes(d))
    .sort((a, b) => a.localeCompare(b, "en"));
  const profitCenters = [...new Set(ctx.facts.map((f) => f.profitCenter))].sort((a, b) => a.localeCompare(b, "en"));
  return {
    periods,
    departments,
    profitCenters,
    restricted: !!allowed,
    budgetYears: [...new Set(s.budgetLines.map((l) => l.year))].sort(),
    hasData: s.gl.length > 0 || s.budgetLines.length > 0,
    scope: dataScope(ctx),
    sources: {
      actual: s.gl.length,
      budget: s.budgetLines.length,
      capital: s.budgetProgress.length,
      pnl: s.pnlLines.length,
      accounts: s.accountMap.length,
      departments: s.departments.length,
      members: s.memberStats.length,
      activities: s.activities.length,
    },
  };
}

/** "From when to when" the data covers (MOM I1). */
export function dataScope(ctx: DashboardContext) {
  const latest = latestActual(ctx);
  if (!latest) return null;
  const months = ctx.actualMonths.get(latest.year) ?? [];
  const fromMonth = months[0] ?? latest.month;

  // Actual first/last posting dates in the GL (per-day precision), kept inside the
  // covered months so a stray mis-dated row can't stretch the range.
  const lo = Date.UTC(latest.year, fromMonth - 1, 1);
  const hi = Date.UTC(latest.year, latest.month, 1) - 1;
  let first: number | null = null;
  let last: number | null = null;
  for (const g of ctx.snapshot.gl) {
    const t = g.postingDate ? new Date(g.postingDate).getTime() : NaN;
    if (g.year !== latest.year || !(t >= lo && t <= hi)) continue;
    if (first === null || t < first) first = t;
    if (last === null || t > last) last = t;
  }
  const fromDate = new Date(first ?? lo);
  const toDate = new Date(last ?? hi);

  return {
    year: latest.year,
    fromMonth,
    toMonth: latest.month,
    label: `${thaiMonthYear(latest.year, fromMonth)} – ${thaiMonthYear(latest.year, latest.month)}`,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    /** e.g. "2 ม.ค. 2569 – 31 ส.ค. 2569" */
    dateLabel: `${thaiDate(fromDate)} – ${thaiDate(toDate)}`,
  };
}

const thaiDate = (d: Date) => `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;

/**
 * Resolve ?period=YYYY-MM&dept=A,B&pc=… against what the data supports and what
 * the user is allowed to see. A restricted user always gets their departments.
 */
export function resolveFilters(
  ctx: DashboardContext,
  query: { period?: string | null; dept?: string | null; pc?: string | null },
  allowed: string[] | null,
): Filters {
  const latest = latestActual(ctx);
  const m = query.period?.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  const year = m ? +m[1] : (latest?.year ?? ctx.years.at(-1) ?? new Date().getFullYear());
  const month = m ? +m[2] : (latest?.month ?? 12);

  const requested = (query.dept ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d && ctx.departments.includes(d));
  let departments = allowed ? requested.filter((d) => allowed.includes(d)) : requested;
  if (allowed && departments.length === 0) departments = allowed;

  const profitCenter = query.pc && ctx.facts.some((f) => f.profitCenter === query.pc) ? query.pc : undefined;
  return { year, month, departments, profitCenter };
}
