import { NextResponse } from "next/server";
import { HttpError, route, requireFeature } from "@/server/http";
import { notifyIssueAssigned } from "@/server/notifications";
import { getRepo } from "@/server/repository";
import { updateIssueSchema } from "@/server/validation";

type Ctx = RouteContext<"/api/issues/[id]">;

export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireFeature("issues.update");
  const { id } = await ctx.params;
  const repo = await getRepo();
  const existing = await repo.issues.get(id);
  if (!existing) throw new HttpError(404, "ไม่พบรายการ Follow-up");

  const patch = updateIssueSchema.parse(await req.json());
  const issue = await repo.issues.update(id, patch);

  if (issue.ownerId && issue.ownerId !== existing.ownerId && issue.ownerId !== user.id) {
    notifyIssueAssigned(issue);
  }
  return NextResponse.json({ issue });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireFeature("issues.delete");
  const { id } = await ctx.params;
  await (await getRepo()).issues.delete(id);
  return new NextResponse(null, { status: 204 });
});
