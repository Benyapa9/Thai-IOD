import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { feedbackSchema } from "@/server/validation";
import { FEEDBACK_TYPES, type FeedbackType } from "@/types/domain";

/**
 * Feedback about the system (MOM F3): issues, new dashboard requests (D1),
 * insight requests (I8) and page ratings (I7). Advanced users see everyone's;
 * others see their own.
 */
export const GET = route(async (req) => {
  const user = await requireFeature("feedback.send");
  const types = (new URL(req.url).searchParams.get("type") ?? "")
    .split(",")
    .filter((t): t is FeedbackType => (FEEDBACK_TYPES as readonly string[]).includes(t));
  const repo = await getRepo();
  const [items, users] = await Promise.all([
    repo.feedback.list({
      type: types.length ? types : undefined,
      createdBy: user.can("feedback.manage") ? undefined : user.id,
    }),
    repo.users.list(),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return NextResponse.json({ items: items.map((i) => ({ ...i, createdByName: nameOf.get(i.createdBy) ?? "-" })) });
});

export const POST = route(async (req) => {
  const user = await requireFeature("feedback.send");
  const input = feedbackSchema.parse(await req.json());
  const item = await (await getRepo()).feedback.create({ ...input, createdBy: user.id });
  return NextResponse.json({ item }, { status: 201 });
});
