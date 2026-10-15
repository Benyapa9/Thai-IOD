import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { ratingSchema } from "@/server/validation";

/** Like / dislike an insight (MOM H3) — feeds tomorrow's Insight of the Day. */
export const POST = route(async (req) => {
  const user = await requireFeature("insights.view");
  const input = ratingSchema.parse(await req.json());
  const rating = await (await getRepo()).ratings.upsert({ ...input, userId: user.id });
  return NextResponse.json({ rating });
});
