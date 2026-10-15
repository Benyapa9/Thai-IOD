import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * API tests for the access system (access-matrix phases 2, 3 and 5). They call
 * the real route handlers against the in-memory repository; only the session
 * (NextAuth) is replaced. Seed users: staff=Basic, manager=Standard, cfo=Advanced,
 * admin=IT, it=Basic (one department).
 */
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () => (session.userId ? { user: { id: session.userId } } : null),
}));

const as = (userId: string | null) => {
  session.userId = userId;
};
const req = (method: string, body?: unknown, url = "http://test.local/api") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

async function matrixVersion() {
  const { getRepo } = await import("@/server/repository");
  return (await (await getRepo()).access.snapshot()).version;
}

beforeEach(() => as(null));

describe("phase 2 — every API enforces features", () => {
  it("401 without a session", async () => {
    const { GET } = await import("@/app/api/insights/route");
    expect((await GET(req("GET"), undefined)).status).toBe(401);
  });

  it("Basic (staff) gets 403 on Standard / Advanced / IT APIs", async () => {
    as("staff");
    const thresholds = await import("@/app/api/alerts/thresholds/route");
    const commentary = await import("@/app/api/commentary/[period]/route");
    const scenarios = await import("@/app/api/scenarios/route");
    const issue = await import("@/app/api/issues/[id]/route");
    const matrix = await import("@/app/api/access/matrix/route");
    const users = await import("@/app/api/users/route");
    const chat = await import("@/app/api/ai/chat/route");

    const results = await Promise.all([
      commentary.PUT(req("PUT", { content: "x" }), ctx({ period: "2026-08" })), // commentary.write — Standard
      chat.POST(req("POST", { messages: [{ role: "user", content: "hi" }] }), undefined), // agent.chat — Standard
      thresholds.PUT(req("PUT", { thresholds: [] }), undefined), // thresholds.edit — Advanced
      scenarios.POST(req("POST", {}), undefined), // scenario.save — Advanced
      issue.DELETE(req("DELETE"), ctx({ id: "x" })), // issues.delete — IT
      matrix.GET(req("GET"), undefined), // access.tiers — IT
      users.PATCH(req("PATCH", { changes: [] }), undefined), // users.manage — IT
    ]);
    expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
  });

  it("Standard (manager) gets 403 on Advanced / IT APIs but passes its own", async () => {
    as("manager");
    const thresholds = await import("@/app/api/alerts/thresholds/route");
    const matrix = await import("@/app/api/access/matrix/route");
    const thresholdsGet = await thresholds.GET(req("GET", undefined, "http://test.local/api?dashboard=kpi"), undefined);
    expect(thresholdsGet.status).toBe(200); // thresholds.view — Standard
    expect((await thresholds.PUT(req("PUT", { thresholds: [] }), undefined)).status).toBe(403);
    expect((await matrix.GET(req("GET"), undefined)).status).toBe(403);
  });

  it("Advanced (cfo) cannot manage users or the matrix", async () => {
    as("cfo");
    const matrix = await import("@/app/api/access/matrix/route");
    const users = await import("@/app/api/users/route");
    expect((await matrix.GET(req("GET"), undefined)).status).toBe(403);
    expect((await users.PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "it" }] }), undefined)).status).toBe(403);
  });

  it("a deactivated user is refused even with a valid session", async () => {
    const { getRepo } = await import("@/server/repository");
    const repo = await getRepo();
    await repo.users.update("it", { isActive: false });
    as("it");
    const { GET } = await import("@/app/api/me/route");
    expect((await GET(req("GET"), undefined)).status).toBe(401);
    await repo.users.update("it", { isActive: true });
  });
});

