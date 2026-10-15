import { NextResponse } from "next/server";
import { HttpError, route } from "@/server/http";
import { notifyDueSoon, notifyThresholdBreach } from "@/server/notifications";
import { getRepo } from "@/server/repository";
import { evaluateAlerts } from "@/server/dashboard/alerts";
import { loadContext, resolveFilters } from "@/server/dashboard/service";

/**
 * Daily job (e.g. GitHub Actions schedule or Azure timer):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notify
 * Emails owners of issues due tomorrow and the KPI breach digest.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new HttpError(401, "Unauthorized");
  }

  const repo = await getRepo();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = tomorrow.toISOString().slice(0, 10);

  const dueSoon = (await repo.issues.list()).filter(
    (i) =>
      i.dueDate &&
      new Date(i.dueDate).toISOString().slice(0, 10) === day &&
      (i.status === "open" || i.status === "in_progress"),
  );
  await notifyDueSoon(dueSoon);

  const ctx = await loadContext();
  const alerts = evaluateAlerts(ctx, resolveFilters(ctx, {}, null), await repo.thresholds.list());
  await notifyThresholdBreach(alerts);

  return NextResponse.json({ dueSoon: dueSoon.length, breached: alerts.filter((a) => a.breached).length });
});
