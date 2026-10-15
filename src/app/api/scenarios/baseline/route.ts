import { NextResponse } from "next/server";
import { scenarioBaseline } from "@/server/dashboard/scenario";
import { loadContext, resolveFilters, thaiMonthYear } from "@/server/dashboard/service";
import { allowedDepartments, route, requireFeature } from "@/server/http";

/** GET ?period=&dept= → scenario levers with their full-year baseline (MOM S4). */
export const GET = route(async (req) => {
  const user = await requireFeature("scenario.use");
  const params = new URL(req.url).searchParams;
  const ctx = await loadContext();
  const flt = resolveFilters(ctx, { period: params.get("period"), dept: params.get("dept") }, allowedDepartments(user));
  return NextResponse.json({
    filters: flt,
    asOf: thaiMonthYear(flt.year, flt.month),
    levers: scenarioBaseline(ctx, flt),
  });
});
