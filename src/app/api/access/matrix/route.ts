import { NextResponse } from "next/server";
import { getMatrix, updateMatrix } from "@/server/access-admin";
import { requireFeature, route } from "@/server/http";

/** Tier × Feature matrix: features, tiers (with user counts) and explicit grants. */
export const GET = route(async () => {
  await requireFeature("access.tiers");
  return NextResponse.json(await getMatrix());
});

/** Save changed cells only (diff), in one transaction, audited; 409 on lockout or stale version. */
export const PUT = route(async (req) => {
  const actor = await requireFeature("access.tiers");
  return NextResponse.json(await updateMatrix(actor, await req.json()));
});
