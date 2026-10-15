import "server-only";
import { FEATURE_BY_KEY, FEATURE_GROUPS, FEATURES, type FeatureKey, TIER_IDS, TIERS, type TierId } from "@/lib/access/catalog";
import { applyChanges, lockoutProblems, normalizeChanges, resolveEffectiveFeatures } from "@/lib/access/engine";
import { userTier } from "@/server/access";
import { type Account, HttpError } from "@/server/http";
import { getRepo } from "@/server/repository";
import { NoActiveItError, type UserAccessChange } from "@/server/repository/types";
import { matrixUpdateSchema, usersAccessSchema } from "@/server/validation";
import type { User } from "@/types/domain";

/*
 * Admin operations on access (access-matrix phases 3 & 5). Route handlers stay
 * thin; the rules live here so they can be tested without HTTP.
 */

const activeIt = (users: Pick<User, "isActive" | "tierId" | "role">[]) => users.filter((u) => u.isActive && userTier(u) === "it").length;

function tierCounts(users: User[]) {
  const counts = Object.fromEntries(TIER_IDS.map((t) => [t, 0])) as Record<TierId, number>;
  for (const u of users) if (u.isActive) counts[userTier(u)]++;
  return counts;
}

/** Everything the matrix page needs. */
export async function getMatrix() {
  const repo = await getRepo();
  const [{ grants, version }, users] = await Promise.all([repo.access.snapshot(), repo.users.list()]);
  const counts = tierCounts(users);
  return {
    version,
    tiers: TIERS.map((t) => ({ ...t, users: counts[t.id] })),
    groups: FEATURE_GROUPS,
    features: FEATURES,
    grants,
    effective: Object.fromEntries(TIER_IDS.map((t) => [t, [...resolveEffectiveFeatures(t, grants)]])) as Record<TierId, FeatureKey[]>,
  };
}
export type MatrixResponse = Awaited<ReturnType<typeof getMatrix>>;

/** PUT /api/access/matrix (caller already has access.tiers). */
const NO_IT = "บันทึกไม่ได้: ต้องเหลือผู้ใช้ระดับ IT ที่เปิดใช้งานอย่างน้อย 1 คน";
const STALE = "มีผู้ดูแลคนอื่นแก้ไขระดับสิทธิ์ไปก่อนหน้านี้ กรุณาโหลดหน้าใหม่ ตรวจสอบ แล้วบันทึกอีกครั้ง";

export async function updateMatrix(actor: Account, body: unknown) {
  const input = matrixUpdateSchema.parse(body);
  const repo = await getRepo();
  const current = await repo.access.snapshot();
  if (input.version !== current.version) {
    throw new HttpError(409, STALE);
  }
  const changes = normalizeChanges(current.grants, input.changes);
  if (!changes.length) return getMatrix();

  const after = applyChanges(current.grants, changes);
  const lost = lockoutProblems(after);
  if (lost.length) {
    const names = lost.map((k) => `“${FEATURE_BY_KEY[k].name}”`).join(" และ ");
    throw new HttpError(409, `บันทึกไม่ได้: ระดับ IT ต้องมีสิทธิ์ ${names} เสมอ ไม่เช่นนั้นจะไม่มีใครแก้ไขสิทธิ์ได้อีก`);
  }
  if (activeIt(await repo.users.list()) < 1) {
    throw new HttpError(409, "บันทึกไม่ได้: ต้องมีผู้ใช้ระดับ IT ที่เปิดใช้งานอย่างน้อย 1 คน กรุณากำหนดที่หน้าจัดการผู้ใช้ก่อน");
  }
  if (!(await repo.access.applyGrantChanges(changes, actor.id, input.version))) throw new HttpError(409, STALE);
  return getMatrix();
}

/** PATCH /api/users (caller already has users.manage). */
export async function updateUsersAccess(actor: Account, body: unknown) {
  const { changes } = usersAccessSchema.parse(body);
  if (changes.some((c) => c.userId === actor.id)) {
    throw new HttpError(403, "เปลี่ยนระดับหรือปิดบัญชีของตัวเองไม่ได้ ให้ผู้ดูแลคนอื่นเป็นผู้แก้ไข");
  }
  const repo = await getRepo();
  const users = await repo.users.list();
  const byId = new Map(users.map((u) => [u.id, u]));
  const missing = changes.filter((c) => !byId.has(c.userId));
  if (missing.length) throw new HttpError(404, "ไม่พบผู้ใช้บางคนในรายการ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");

  // Drop rows that don't change anything.
  const effective: UserAccessChange[] = [];
  for (const c of changes) {
    const u = byId.get(c.userId)!;
    const row: UserAccessChange = { userId: c.userId };
    if (c.tierId !== undefined && c.tierId !== userTier(u)) row.tierId = c.tierId;
    if (c.isActive !== undefined && c.isActive !== u.isActive) row.isActive = c.isActive;
    if (row.tierId !== undefined || row.isActive !== undefined) effective.push(row);
  }
  if (!effective.length) return { users: await repo.users.list(), changed: 0 };

  const afterUsers = users.map((u) => {
    const c = effective.find((x) => x.userId === u.id);
    return c
      ? {
          ...u,
          tierId: c.tierId ?? u.tierId,
          isActive: c.isActive ?? u.isActive,
        }
      : u;
  });
  if (activeIt(afterUsers) < 1) throw new HttpError(409, NO_IT);
  await repo.users.applyAccessChanges(effective, actor.id).catch((err) => {
    throw err instanceof NoActiveItError ? new HttpError(409, NO_IT) : err;
  });
  return { users: await repo.users.list(), changed: effective.length };
}

export { tierCounts };
