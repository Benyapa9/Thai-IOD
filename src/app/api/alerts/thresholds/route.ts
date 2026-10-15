import { NextResponse } from "next/server";
import { ALERT_DEFS, type DashboardPage } from "@/lib/alert-defs";
import { evaluateAlerts } from "@/server/dashboard/alerts";
import { loadContext, resolveFilters } from "@/server/dashboard/service";
import { allowedDepartments, route, requireFeature } from "@/server/http";
import { notifyAllAlertsSafely } from "@/server/notifications";
import { getRepo } from "@/server/repository";
import { thresholdsSchema } from "@/server/validation";

/** GET ?dashboard=kpi&period=…&dept=… → thresholds with their current values (MOM D10). */
export const GET = route(async (req) => {
  const user = await requireFeature("thresholds.view");
  const params = new URL(req.url).searchParams;
  const dashboard = params.get("dashboard") as DashboardPage | null;
  const only = dashboard && dashboard in ALERT_DEFS ? dashboard : undefined;
  const ctx = await loadContext();
  const flt = resolveFilters(ctx, { period: params.get("period"), dept: params.get("dept") }, allowedDepartments(user));
  const thresholds = await (await getRepo()).thresholds.list(only);
  return NextResponse.json({ alerts: evaluateAlerts(ctx, flt, thresholds, only) });
});

export const PUT = route(async (req) => {
  const user = await requireFeature("thresholds.edit");
  const { thresholds } = thresholdsSchema.parse(await req.json());
  const saved = await (await getRepo()).thresholds.upsertMany(thresholds, user.id);
  notifyAllAlertsSafely();
  return NextResponse.json({ thresholds: saved });
});
