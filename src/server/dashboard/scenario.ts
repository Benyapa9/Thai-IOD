import "server-only";
import { type DashboardContext, type Fact, type Filters, is, norm, scoped, sum } from "./context";

export interface ScenarioLever {
  key: string;
  label: string;
  kind: "revenue" | "expense";
  /** Full-year outlook: actual year-to-date + budget for the remaining months. */
  value: number;
  actualYtd: number;
  budgetRest: number;
}

const EXPENSE_GROUPS: { key: string; label: string; match: (f: Fact, level1: string | null) => boolean }[] = [
  { key: "special", label: "งบโครงการพิเศษ (Special Project)", match: (f) => f.isSpecial },
  { key: "direct", label: "Direct Expenses", match: (f, l1) => !f.isSpecial && l1 === "Total Direct Expense" },
  { key: "admin", label: "Administrative Expenses", match: (f, l1) => !f.isSpecial && l1 === "Total Administrative Expenses" },
  { key: "other", label: "ค่าเสื่อมราคา ภาษี และอื่น ๆ", match: () => true },
];

/**
 * Scenario baseline (MOM S1/S4): revenue per profit center and expense per
 * P&L group, for the selected departments, projected to year end.
 */
export function scenarioBaseline(ctx: DashboardContext, flt: Filters): ScenarioLever[] {
  const facts = scoped(ctx, flt);
  const rest = (f: Fact) => f.month > flt.month;
  const done = (f: Fact) => f.month <= flt.month;
  const level1Of = (f: Fact) => ctx.pnlByKey.get(f.pnlKey)?.level1 ?? null;

  const levers: ScenarioLever[] = [];
  const pcs = [...new Set(facts.filter(is.revenue).map((f) => f.profitCenter))];
  for (const pc of pcs) {
    const f = facts.filter((x) => is.revenue(x) && x.profitCenter === pc);
    const actualYtd = sum(f, is.actual, done);
    const budgetRest = sum(f, is.budget, rest);
    if (Math.abs(actualYtd + budgetRest) < 1) continue;
    levers.push({ key: `rev:${norm(pc)}`, label: `รายได้ ${pc}`, kind: "revenue", value: actualYtd + budgetRest, actualYtd, budgetRest });
  }

  const expenses = facts.filter(is.expense);
  const assigned = new Set<Fact>();
  for (const g of EXPENSE_GROUPS) {
    const f = expenses.filter((x) => !assigned.has(x) && g.match(x, level1Of(x)));
    f.forEach((x) => assigned.add(x));
    const actualYtd = sum(f, is.actual, done);
    const budgetRest = sum(f, is.budget, rest);
    if (Math.abs(actualYtd + budgetRest) < 1) continue;
    levers.push({ key: `exp:${g.key}`, label: `ค่าใช้จ่าย ${g.label}`, kind: "expense", value: actualYtd + budgetRest, actualYtd, budgetRest });
  }
  return levers.sort((a, b) => (a.kind === b.kind ? b.value - a.value : a.kind === "revenue" ? -1 : 1));
}
