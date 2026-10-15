import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";

export const DELETE = route<RouteContext<"/api/upload/[id]">>(async (_req, ctx) => {
  await requireFeature("upload.delete");
  const { id } = await ctx.params;
  await (await getRepo()).uploads.delete(id);
  return new NextResponse(null, { status: 204 });
});
