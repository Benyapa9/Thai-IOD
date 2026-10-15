import { NextResponse } from "next/server";
import { requireFeature, route } from "@/server/http";
import { getRepo } from "@/server/repository";

/** Recent access changes (matrix and user tiers). */
export const GET = route(async () => {
  await requireFeature("access.tiers");
  const repo = await getRepo();
  const [entries, users] = await Promise.all([repo.access.auditLog(50), repo.users.list()]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return NextResponse.json({ entries: entries.map((e) => ({ ...e, actorName: nameOf.get(e.actorId) ?? e.actorId })) });
});
