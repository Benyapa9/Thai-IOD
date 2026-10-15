import { DEFAULT_GRANTS, type FeatureKey, FEATURE_KEYS, LOCKOUT_FEATURES, TIERS, type TierDef, type TierId } from "./catalog";

/**
 * Pure permission logic (no DB, no React) — covered by engine.test.ts.
 *
 * Rules: tiers inherit along Basic → Standard → Advanced → IT. Walking that
 * chain from the root, each tier's explicit "allow" adds a feature and "deny"
 * removes it, so the closer tier wins. Anything never allowed is denied.
 */

export type Effect = "allow" | "deny";
/** Explicit grants per tier; a missing entry means "not specified here". */
export type GrantMap = Partial<Record<TierId, Partial<Record<FeatureKey, Effect>>>>;

export interface GrantChange {
  tierId: TierId;
  featureKey: FeatureKey;
  /** null = remove the explicit setting (fall back to inheritance). */
  effect: Effect | null;
}

/** Tiers from the root down to `tierId`. Stops on cycles or unknown ids. */
export function tierChain(tierId: TierId, tiers: TierDef[] = TIERS): TierDef[] {
  const byId = new Map(tiers.map((t) => [t.id, t]));
  const chain: TierDef[] = [];
  const seen = new Set<TierId>();
  for (let t = byId.get(tierId); t && !seen.has(t.id); t = t.inheritsFromId ? byId.get(t.inheritsFromId) : undefined) {
    seen.add(t.id);
    chain.unshift(t);
  }
  return chain;
}

/** Features a tier ends up with. No tier → nothing. */
export function resolveEffectiveFeatures(tierId: TierId | null | undefined, grants: GrantMap, tiers: TierDef[] = TIERS): Set<FeatureKey> {
  const out = new Set<FeatureKey>();
  if (!tierId) return out;
  for (const t of tierChain(tierId, tiers)) {
    for (const [key, effect] of Object.entries(grants[t.id] ?? {}) as [FeatureKey, Effect][]) {
      if (effect === "allow") out.add(key);
      else out.delete(key);
    }
  }
  return out;
}

export interface CellState {
  /** Set on this tier itself. */
  explicit: Effect | null;
  /** The parent tier has it (so this tier gets it unless it says "deny"). */
  inherited: boolean;
  /** Final result for this tier. */
  effective: boolean;
}

export function cellState(tierId: TierId, key: FeatureKey, grants: GrantMap, tiers: TierDef[] = TIERS): CellState {
  const parent = tiers.find((t) => t.id === tierId)?.inheritsFromId ?? null;
  const inherited = parent ? resolveEffectiveFeatures(parent, grants, tiers).has(key) : false;
  const explicit = grants[tierId]?.[key] ?? null;
  return { explicit, inherited, effective: explicit ? explicit === "allow" : inherited };
}

/**
 * One click on a matrix cell:
 * allowed here → clear · exception (deny) → clear (inherit again) ·
 * inherited → make an exception · nothing → allow here.
 */
export function clickCell(c: CellState): Effect | null {
  if (c.explicit) return null;
  return c.inherited ? "deny" : "allow";
}

/** Turn a cell on or off (used by the group checkbox). */
export function setCell(c: CellState, on: boolean): Effect | null {
  if (on) return c.inherited ? null : "allow";
  return c.inherited ? "deny" : null;
}

export function applyChanges(grants: GrantMap, changes: GrantChange[]): GrantMap {
  const next: GrantMap = {};
  for (const [tier, row] of Object.entries(grants) as [TierId, Partial<Record<FeatureKey, Effect>>][]) next[tier] = { ...row };
  for (const c of changes) {
    const row = (next[c.tierId] ??= {});
    if (c.effect) row[c.featureKey] = c.effect;
    else delete row[c.featureKey];
  }
  return next;
}

/** Changes whose effect differs from the current grants (drops no-ops). */
export function normalizeChanges(grants: GrantMap, changes: GrantChange[]): GrantChange[] {
  const last = new Map<string, GrantChange>();
  for (const c of changes) last.set(`${c.tierId}:${c.featureKey}`, c);
  return [...last.values()].filter((c) => (grants[c.tierId]?.[c.featureKey] ?? null) !== c.effect);
}

/**
 * Lockout protection: the top tier must keep user management and the matrix
 * itself, otherwise nobody could ever fix a mistake.
 */
export function lockoutProblems(grants: GrantMap, tiers: TierDef[] = TIERS, topTier: TierId = "it"): FeatureKey[] {
  const eff = resolveEffectiveFeatures(topTier, grants, tiers);
  return LOCKOUT_FEATURES.filter((k) => !eff.has(k));
}

/** What a tier gains and loses between two grant maps (for the "before you save" summary). */
export function tierDelta(tierId: TierId, before: GrantMap, after: GrantMap, tiers: TierDef[] = TIERS) {
  const a = resolveEffectiveFeatures(tierId, before, tiers);
  const b = resolveEffectiveFeatures(tierId, after, tiers);
  return {
    added: FEATURE_KEYS.filter((k) => !a.has(k) && b.has(k)),
    removed: FEATURE_KEYS.filter((k) => a.has(k) && !b.has(k)),
    total: b.size,
  };
}

/** GrantMap from rows as stored (TierFeature). Unknown tiers/features are ignored. */
export function grantsFromRows(rows: { tierId: string; featureKey: string; effect: string }[]): GrantMap {
  const out: GrantMap = {};
  const tierIds = new Set<string>(TIERS.map((t) => t.id));
  const keys = new Set<string>(FEATURE_KEYS);
  for (const r of rows) {
    if (!tierIds.has(r.tierId) || !keys.has(r.featureKey) || (r.effect !== "allow" && r.effect !== "deny")) continue;
    (out[r.tierId as TierId] ??= {})[r.featureKey as FeatureKey] = r.effect;
  }
  return out;
}

/** The seed matrix (DEFAULT_GRANTS) as a GrantMap. */
export function defaultGrantMap(): GrantMap {
  const out: GrantMap = {};
  for (const [tier, keys] of Object.entries(DEFAULT_GRANTS) as [TierId, FeatureKey[]][]) {
    out[tier] = Object.fromEntries(keys.map((k) => [k, "allow" as const]));
  }
  return out;
}
