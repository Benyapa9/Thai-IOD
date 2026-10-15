import { NextResponse } from "next/server";
import { forecastByCategory } from "@/lib/finance";
import { route, requireFeature } from "@/server/http";
import { loadSummary } from "@/server/summary";

/** Year-end forecast = YTD ÷ months elapsed × 12 */
export const GET = route(async () => {
  await requireFeature("forecast.view");
  const { summary } = await loadSummary();
  return NextResponse.json({
    year: summary.year,
    method: "YTD ÷ months elapsed × 12",
    ...summary.forecast,
    ytd: summary.ytd,
    revenueByCategory: forecastByCategory(summary),
  });
});
