import { NextResponse } from "next/server";
import { HttpError, requireFeature, route, toPublicUser } from "@/server/http";
import { getRepo } from "@/server/repository";
import { updateUserSchema } from "@/server/validation";

/** Department data access for one user (MOM A5). Tier / active status: PATCH /api/users. */
export const PATCH = route<RouteContext<"/api/users/[id]">>(async (req, ctx) => {
  await requireFeature("users.manage");
  const { id } = await ctx.params;
  const patch = updateUserSchema.parse(await req.json());
  const repo = await getRepo();
  if (!(await repo.users.findById(id))) throw new HttpError(404, "ไม่พบผู้ใช้นี้ อาจถูกลบไปแล้ว");
  return NextResponse.json({ user: toPublicUser(await repo.users.update(id, patch)) });
});
