import { NextResponse } from "next/server";
import type { DashboardPage } from "@/lib/alert-defs";
import { evaluateAlerts } from "@/server/dashboard/alerts";
import { type Fact, is, scoped, ytd } from "@/server/dashboard/context";
import {
  capitalPage,
  expenditurePage,
  kpiPage,
  membershipPage,
  pnlPage,
  trainingPage,
} from "@/server/dashboard/pages";
import { dashboardMeta, loadContext, resolveFilters } from "@/server/dashboard/service";
import { HttpError, allowedDepartments, route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";

const PAGES = {
  kpi: kpiPage,
  training: trainingPage,
  expenditure: expenditurePage,
  membership: membershipPage,
  pnl: pnlPage,
  capital: capitalPage,
};

/**
 * GET /api/dashboard/{page}?period=YYYY-MM&dept=A,B&pc=…
 *   page = meta | kpi | training | expenditure | membership | pnl | capital | drill
 * Department access (MOM A5) is enforced here for every page.
 */
export const GET = route<RouteContext<"/api/dashboard/[page]">>(async (req, ctx) => {
  const user = await requireFeature("dashboard.view");
  const allowed = allowedDepartments(user);
  const { page } = await ctx.params;
  // P&L carries the year-end projection / outlook (forecast).
  if (page === "pnl" && !user.can("forecast.view")) {
    throw new HttpError(403, "ระดับสิทธิ์ของคุณยังดูคาดการณ์สิ้นปี (P&L) ไม่ได้ ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์");
  }
  const data = await loadContext();
  if (page === "meta") return NextResponse.json(dashboardMeta(data, allowed));

  const params = new URL(req.url).searchParams;
  const filters = resolveFilters(data, { period: params.get("period"), dept: params.get("dept"), pc: params.get("pc") }, allowed);

  if (page === "drill") return NextResponse.json(drill(data, filters, params.get("metric")));

  const compute = PAGES[page as keyof typeof PAGES];
  if (!compute) throw new HttpError(404, "ไม่พบหน้ารายงาน");
  const thresholds = await (await getRepo()).thresholds.list(page);
  const alerts = evaluateAlerts(data, filters, thresholds, page as DashboardPage);
  return NextResponse.json({ filters, data: compute(data, filters), alerts });
});

/** Drill-down behind an "Actual" figure (MOM D7): where the number comes from. */
function drill(ctx: Awaited<ReturnType<typeof loadContext>>, flt: ReturnType<typeof resolveFilters>, metric: string | null) {
  const kind = metric === "expense" ? "expense" : "revenue";
  const facts = scoped(ctx, flt).filter((f) => is.actual(f) && f.kind === kind && ytd(flt)(f));
  const total = facts.reduce((s, f) => s + f.amount, 0);
  const top = (key: (f: Fact) => string, n = 10) => {
    const m = new Map<string, number>();
    for (const f of facts) m.set(key(f), (m.get(key(f)) ?? 0) + f.amount);
    return [...m.entries()]
      .map(([name, value]) => ({ name, value, share: total ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  };
  return {
    metric: kind,
    filters: flt,
    total,
    byDepartment: top((f) => f.department),
    byProfitCenter: top((f) => f.profitCenter),
    byProject: top((f) => f.budgetName, 15),
    byMonth: top((f) => String(f.month), 12).sort((a, b) => Number(a.name) - Number(b.name)),
  };
}
