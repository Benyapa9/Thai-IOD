import { NextResponse } from "next/server";
import { getRepo } from "@/server/repository";
import { route, searchParams, requireFeature } from "@/server/http";
import { financialFilterSchema } from "@/server/validation";

export const GET = route(async (req) => {
  await requireFeature("dashboard.view");
  const q = searchParams(req);
  const filter = financialFilterSchema.parse({
    period: q("period"),
    periodFrom: q("periodFrom"),
    periodTo: q("periodTo"),
    category: q("category"),
    type: q("type"),
  });
  const records = await (await getRepo()).financial.list(filter);
  return NextResponse.json({ records });
});
