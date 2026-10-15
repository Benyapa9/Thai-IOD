import { NextResponse } from "next/server";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { scenarioSchema } from "@/server/validation";

/** Everyone can view and simulate every saved scenario (MOM S5); saving needs Standard. */
export const GET = route(async () => {
  await requireFeature("scenario.use");
  const repo = await getRepo();
  const [scenarios, users] = await Promise.all([repo.scenarios.list(), repo.users.list()]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return NextResponse.json({ scenarios: scenarios.map((s) => ({ ...s, savedByName: nameOf.get(s.savedBy) ?? "-" })) });
});

export const POST = route(async (req) => {
  const user = await requireFeature("scenario.save");
  const input = scenarioSchema.parse(await req.json());
  const scenario = await (await getRepo()).scenarios.create({ ...input, savedBy: user.id });
  return NextResponse.json({ scenario }, { status: 201 });
});
