import { beforeEach, describe, expect, it, vi } from "vitest";

/* Personal notes are private: only their author can list, change or delete them. */
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () => (session.userId ? { user: { id: session.userId } } : null),
}));
const as = (userId: string | null) => {
  session.userId = userId;
};
const req = (method: string, body?: unknown) =>
  new Request("http://test.local/api/notes", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => as(null));

describe("personal notes API", () => {
  it("401 without a session", async () => {
    const { GET } = await import("@/app/api/notes/route");
    expect((await GET(req("GET"), undefined)).status).toBe(401);
  });

  it("creates a note with an optional due date and lists only my own", async () => {
    const notes = await import("@/app/api/notes/route");
    as("staff");
    const res = await notes.POST(req("POST", { content: "ติดตามงบ CAC", dueDate: "2026-10-31", page: "/dashboard/main/kpi" }), undefined);
    expect(res.status).toBe(201);
    const { note } = await res.json();
    expect(note).toMatchObject({ content: "ติดตามงบ CAC", dueDate: "2026-10-31", done: false });

    as("manager");
    const other = await (await notes.GET(req("GET"), undefined)).json();
    expect(other.notes.some((n: { id: string }) => n.id === note.id)).toBe(false);

    as("staff");
    const mine = await (await notes.GET(req("GET"), undefined)).json();
    expect(mine.notes[0].id).toBe(note.id);
  });

  it("someone else cannot tick, edit or delete my note (404)", async () => {
    const notes = await import("@/app/api/notes/route");
    const one = await import("@/app/api/notes/[id]/route");
    as("staff");
    const { note } = await (await notes.POST(req("POST", { content: "ส่วนตัว" }), undefined)).json();

    as("admin");
    expect((await one.PATCH(req("PATCH", { done: true }), ctx(note.id))).status).toBe(404);
    expect((await one.DELETE(req("DELETE"), ctx(note.id))).status).toBe(404);

    as("staff");
    const done = await one.PATCH(req("PATCH", { done: true }), ctx(note.id));
    expect((await done.json()).note.done).toBe(true);
    expect((await one.DELETE(req("DELETE"), ctx(note.id))).status).toBe(204);
  });

  it("400 on empty text, bad date or unknown fields", async () => {
    const notes = await import("@/app/api/notes/route");
    as("staff");
    for (const body of [{ content: "  " }, { content: "x", dueDate: "31/10/2026" }, { content: "x", userId: "admin" }]) {
      expect((await notes.POST(req("POST", body), undefined)).status).toBe(400);
    }
  });
});