describe("phase 3 — matrix API", () => {
  it("IT reads the matrix with tiers, features and user counts", async () => {
    as("admin");
    const { GET } = await import("@/app/api/access/matrix/route");
    const res = await GET(req("GET"), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tiers.map((t: { id: string }) => t.id)).toEqual(["basic", "standard", "advanced", "it"]);
    expect(body.features.length).toBeGreaterThan(20);
    expect(body.tiers.find((t: { id: string }) => t.id === "it").users).toBeGreaterThanOrEqual(1);
  });

  it("saves a diff, bumps the version and takes effect immediately", async () => {
    as("admin");
    const { PUT } = await import("@/app/api/access/matrix/route");
    const version = await matrixVersion();
    const res = await PUT(req("PUT", { version, changes: [{ tierId: "basic", featureKey: "report.export", effect: "allow" }] }), undefined);
    expect(res.status).toBe(200);
    expect((await res.json()).version).toBe(version + 1);

    // Basic can now export…
    const { featuresOf } = await import("@/server/access");
    const { getRepo } = await import("@/server/repository");
    const staff = (await (await getRepo()).users.findById("staff"))!;
    expect((await featuresOf(staff)).has("report.export")).toBe(true);
    // …and the change is in the audit log.
    expect((await (await getRepo()).access.auditLog(1))[0].action).toBe("matrix.update");

    // undo
    await PUT(req("PUT", { version: version + 1, changes: [{ tierId: "basic", featureKey: "report.export", effect: null }] }), undefined);
  });

  it("400 on invalid input", async () => {
    as("admin");
    const { PUT } = await import("@/app/api/access/matrix/route");
    const version = await matrixVersion();
    const bad = [
      { version, changes: [{ tierId: "boss", featureKey: "report.export", effect: "allow" }] },
      { version, changes: [{ tierId: "basic", featureKey: "nope.feature", effect: "allow" }] },
      { version, changes: [{ tierId: "basic", featureKey: "report.export", effect: "maybe" }] },
      { version, changes: [] },
      { changes: [{ tierId: "basic", featureKey: "report.export", effect: "allow" }] },
    ];
    for (const body of bad) expect((await PUT(req("PUT", body), undefined)).status).toBe(400);
  });

  it("409 when IT would lose user management or the matrix (self lock-out)", async () => {
    as("admin");
    const { PUT } = await import("@/app/api/access/matrix/route");
    const version = await matrixVersion();
    const res = await PUT(req("PUT", { version, changes: [{ tierId: "it", featureKey: "access.tiers", effect: "deny" }] }), undefined);
    expect(res.status).toBe(409);
    expect(await matrixVersion()).toBe(version); // nothing saved
  });

  it("409 when someone else saved first (stale version)", async () => {
    as("admin");
    const { PUT } = await import("@/app/api/access/matrix/route");
    const version = await matrixVersion();
    const res = await PUT(req("PUT", { version: version - 1 || 999, changes: [{ tierId: "basic", featureKey: "report.export", effect: "allow" }] }), undefined);
    expect(res.status).toBe(409);
  });
});

describe("phase 5 — users API", () => {
  it("changes a tier, bumps permVersion and audits", async () => {
    as("admin");
    const { PATCH } = await import("@/app/api/users/route");
    const { getRepo } = await import("@/server/repository");
    const repo = await getRepo();
    const before = (await repo.users.findById("staff"))!.permVersion;
    const res = await PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "standard" }] }), undefined);
    expect(res.status).toBe(200);
    const staff = (await repo.users.findById("staff"))!;
    expect(staff.tierId).toBe("standard");
    expect(staff.permVersion).toBe(before + 1);
    expect((await repo.access.auditLog(1))[0].action).toBe("users.update");
    await PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "basic" }] }), undefined);
  });

  it("bulk-changes several users in one call", async () => {
    as("admin");
    const { PATCH } = await import("@/app/api/users/route");
    const res = await PATCH(
      req("PATCH", { changes: [{ userId: "staff", tierId: "advanced" }, { userId: "manager", tierId: "advanced" }, { userId: "it", isActive: false }] }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(3);
    await PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "basic" }, { userId: "manager", tierId: "standard" }, { userId: "it", isActive: true }] }), undefined);
  });

  it("403 for your own row", async () => {
    as("admin");
    const { PATCH } = await import("@/app/api/users/route");
    expect((await PATCH(req("PATCH", { changes: [{ userId: "admin", tierId: "basic" }] }), undefined)).status).toBe(403);
    expect((await PATCH(req("PATCH", { changes: [{ userId: "admin", isActive: false }] }), undefined)).status).toBe(403);
  });

  it("409 when no active IT user would remain", async () => {
    // Let Advanced manage users (via the matrix), then an Advanced user tries to remove the only IT.
    as("admin");
    const matrix = await import("@/app/api/access/matrix/route");
    const { PATCH } = await import("@/app/api/users/route");
    const version = await matrixVersion();
    expect((await matrix.PUT(req("PUT", { version, changes: [{ tierId: "advanced", featureKey: "users.manage", effect: "allow" }] }), undefined)).status).toBe(200);

    as("cfo");
    const demote = await PATCH(req("PATCH", { changes: [{ userId: "admin", tierId: "advanced" }] }), undefined);
    expect(demote.status).toBe(409);
    const deactivate = await PATCH(req("PATCH", { changes: [{ userId: "admin", isActive: false }] }), undefined);
    expect(deactivate.status).toBe(409);
    // A change that keeps one IT is fine.
    expect((await PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "standard" }] }), undefined)).status).toBe(200);

    // restore
    await PATCH(req("PATCH", { changes: [{ userId: "staff", tierId: "basic" }] }), undefined);
    as("admin");
    await matrix.PUT(req("PUT", { version: version + 1, changes: [{ tierId: "advanced", featureKey: "users.manage", effect: null }] }), undefined);
  });

  it("400 on invalid input", async () => {
    as("admin");
    const { PATCH } = await import("@/app/api/users/route");
    for (const body of [{ changes: [] }, { changes: [{ userId: "staff" }] }, { changes: [{ userId: "staff", tierId: "god" }] }]) {
      expect((await PATCH(req("PATCH", body), undefined)).status).toBe(400);
    }
  });
});
