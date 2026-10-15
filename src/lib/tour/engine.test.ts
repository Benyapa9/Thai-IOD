import { describe, expect, it } from "vitest";
import { resolveEffectiveFeatures, defaultGrantMap } from "@/lib/access/engine";
import { nextIndex, placeCard, shouldAutoStart, spotlightRect, stepPosition, stepsFor } from "./engine";
import { MAIN_TOUR, type TourDef } from "./tours";

const VP = { width: 1280, height: 800 };
const CARD = { width: 380, height: 220 };

const featuresOf = (tier: "basic" | "standard" | "advanced" | "it") => [...resolveEffectiveFeatures(tier, defaultGrantMap())];

describe("stepsFor", () => {
  it("drops steps the user has no feature for", () => {
    const ids = (tier: "basic" | "standard" | "advanced" | "it") => stepsFor(MAIN_TOUR, featuresOf(tier)).map((s) => s.id);
    // Seed (access matrix): Basic can create Follow-ups; AI from Standard; admin only for IT.
    expect(ids("basic")).toContain("followUp");
    expect(ids("basic")).not.toContain("zyinsight");
    expect(ids("standard")).toContain("zyinsight");
    expect(ids("advanced")).not.toContain("admin");
    expect(ids("it")).toContain("admin");
  });

  it("keeps every tour within 6–9 steps for each level", () => {
    for (const tier of ["basic", "standard", "advanced", "it"] as const) {
      const n = stepsFor(MAIN_TOUR, featuresOf(tier)).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it("starts and ends with a centred card", () => {
    expect(MAIN_TOUR.steps[0].target).toBeNull();
    expect(MAIN_TOUR.steps.at(-1)?.target).toBeNull();
  });
});

describe("shouldAutoStart", () => {
  const tour: TourDef = { id: "main", version: 2, steps: [] };
  it("starts for a first-time user", () => expect(shouldAutoStart(tour, null, null)).toBe(true));
  it("does not start once this version was seen (server or browser)", () => {
    expect(shouldAutoStart(tour, { main: 2 }, null)).toBe(false);
    expect(shouldAutoStart(tour, {}, 2)).toBe(false);
  });
  it("starts again after the version is bumped", () => expect(shouldAutoStart(tour, { main: 1 }, 1)).toBe(true));
});

describe("nextIndex", () => {
  it("moves forward and back", () => {
    expect(nextIndex(5, 1, 1, new Set())).toBe(2);
    expect(nextIndex(5, 1, -1, new Set())).toBe(0);
  });
  it("skips steps whose element was missing", () => {
    expect(nextIndex(5, 1, 1, new Set([2, 3]))).toBe(4);
    expect(nextIndex(5, 4, -1, new Set([2, 3]))).toBe(1);
  });
  it("returns null past either end", () => {
    expect(nextIndex(5, 4, 1, new Set())).toBeNull();
    expect(nextIndex(5, 0, -1, new Set())).toBeNull();
  });
});

describe("stepPosition", () => {
  it("counts only steps that are shown", () => {
    expect(stepPosition(8, 0, new Set())).toEqual({ current: 1, total: 8 });
    expect(stepPosition(8, 4, new Set([2]))).toEqual({ current: 4, total: 7 });
  });
});

describe("placeCard", () => {
  const inside = (p: { top: number; left: number }) =>
    p.top >= 12 && p.left >= 12 && p.top + CARD.height <= VP.height - 12 && p.left + CARD.width <= VP.width - 12;

  it("centres the card when there is no target", () => {
    const p = placeCard(null, CARD, VP);
    expect(p.side).toBe("center");
    expect(p.left).toBe((VP.width - CARD.width) / 2);
  });

  it("puts the card below a target near the top", () => {
    const p = placeCard({ top: 60, left: 500, width: 200, height: 40 }, CARD, VP);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(60 + 40 + 14);
    expect(inside(p)).toBe(true);
  });

  it("flips above when there is no room below", () => {
    const p = placeCard({ top: 650, left: 500, width: 200, height: 60 }, CARD, VP);
    expect(p.side).toBe("top");
    expect(inside(p)).toBe(true);
  });

  it("goes beside a tall target", () => {
    const p = placeCard({ top: 20, left: 40, width: 300, height: 760 }, CARD, VP);
    expect(p.side).toBe("right");
    expect(inside(p)).toBe(true);
  });

  it("never runs off the screen edge", () => {
    const p = placeCard({ top: 100, left: 1240, width: 30, height: 30 }, CARD, VP);
    expect(inside(p)).toBe(true);
  });

  it("falls back to centred when nothing fits", () => {
    expect(placeCard({ top: 0, left: 0, width: 1280, height: 800 }, CARD, VP).side).toBe("center");
  });
});

describe("spotlightRect", () => {
  it("adds padding but stays on screen", () => {
    expect(spotlightRect({ top: 2, left: 2, width: 100, height: 50 }, VP)).toEqual({ top: 0, left: 0, width: 110, height: 60 });
  });
});
