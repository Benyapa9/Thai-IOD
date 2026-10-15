"use client";

import { useId } from "react";

/**
 * Theme-tone gradients for line charts: a left→right stroke and a soft
 * top→bottom fill under the line. Render `defs` as a child of the Recharts
 * chart and use `stroke` / `fill` on <Line> / <Area>.
 * The stroke uses userSpaceOnUse so a flat line (zero-height box) still draws.
 */
export function useLineGradient(tone: "primary" | "muted" = "primary") {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [from, to] = tone === "primary" ? ["var(--chart-line-from)", "var(--chart-line-to)"] : ["var(--color-navy-300)", "var(--color-navy-600)"];
  const defs = (
    <defs>
      <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
      <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--color-navy-500)" stopOpacity={0.32} />
        <stop offset="100%" stopColor="var(--color-navy-500)" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
  return { stroke: `url(#${id}s)`, fill: `url(#${id}f)`, dot: "var(--chart-dot)", defs };
}
