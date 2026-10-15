import type { Category } from "@/types/domain";

/** Chart palette — follows the selected colour theme via CSS variables (MOM G4). */
export const CHART = {
  revenue: "var(--color-navy-800)",
  expense: "#98a2b3",
  budget: "var(--color-navy-500)",
  noi: "var(--color-navy-600)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  training: "var(--color-navy-900)",
  membership: "var(--color-navy-600)",
  sponsorship: "var(--color-navy-400)",
  corporate: "#a9b1be",
};

export const axisProps = {
  stroke: CHART.axis,
  fontSize: 12,
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;
