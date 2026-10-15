import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { feedbackPatchSchema } from "@/server/validation";

export const PATCH = route<RouteContext<"/api/feedback/[id]">>(async (req, ctx) => {
  await requireFeature("feedback.manage");
  const { id } = await ctx.params;
  const patch = feedbackPatchSchema.parse(await req.json());
  return NextResponse.json({ item: await (await getRepo()).feedback.update(id, patch) });
});
