import { NextResponse } from "next/server";
import { route, searchParams, requireFeature } from "@/server/http";
import { notifyIssueAssigned } from "@/server/notifications";
import { getRepo } from "@/server/repository";
import { createIssueSchema, issueFilterSchema } from "@/server/validation";

export const GET = route(async (req) => {
  await requireFeature("issues.view");
  const q = searchParams(req);
  const filter = issueFilterSchema.parse({
    status: q("status"),
    severity: q("severity"),
    ownerId: q("ownerId"),
  });
  const issues = await (await getRepo()).issues.list(filter);
  return NextResponse.json({ issues });
});

export const POST = route(async (req) => {
  const user = await requireFeature("issues.create");
  const input = createIssueSchema.parse(await req.json());
  const issue = await (await getRepo()).issues.create({ ...input, reporter: user.id });
  if (issue.ownerId && issue.ownerId !== user.id) notifyIssueAssigned(issue);
  return NextResponse.json({ issue }, { status: 201 });
});
