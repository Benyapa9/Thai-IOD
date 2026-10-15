import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { commentarySchema, periodSchema } from "@/server/validation";

type Ctx = RouteContext<"/api/commentary/[period]">;

export const GET = route<Ctx>(async (_req, ctx) => {
  await requireFeature("commentary.view");
  const period = periodSchema.parse((await ctx.params).period);
  const commentary = await (await getRepo()).commentary.get(period);
  return NextResponse.json({ commentary });
});

export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireFeature("commentary.write");
  const period = periodSchema.parse((await ctx.params).period);
  const { content } = commentarySchema.parse(await req.json());
  const commentary = await (await getRepo()).commentary.upsert(period, content, user.id);
  return NextResponse.json({ commentary });
});
