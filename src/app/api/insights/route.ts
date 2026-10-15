import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/server/dashboard/alerts";
import { dataScope, loadContext, resolveFilters, thaiMonthYear } from "@/server/dashboard/service";
import { allowedDepartments, route, requireFeature } from "@/server/http";
import { INSIGHT_RULES, buildInsights, summarizeGroups } from "@/server/insights";
import { getRepo } from "@/server/repository";
import { ratingWeight } from "@/lib/rating-reasons";

/** GET /api/insights?period=&dept= — signals for the user's departments (MOM I1–I6). */
export const GET = route(async (req) => {
  const user = await requireFeature("insights.view");
  const params = new URL(req.url).searchParams;
  const ctx = await loadContext();
  const flt = resolveFilters(ctx, { period: params.get("period"), dept: params.get("dept") }, allowedDepartments(user));
  const repo = await getRepo();
  const [thresholds, issues, ratings] = await Promise.all([repo.thresholds.list(), repo.issues.list(), repo.ratings.list(user.id)]);
  const insights = buildInsights(ctx, flt, evaluateAlerts(ctx, flt, thresholds), issues, thaiMonthYear(flt.year, flt.month));
  const scope = dataScope(ctx);
  return NextResponse.json({
    filters: flt,
    scope: scope && {
      ...scope,
      label: `${thaiMonthYear(flt.year, scope.fromMonth)} – ${thaiMonthYear(flt.year, flt.month)}`,
    },
    rules: INSIGHT_RULES,
    groups: summarizeGroups(insights),
    insights,
    /** This user's like (1) / dislike (-1) per insight id, shown on each card. */
    myRatings: Object.fromEntries(ratings.map((r) => [r.insightKey, r.rating])),
    /** Sum of this user's ratings per kind of insight: liked kinds float up, disliked kinds sink. */
    kindPrefs: ratings.reduce<Record<string, number>>((m, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + ratingWeight(r) }), {}),
  });
});
