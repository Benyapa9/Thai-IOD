import { NextResponse } from "next/server";
import { route, toPublicUser, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { preferencesSchema } from "@/server/validation";

/** Current user incl. level, department access, consent and preferences (MOM A8). */
export const GET = route(async () => {
  const user = await requireFeature();
  return NextResponse.json({ user: toPublicUser(user) });
});

/** Save theme / language preferences (MOM G3, G4). */
export const PATCH = route(async (req) => {
  const user = await requireFeature();
  const patch = preferencesSchema.parse(await req.json());
  const updated = await (await getRepo()).users.update(user.id, patch);
  return NextResponse.json({ user: toPublicUser(updated) });
});
