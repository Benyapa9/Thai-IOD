import { NextResponse } from "next/server";
import { HttpError, requireFeature, route } from "@/server/http";
import { getRepo } from "@/server/repository";
import { noteUpdateSchema } from "@/server/validation";

/** Only the author can change or delete a note; anyone else gets 404 (the note's existence is not revealed). */
export const PATCH = route<RouteContext<"/api/notes/[id]">>(async (req, ctx) => {
  const user = await requireFeature();
  const { id } = await ctx.params;
  const note = await (await getRepo()).notes.update(user.id, id, noteUpdateSchema.parse(await req.json()));
  if (!note) throw new HttpError(404, "ไม่พบโน้ตนี้");
  return NextResponse.json({ note });
});

export const DELETE = route<RouteContext<"/api/notes/[id]">>(async (_req, ctx) => {
  const user = await requireFeature();
  const { id } = await ctx.params;
  if (!(await (await getRepo()).notes.remove(user.id, id))) throw new HttpError(404, "ไม่พบโน้ตนี้");
  return new NextResponse(null, { status: 204 });
});
