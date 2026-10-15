import type { Category, FinancialRecord } from "@/types/domain";
import { CATEGORIES } from "@/types/domain";
import { pctChange, quarterOf } from "./utils";

export interface Totals {
  revenue: number;
  expense: number;
  budget: number;
  noi: number;
}

export interface PeriodTotals extends Totals {
  period: string;
}

export interface CategoryTotals extends Totals {
  category: Category;
  variancePct: number;
}

export interface FinancialSummary {
  year: string | null;
  latestPeriod: string | null;
  ytd: Totals & { budgetVariancePct: number };
  latest: PeriodTotals | null;
  previous: PeriodTotals | null;
  mom: { revenue: number; expense: number; noi: number };
  monthly: PeriodTotals[];
  quarterly: PeriodTotals[];
  byCategory: CategoryTotals[];
  forecast: Totals & { monthsElapsed: number };
}

const empty = (): Totals => ({ revenue: 0, expense: 0, budget: 0, noi: 0 });

function add(t: Totals, r: FinancialRecord) {
  t[r.type] += r.amount;
  t.noi = t.revenue - t.expense;
}

function groupBy(records: FinancialRecord[], key: (r: FinancialRecord) => string) {
  const map = new Map<string, Totals>();
  for (const r of records) {
    const k = key(r);
    if (!map.has(k)) map.set(k, empty());
    add(map.get(k)!, r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, t]) => ({ period, ...t }));
}

/** Aggregates monthly records of the latest year into dashboard KPIs. */
export function summarize(all: FinancialRecord[]): FinancialSummary {
  const monthlyRecords = all.filter((r) => r.periodType === "monthly");
  // "Elapsed" months are those with actuals; a budget uploaded ahead of time
  // must not move the latest month forward.
  const actualPeriods = new Set(monthlyRecords.filter((r) => r.type !== "budget").map((r) => r.period));
  const year = [...actualPeriods].map((p) => p.slice(0, 4)).sort().at(-1) ?? null;
  const yearRecords = monthlyRecords.filter((r) => year && r.period.startsWith(year));
  const records = yearRecords.filter((r) => actualPeriods.has(r.period));

  const monthly = groupBy(records, (r) => r.period);
  const quarterly = groupBy(records, (r) => quarterOf(r.period));

  const ytd = empty();
  records.forEach((r) => add(ytd, r));
  const budgetVariancePct = pctChange(ytd.expense, ytd.budget);

  const byCategory = CATEGORIES.map((category) => {
    const t = empty();
    records.filter((r) => r.category === category).forEach((r) => add(t, r));
    return { category, ...t, variancePct: pctChange(t.expense, t.budget) };
  });

  const latest = monthly.at(-1) ?? null;
  const previous = monthly.at(-2) ?? null;
  const mom = {
    revenue: latest && previous ? pctChange(latest.revenue, previous.revenue) : 0,
    expense: latest && previous ? pctChange(latest.expense, previous.expense) : 0,
    noi: latest && previous ? pctChange(latest.noi, previous.noi) : 0,
  };

  // Year-end forecast = YTD ÷ months elapsed × 12
  const monthsElapsed = monthly.length;
  const factor = monthsElapsed ? 12 / monthsElapsed : 0;
  // Full-year budget: every budgeted month of the year, extrapolated if some months are missing.
  const budgetRows = yearRecords.filter((r) => r.type === "budget");
  const budgetMonths = new Set(budgetRows.map((r) => r.period)).size;
  const budgetTotal = budgetRows.reduce((s, r) => s + r.amount, 0);
  const forecast = {
    revenue: ytd.revenue * factor,
    expense: ytd.expense * factor,
    budget: budgetMonths ? (budgetTotal / budgetMonths) * 12 : 0,
    noi: ytd.noi * factor,
    monthsElapsed,
  };

  return {
    year,
    latestPeriod: latest?.period ?? null,
    ytd: { ...ytd, budgetVariancePct },
    latest,
    previous,
    mom,
    monthly,
    quarterly,
    byCategory,
    forecast,
  };
}

/** Full-year revenue per category, used as the scenario-planning baseline. */
export function forecastByCategory(summary: FinancialSummary) {
  const factor = summary.forecast.monthsElapsed ? 12 / summary.forecast.monthsElapsed : 0;
  return Object.fromEntries(
    summary.byCategory.map((c) => [c.category, c.revenue * factor]),
  ) as Record<Category, number>;
}
