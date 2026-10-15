import "server-only";
import { ALERT_DEFS, type AlertDef, DASHBOARD_PAGES, type DashboardPage } from "@/lib/alert-defs";
import type { AlertThreshold } from "@/types/domain";
import { type DashboardContext, type Filters, pct } from "./context";
import { capitalPage, expenditurePage, kpiPage, membershipPage, pnlPage, trainingPage } from "./pages";

export interface AlertResult extends AlertDef {
  dashboard: DashboardPage;
  dashboardLabel: string;
  href: string;
  value: number;
  isActive: boolean;
  breached: boolean;
}

const gap = (actual: number, plan: number) => (plan ? pct(actual - plan, plan) : 0);

/** Current value of each alert metric for one dashboard page. */
/** null = not meaningful for the current filter (e.g. EBITDA % for a department without revenue). */
function metricValues(ctx: DashboardContext, flt: Filters, dashboard: DashboardPage): Record<string, number | null> {
  switch (dashboard) {
    case "kpi": {
      const d = kpiPage(ctx, flt);
      return {
        revenue_vs_plan: gap(d.revenue.actual, d.revenue.plan),
        expense_vs_budget: gap(d.expense.actual, d.expense.plan),
        ebitda_pct: d.revenue.actual ? d.ebitda.actualPct : null,
      };
    }
    case "training": {
      const d = trainingPage(ctx, flt);
      return { revenue_vs_plan: gap(d.revenue.actual, d.revenue.plan), expense_vs_budget: gap(d.expense.actual, d.expense.plan) };
    }
    case "expenditure": {
      const d = expenditurePage(ctx, flt);
      const worst = Math.max(0, ...d.overview.filter((r) => r.budget > 0).map((r) => r.usedPct - 100));
      return { expense_vs_budget: gap(d.expense.actual, d.expense.plan), max_dept_over: worst };
    }
    case "membership": {
      const d = membershipPage(ctx, flt);
      return {
        membership_vs_plan: gap(d.membership.actual, d.membership.plan),
        sponsorship_vs_plan: gap(d.sponsorship.actual, d.sponsorship.plan),
        seminar_vs_plan: gap(d.seminar.actual, d.seminar.plan),
      };
    }
    case "pnl": {
      const d = pnlPage(ctx, flt);
      const noi = d.rows.find((r) => r.label === "Net Operating Income")?.values;
      return { noi_vs_plan: noi ? gap(noi.actualYtd, noi.budgetYtd) : 0 };
    }
    case "capital": {
      const d = capitalPage(ctx, flt);
      return { capex_usage: d.outlay.achievePct };
    }
  }
}

export function evaluateAlerts(
  ctx: DashboardContext,
  flt: Filters,
  thresholds: AlertThreshold[],
  only?: DashboardPage,
): AlertResult[] {
  const pages = (only ? [only] : Object.keys(ALERT_DEFS)) as DashboardPage[];
  return pages.flatMap((dashboard) => {
    const values = metricValues(ctx, flt, dashboard);
    return ALERT_DEFS[dashboard].map((def) => {
      const t = thresholds.find((x) => x.dashboard === dashboard && x.metric === def.metric);
      const threshold = t?.threshold ?? def.threshold;
      const operator = t?.operator ?? def.operator;
      const isActive = t?.isActive ?? true;
      const raw = values[def.metric] ?? null;
      const value = raw ?? 0;
      return {
        ...def,
        threshold,
        operator,
        dashboard,
        dashboardLabel: DASHBOARD_PAGES[dashboard].label,
        href: `${DASHBOARD_PAGES[dashboard].href}?focus=${def.focus}`,
        value,
        isActive,
        breached: isActive && raw !== null && (operator === "gt" ? value > threshold : value < threshold),
      };
    });
  });
}
