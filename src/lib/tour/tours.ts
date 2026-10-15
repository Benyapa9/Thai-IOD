import type { FeatureKey } from "@/lib/access/catalog";

/**
 * Product tours as data. The player (components/tour/tour-player.tsx) reads
 * these; to add a step, add it here, put `data-tour="<target>"` on the element
 * and add `tour.<tourId>.<stepId>.title|body` to lib/i18n.ts. See docs/TOUR.md.
 */
export interface TourStep {
  id: string;
  /** Page the step lives on; null = stay on the current page. */
  page: string | null;
  /** `data-tour` value of the element to point at; null = centred card. */
  target: string | null;
  /** Something to expand first (e.g. "sidebar" on mobile). UI only — never changes data. */
  open?: "sidebar";
  /** Only users with this permission get the step (never point at what they can't use). */
  permission?: FeatureKey;
}

export interface TourDef {
  id: string;
  /** Bump after changing many steps: everyone who saw an older version sees it again. */
  version: number;
  steps: TourStep[];
}

export const MAIN_TOUR: TourDef = {
  id: "main",
  version: 1,
  steps: [
    { id: "welcome", page: "/home", target: null },
    { id: "insightOfDay", page: "/home", target: "home-insight-of-day" },
    { id: "insightGroups", page: "/insights", target: "insight-groups" },
    { id: "followUp", page: "/insights", target: "insight-follow-up", permission: "issues.create" },
    { id: "filters", page: "/dashboard/main/kpi", target: "dashboard-filters" },
    { id: "actions", page: "/dashboard/main/kpi", target: "dashboard-actions" },
    { id: "zyinsight", page: null, target: "zyinsight", permission: "agent.chat" },
    { id: "admin", page: null, target: "nav-admin", permission: "users.manage", open: "sidebar" },
    { id: "done", page: null, target: null },
  ],
};

export const TOURS: Record<string, TourDef> = { [MAIN_TOUR.id]: MAIN_TOUR };
