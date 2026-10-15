import { NextResponse } from "next/server";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { GUIDE_SECTIONS } from "@/lib/sections";
import { evaluateAlerts } from "@/server/dashboard/alerts";
import { dataScope, loadContext, resolveFilters, thaiMonthYear } from "@/server/dashboard/service";
import { allowedDepartments, route, requireFeature } from "@/server/http";
import { buildInsights, pickInsightOfDay, summarizeGroups } from "@/server/insights";
import { getRepo } from "@/server/repository";

/** Home page data (MOM H1–H4). */
export const GET = route(async () => {
  const user = await requireFeature();
  const repo = await getRepo();
  const ctx = await loadContext();
  const flt = resolveFilters(ctx, {}, allowedDepartments(user));
  const [thresholds, issues, ratings, usage] = await Promise.all([
    repo.thresholds.list(),
    repo.issues.list(),
    repo.ratings.list(user.id),
    repo.usage.list(),
  ]);
  // Only what the user may see: no insight data without insights.view.
  const insights = ctx.facts.length && user.can("insights.view")
    ? buildInsights(ctx, flt, evaluateAlerts(ctx, flt, thresholds), issues, thaiMonthYear(flt.year, flt.month))
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const pick = pickInsightOfDay(insights, ratings, today);
  const myRating = pick ? (ratings.find((r) => r.insightKey === pick.id)?.rating ?? 0) : 0;

  const visited = new Set(usage.filter((u) => u.userId === user.id).map((u) => u.section));
  const myOpen = user.can("issues.view")
    ? issues.filter((i) => i.ownerId === user.id && (i.status === "open" || i.status === "in_progress"))
    : [];

  return NextResponse.json({
    user: { name: user.name, jobTitle: user.jobTitle, tier: user.tier },
    scope: dataScope(ctx),
    guide: {
      sections: GUIDE_SECTIONS.map((key) => ({ key, visited: visited.has(key) })),
      visitedCount: GUIDE_SECTIONS.filter((k) => visited.has(k)).length,
      total: GUIDE_SECTIONS.length,
    },
    insightOfDay: pick ? { ...pick, myRating } : null,
    groups: summarizeGroups(insights),
    myOpenFollowUps: myOpen.length,
    updates: RELEASE_NOTES,
  });
});
