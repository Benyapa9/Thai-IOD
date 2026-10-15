import { NextResponse } from "next/server";
import { requireFeature, route } from "@/server/http";
import { getRepo } from "@/server/repository";
import { noteCreateSchema } from "@/server/validation";

/** My private notes (never anyone else's). Any signed-in user. */
export const GET = route(async () => {
  const user = await requireFeature();
  return NextResponse.json({ notes: await (await getRepo()).notes.list(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireFeature();
  const input = noteCreateSchema.parse(await req.json());
  const note = await (await getRepo()).notes.create({ userId: user.id, content: input.content, dueDate: input.dueDate ?? null, page: input.page ?? null });
  return NextResponse.json({ note }, { status: 201 });
});
