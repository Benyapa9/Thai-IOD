import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { tourSeenSchema } from "@/server/validation";

/** Remember that the user finished or skipped a tour version, so it never auto-starts again. */
export const POST = route(async (req) => {
  const user = await requireFeature();
  const { tourId, version } = tourSeenSchema.parse(await req.json());
  const seen = { ...(user.tourSeen ?? {}) };
  seen[tourId] = Math.max(seen[tourId] ?? 0, version);
  await (await getRepo()).users.update(user.id, { tourSeen: seen });
  return new NextResponse(null, { status: 204 });
});
