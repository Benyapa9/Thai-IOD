import { NextResponse } from "next/server";
import type { FeatureKey } from "@/lib/access/catalog";
import { HttpError, requireFeature, route } from "@/server/http";
import { getRepo } from "@/server/repository";
import { scenarioPatchSchema } from "@/server/validation";

type Ctx = RouteContext<"/api/scenarios/[id]">;

/** Loads the scenario after the feature check — permission is checked on the object, not just existence. */
async function loadScenario(ctx: Ctx, key: FeatureKey | FeatureKey[]) {
  const user = await requireFeature(key);
  const { id } = await ctx.params;
  const repo = await getRepo();
  const scenario = await repo.scenarios.get(id);
  if (!scenario) throw new HttpError(404, "ไม่พบ Scenario นี้ อาจถูกลบไปแล้ว");
  return { user, scenario, repo };
}

/** Only the owner can change a scenario (MOM S5). */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user, scenario, repo } = await loadScenario(ctx, "scenario.save");
  if (scenario.savedBy !== user.id) throw new HttpError(403, "แก้ไขได้เฉพาะเจ้าของ Scenario ใช้ “บันทึกเป็นฉบับใหม่” แทนได้");
  const patch = scenarioPatchSchema.parse(await req.json());
  return NextResponse.json({ scenario: await repo.scenarios.update(scenario.id, patch) });
});

/** Owner (with scenario.save) deletes their own; scenario.delete deletes anyone's. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const { user, scenario, repo } = await loadScenario(ctx, []);
  const own = scenario.savedBy === user.id && user.can("scenario.save");
  if (!own && !user.can("scenario.delete")) {
    throw new HttpError(403, "ลบได้เฉพาะเจ้าของ Scenario หรือผู้ที่มีสิทธิ์ “ลบสถานการณ์ของผู้อื่น”");
  }
  await repo.scenarios.delete(scenario.id);
  return new NextResponse(null, { status: 204 });
});
