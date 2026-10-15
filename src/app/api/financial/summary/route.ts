import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { loadSummary } from "@/server/summary";

export const GET = route(async () => {
  await requireFeature("dashboard.view");
  const { summary } = await loadSummary();
  return NextResponse.json(summary);
});
