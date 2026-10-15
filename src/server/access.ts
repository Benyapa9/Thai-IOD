import "server-only";
import { type FeatureKey, TIER_IDS, type TierId, tierFromLegacyRole } from "@/lib/access/catalog";
import { resolveEffectiveFeatures } from "@/lib/access/engine";
import { getRepo } from "@/server/repository";
import type { User } from "@/types/domain";

/**
 * Server-side permission resolution. Effective features per tier are computed
 * once per access version (the matrix changes rarely), so a check costs a
 * version read and a set lookup.
 */
const cache = globalThis as unknown as { __iodEffective?: { version: number; byTier: Record<TierId, Set<FeatureKey>> } };

export async function effectiveByTier() {
  const { grants, version } = await (await getRepo()).access.snapshot();
  const hit = cache.__iodEffective;
  if (hit && hit.version === version) return hit;
  const byTier = Object.fromEntries(TIER_IDS.map((t) => [t, resolveEffectiveFeatures(t, grants)])) as Record<TierId, Set<FeatureKey>>;
  return (cache.__iodEffective = { version, byTier });
}

/** A user's tier; users created before the tier system fall back to their old role. */
export function userTier(user: Pick<User, "tierId" | "role">): TierId {
  return user.tierId ?? tierFromLegacyRole(user.role);
}

/** Features a user has right now (inactive users have none). */
export async function featuresOf(user: Pick<User, "tierId" | "role" | "isActive">): Promise<Set<FeatureKey>> {
  if (!user.isActive) return new Set();
  return (await effectiveByTier()).byTier[userTier(user)];
}

/** Active users whose tier has a feature (e.g. who gets KPI alert emails). */
export async function usersWithFeature(key: FeatureKey): Promise<User[]> {
  const { byTier } = await effectiveByTier();
  const users = await (await getRepo()).users.list();
  return users.filter((u) => u.isActive && byTier[userTier(u)].has(key));
}
