import type { FeatureKey } from "@/lib/access/catalog";
import type { TourDef, TourStep } from "./tours";

/** Pure tour logic (no DOM, no React) — covered by engine.test.ts. */

/** Steps this user may see: anything needing a feature they lack is removed up front. */
export function stepsFor(tour: TourDef, features: readonly FeatureKey[]): TourStep[] {
  return tour.steps.filter((s) => !s.permission || features.includes(s.permission));
}

/** Auto-start only if neither the server nor this browser has a record of this version. */
export function shouldAutoStart(tour: TourDef, serverSeen: Record<string, number> | null | undefined, localSeen?: number | null) {
  return Math.max(serverSeen?.[tour.id] ?? 0, localSeen ?? 0) < tour.version;
}

/**
 * Next index to show when moving `dir` from `from`, skipping steps whose
 * element was not found. null = nothing further that way.
 */
export function nextIndex(count: number, from: number, dir: 1 | -1, skipped: ReadonlySet<number>): number | null {
  for (let i = from + dir; i >= 0 && i < count; i += dir) {
    if (!skipped.has(i)) return i;
  }
  return null;
}

/** "Step 2 of 8" counting only the steps that are actually shown. */
export function stepPosition(count: number, index: number, skipped: ReadonlySet<number>) {
  let before = 0;
  for (const s of skipped) if (s < index) before++;
  return { current: index + 1 - before, total: count - skipped.size };
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Side = "bottom" | "top" | "right" | "left" | "center";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Highlighted area: the target plus a little breathing room, kept on screen. */
export function spotlightRect(target: Rect, viewport: Size, pad = 8): Rect {
  const top = Math.max(0, target.top - pad);
  const left = Math.max(0, target.left - pad);
  return {
    top,
    left,
    width: Math.min(viewport.width, target.left + target.width + pad) - left,
    height: Math.min(viewport.height, target.top + target.height + pad) - top,
  };
}

/**
 * Where to put the explanation card: beside the target (below, above, right,
 * left — the first side with room), never past the screen edges. Without a
 * target, or when nothing fits, it is centred.
 */
export function placeCard(target: Rect | null, card: Size, viewport: Size, gap = 14, margin = 12): { top: number; left: number; side: Side } {
  const maxLeft = viewport.width - card.width - margin;
  const maxTop = viewport.height - card.height - margin;
  const centred = { top: clamp((viewport.height - card.height) / 2, margin, maxTop), left: clamp((viewport.width - card.width) / 2, margin, maxLeft), side: "center" as const };
  if (!target) return centred;

  const midX = target.left + target.width / 2 - card.width / 2;
  const midY = target.top + target.height / 2 - card.height / 2;
  const options: { side: Side; top: number; left: number; fits: boolean }[] = [
    { side: "bottom", top: target.top + target.height + gap, left: midX, fits: target.top + target.height + gap + card.height <= viewport.height - margin },
    { side: "top", top: target.top - gap - card.height, left: midX, fits: target.top - gap - card.height >= margin },
    { side: "right", top: midY, left: target.left + target.width + gap, fits: target.left + target.width + gap + card.width <= viewport.width - margin },
    { side: "left", top: midY, left: target.left - gap - card.width, fits: target.left - gap - card.width >= margin },
  ];
  const hit = options.find((o) => o.fits);
  if (!hit) return centred;
  return { side: hit.side, top: clamp(hit.top, margin, maxTop), left: clamp(hit.left, margin, maxLeft) };
}
