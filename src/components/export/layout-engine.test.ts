import { describe, expect, it } from "vitest";
import { type ChartSize, arrange, moveSlide, packSlides, planSlides } from "./layout-engine";

const it_ = (id: string, size: ChartSize) => ({ id, size });

describe("export layout engine", () => {
  it("1 chart fills the slide", () => {
    expect(arrange([it_("a", "half")])).toEqual([{ id: "a", x: 0, y: 0, w: 1, h: 1 }]);
  });

  it("2 charts split the slide side by side; a half next to a quarter gets 2/3", () => {
    const [a, b] = arrange([it_("a", "half"), it_("b", "half")]);
    expect([a.w, b.x, b.w]).toEqual([0.5, 0.5, 0.5]);
    const [c, d] = arrange([it_("c", "half"), it_("d", "quarter")]);
    expect(c.w).toBeCloseTo(2 / 3);
    expect(d.w).toBeCloseTo(1 / 3);
  });

  it("3 items: the big one gets a full column, the others stack", () => {
    const cells = arrange([it_("big", "half"), it_("q1", "quarter"), it_("q2", "quarter")]);
    expect(cells[0]).toEqual({ id: "big", x: 0, y: 0, w: 0.5, h: 1 });
    expect(cells.slice(1).map((c) => [c.x, c.y, c.h])).toEqual([
      [0.5, 0, 0.5],
      [0.5, 0.5, 0.5],
    ]);
  });

  it("4 quarters make a 2 × 2 grid", () => {
    const cells = arrange(["a", "b", "c", "d"].map((id) => it_(id, "quarter")));
    expect(cells.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [0.5, 0],
      [0, 0.5],
      [0.5, 0.5],
    ]);
  });

  it("tables / full-size charts get a slide of their own; order is kept", () => {
    const slides = packSlides([it_("q1", "quarter"), it_("t", "full"), it_("h1", "half"), it_("h2", "half"), it_("h3", "half")]);
    expect(slides).toEqual([["q1"], ["t"], ["h1", "h2"], ["h3"]]);
  });

  it("every cell stays inside the slide", () => {
    for (const plan of planSlides(["a", "b", "c", "d", "e", "f", "g"].map((id, i) => it_(id, i % 3 === 0 ? "half" : "quarter")))) {
      for (const c of plan.cells) {
        expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("moving a slide moves all of its charts together", () => {
    expect(moveSlide([["a", "b"], ["c"], ["d"]], 2, 0)).toEqual(["d", "a", "b", "c"]);
  });
});
