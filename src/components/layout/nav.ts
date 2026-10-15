import { Bug, Building2, Grid3x3, Home, LayoutDashboard, Lightbulb, ListChecks, ShieldCheck, SlidersHorizontal, UserCog } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import type { FeatureKey } from "@/lib/access/catalog";

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: typeof Home;
  /** Shown only to users whose tier has this feature (the page itself is guarded on the server). */
  permission?: FeatureKey;
  /** Extra path prefixes that count as "inside" this item. */
  match?: string[];
  children?: NavItem[];
  /** `data-tour` name for the product tour (lib/tour/tours.ts). */
  tour?: string;
}

/**
 * Lean menu (MOM N4–N9): Home → Insight (Dashboard, Scenario Planning) → Follow-up.
 * Upload, Chart Builder, AI Agent and Alert Threshold are no longer menu items.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "nav.home", icon: Home },
  {
    href: "/insights",
    label: "nav.insight",
    icon: Lightbulb,
    match: ["/dashboard", "/scenario", "/upload"],
    children: [
      { href: "/insights", label: "nav.insightOverview", icon: Lightbulb, permission: "insights.view" },
      { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard, match: ["/upload"], permission: "dashboard.view" },
      { href: "/scenario", label: "nav.scenario", icon: SlidersHorizontal, permission: "scenario.use" },
    ],
  },
  { href: "/follow-up", label: "nav.followUp", icon: ListChecks, permission: "issues.view" },
  {
    href: "/admin",
    label: "nav.adminGroup",
    tour: "nav-admin",
    icon: ShieldCheck,
    children: [
      { href: "/admin/users", label: "nav.adminLevels", icon: UserCog, permission: "users.manage" },
      { href: "/admin/tiers", label: "nav.adminTiers", icon: Grid3x3, permission: "access.tiers" },
      { href: "/admin/access", label: "nav.adminAccess", icon: Building2, permission: "users.manage" },
    ],
  },
];

/** Bottom-left of the sidebar (MOM N8). */
export const NAV_BOTTOM: NavItem[] = [
  { href: "/feedback?type=issue", label: "nav.reportBug", icon: Bug, permission: "feedback.send" },
  { href: "/feedback?type=new_request", label: "nav.requestFeature", icon: Lightbulb, permission: "feedback.send" },
];

export function isActive(pathname: string, item: NavItem) {
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
