import { type FeatureKey, TIER_BY_ID, type TierId } from "@/lib/access/catalog";

/**
 * Access is feature-based (access-matrix): each tier's features come from the
 * live Tier × Feature matrix (src/lib/access, edited on /admin/tiers). This
 * file only says which feature each page section needs; server/page-guard.ts
 * enforces it in the section layouts, API routes call requireFeature().
 */
export type Permission = FeatureKey;

/** Longest matching prefix wins. Unlisted pages only need a session. */
export const ROUTE_FEATURES: { prefix: string; feature: FeatureKey }[] = [
  { prefix: "/dashboard/pnl", feature: "forecast.view" },
  { prefix: "/dashboard", feature: "dashboard.view" },
  { prefix: "/insights", feature: "insights.view" },
  { prefix: "/upload", feature: "upload.create" },
  { prefix: "/follow-up", feature: "issues.view" },
  { prefix: "/scenario", feature: "scenario.use" },
  { prefix: "/feedback", feature: "feedback.send" },
  { prefix: "/builder", feature: "builder.use" },
  { prefix: "/admin/users", feature: "users.manage" },
  { prefix: "/admin/access", feature: "users.manage" },
  { prefix: "/admin/tiers", feature: "access.tiers" },
];

export function featureForPath(pathname: string): FeatureKey | null {
  const hit = ROUTE_FEATURES.filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return hit?.feature ?? null;
}

/** Display info for a tier (labels used across the UI). */
export const tierLabel = (tier: TierId) => TIER_BY_ID[tier]?.name ?? tier;
