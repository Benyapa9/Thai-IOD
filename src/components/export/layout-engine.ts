/**
 * Packs the selected charts onto 16:9 slides and positions them.
 * Each chart has a size: "full" (tables, wide charts — a slide of its own),
 * "half" (charts), "quarter" (KPI cards). A slide holds 4 units:
 * full = 4, half = 2, quarter = 1. Bigger items get proportionally more room.
 */
export type ChartSize = "full" | "half" | "quarter";

export const SLIDE_W = 1600;
export const SLIDE_H = 900;

const UNITS: Record<ChartSize, number> = { full: 4, half: 2, quarter: 1 };

export interface Cell {
  id: string;
  /** Position inside the slide's content area, in 0–1 fractions. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlidePlan {
  /** Chart ids on this slide, in reading order */
  ids: string[];
  cells: Cell[];
}

/** Group ids into slides, keeping the given order. */
export function packSlides(items: { id: string; size: ChartSize }[]): string[][] {
  const slides: string[][] = [];
  let current: { id: string; size: ChartSize }[] = [];
  let used = 0;
  for (const it of items) {
    const u = UNITS[it.size];
    if (current.length && (used + u > 4 || current.length === 4)) {
      slides.push(current.map((c) => c.id));
      current = [];
      used = 0;
    }
    current.push(it);
    used += u;
  }
  if (current.length) slides.push(current.map((c) => c.id));
  return slides;
}

/** Arrange the items of one slide in a balanced grid. */
export function arrange(items: { id: string; size: ChartSize }[]): Cell[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: items[0].id, x: 0, y: 0, w: 1, h: 1 }];
  if (n === 2) {
    // Side by side, width proportional to size (a half next to a quarter gets 2/3).
    const [a, b] = items;
    const wa = UNITS[a.size] / (UNITS[a.size] + UNITS[b.size]);
    return [
      { id: a.id, x: 0, y: 0, w: wa, h: 1 },
      { id: b.id, x: wa, y: 0, w: 1 - wa, h: 1 },
    ];
  }
  if (n === 3) {
    const bigIdx = items.findIndex((i) => i.size === "half");
    if (bigIdx >= 0) {
      // The big one takes a full column; the other two stack in the other column.
      const big = items[bigIdx];
      const rest = items.filter((_, i) => i !== bigIdx);
      const bigLeft = bigIdx === 0;
      return [
        { id: big.id, x: bigLeft ? 0 : 0.5, y: 0, w: 0.5, h: 1 },
        { id: rest[0].id, x: bigLeft ? 0.5 : 0, y: 0, w: 0.5, h: 0.5 },
        { id: rest[1].id, x: bigLeft ? 0.5 : 0, y: 0.5, w: 0.5, h: 0.5 },
      ];
    }
    return items.map((it, i) => ({ id: it.id, x: i / 3, y: 0, w: 1 / 3, h: 1 }));
  }
  // 4: 2 × 2
  return items.map((it, i) => ({ id: it.id, x: (i % 2) / 2, y: Math.floor(i / 2) / 2, w: 0.5, h: 0.5 }));
}

export function planSlides(items: { id: string; size: ChartSize }[]): SlidePlan[] {
  const bySize = new Map(items.map((i) => [i.id, i]));
  return packSlides(items).map((ids) => ({ ids, cells: arrange(ids.map((id) => bySize.get(id)!)) }));
}

/** Move slide `from` to position `to`; returns the new chart order. */
export function moveSlide(slides: string[][], from: number, to: number): string[] {
  const next = [...slides];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.flat();
}
