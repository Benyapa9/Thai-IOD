import { describe, expect, it } from "vitest";
import { DEFAULT_GRANTS, FEATURES, TIERS, type TierId } from "./catalog";
import {
  type GrantMap,
  applyChanges,
  cellState,
  clickCell,
  grantsFromRows,
  lockoutProblems,
  normalizeChanges,
  resolveEffectiveFeatures,
  setCell,
  tierChain,
  tierDelta,
} from "./engine";

const seed: GrantMap = Object.fromEntries(
  Object.entries(DEFAULT_GRANTS).map(([tier, keys]) => [tier, Object.fromEntries(keys.map((k) => [k, "allow"]))]),
) as GrantMap;

describe("inheritance", () => {
  it("walks Basic → Standard → Advanced → IT", () => {
    expect(tierChain("it").map((t) => t.id)).toEqual(["basic", "standard", "advanced", "it"]);
    expect(tierChain("basic").map((t) => t.id)).toEqual(["basic"]);
  });

  it("higher tiers inherit everything below", () => {
    const basic = resolveEffectiveFeatures("basic", seed);
    const standard = resolveEffectiveFeatures("standard", seed);
    expect(basic.has("dashboard.view")).toBe(true);
    expect(standard.has("dashboard.view")).toBe(true);
    expect(standard.has("commentary.write")).toBe(true);
    expect(basic.has("commentary.write")).toBe(false);
  });

  it("IT ends up with every feature in the seed", () => {
    expect(resolveEffectiveFeatures("it", seed).size).toBe(FEATURES.length);
  });

  it("seed counts per tier", () => {
    const n = (t: TierId) => resolveEffectiveFeatures(t, seed).size;
    expect(n("basic")).toBe(DEFAULT_GRANTS.basic.length);
    expect(n("standard")).toBe(DEFAULT_GRANTS.basic.length + DEFAULT_GRANTS.standard.length);
    expect(n("it")).toBe(FEATURES.length);
  });
});

describe("exceptions (deny)", () => {
  it("a deny on a closer tier beats the inherited allow", () => {
    const g = applyChanges(seed, [{ tierId: "standard", featureKey: "upload.create", effect: "deny" }]);
    expect(resolveEffectiveFeatures("basic", g).has("upload.create")).toBe(true);
    expect(resolveEffectiveFeatures("standard", g).has("upload.create")).toBe(false);
    // …and it is inherited further down the chain
    expect(resolveEffectiveFeatures("advanced", g).has("upload.create")).toBe(false);
  });

  it("an allow on an even closer tier wins again", () => {
    const g = applyChanges(seed, [
      { tierId: "standard", featureKey: "upload.create", effect: "deny" },
      { tierId: "it", featureKey: "upload.create", effect: "allow" },
    ]);
    expect(resolveEffectiveFeatures("advanced", g).has("upload.create")).toBe(false);
    expect(resolveEffectiveFeatures("it", g).has("upload.create")).toBe(true);
  });
});

describe("defaults", () => {
  it("anything not specified is denied", () => {
    expect(resolveEffectiveFeatures("it", {}).size).toBe(0);
    expect(resolveEffectiveFeatures("basic", seed).has("users.manage")).toBe(false);
  });

  it("no tier means no features", () => {
    expect(resolveEffectiveFeatures(null, seed).size).toBe(0);
    expect(resolveEffectiveFeatures(undefined, seed).size).toBe(0);
  });

  it("ignores unknown tiers and features in stored rows", () => {
    const g = grantsFromRows([
      { tierId: "basic", featureKey: "dashboard.view", effect: "allow" },
      { tierId: "ghost", featureKey: "dashboard.view", effect: "allow" },
      { tierId: "basic", featureKey: "nope.feature", effect: "allow" },
      { tierId: "basic", featureKey: "insights.view", effect: "maybe" },
    ]);
    expect(g).toEqual({ basic: { "dashboard.view": "allow" } });
  });
});

describe("matrix cells", () => {
  it("click cycles: none → allow → none, inherited → deny → inherited", () => {
    const none = cellState("basic", "users.manage", seed);
    expect(none).toEqual({ explicit: null, inherited: false, effective: false });
    expect(clickCell(none)).toBe("allow");

    const inherited = cellState("standard", "dashboard.view", seed);
    expect(inherited).toEqual({ explicit: null, inherited: true, effective: true });
    expect(clickCell(inherited)).toBe("deny");

    const denied = cellState("standard", "dashboard.view", applyChanges(seed, [{ tierId: "standard", featureKey: "dashboard.view", effect: "deny" }]));
    expect(denied.effective).toBe(false);
    expect(clickCell(denied)).toBeNull();
  });

  it("group on/off respects inheritance", () => {
    const inherited = cellState("standard", "dashboard.view", seed);
    expect(setCell(inherited, true)).toBeNull();
    expect(setCell(inherited, false)).toBe("deny");
    const none = cellState("basic", "users.manage", seed);
    expect(setCell(none, true)).toBe("allow");
    expect(setCell(none, false)).toBeNull();
  });

  it("normalizeChanges drops no-ops and keeps the last change per cell", () => {
    const changes = normalizeChanges(seed, [
      { tierId: "basic", featureKey: "dashboard.view", effect: "allow" }, // already allowed
      { tierId: "basic", featureKey: "report.export", effect: "allow" },
      { tierId: "basic", featureKey: "report.export", effect: null }, // undone
      { tierId: "standard", featureKey: "upload.create", effect: "deny" },
    ]);
    expect(changes).toEqual([{ tierId: "standard", featureKey: "upload.create", effect: "deny" }]);
  });
});

describe("lockout protection", () => {
  it("passes with the seed", () => expect(lockoutProblems(seed)).toEqual([]));

  it("flags IT losing user management or the matrix", () => {
    const g = applyChanges(seed, [{ tierId: "it", featureKey: "access.tiers", effect: null }]);
    expect(lockoutProblems(g)).toEqual(["access.tiers"]);
    const viaDeny = applyChanges(seed, [{ tierId: "it", featureKey: "users.manage", effect: "deny" }]);
    expect(lockoutProblems(viaDeny)).toEqual(["users.manage"]);
  });
});

describe("tierDelta", () => {
  it("reports what a tier gains and loses", () => {
    const after = applyChanges(seed, [
      { tierId: "basic", featureKey: "builder.use", effect: "allow" },
      { tierId: "standard", featureKey: "upload.create", effect: "deny" },
    ]);
    expect(tierDelta("basic", seed, after)).toMatchObject({ added: ["builder.use"], removed: [] });
    expect(tierDelta("standard", seed, after)).toMatchObject({ added: [], removed: ["upload.create"] });
    expect(TIERS.length).toBe(4);
  });
});
