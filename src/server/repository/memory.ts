import type {
  AlertThreshold,
  Commentary,
  Feedback,
  FinancialRecord,
  InsightRating,
  PersonalNote,
  IssueLog,
  Scenario,
  Upload,
  UsageEvent,
  User,
} from "@/types/domain";
import type { DatasetSnapshot } from "@/types/dataset";
import { SEED_UPLOAD_ID, seedCommentary, seedFinancial, seedIssues, seedThresholds, seedUsers } from "./seed";
import { tierFromLegacyRole } from "@/lib/access/catalog";
import { defaultGrantMap, applyChanges, normalizeChanges } from "@/lib/access/engine";
import { DERIVED_UPLOAD_ID, type AccessAuditEntry, type AccessSnapshot, type Repository, emptySnapshot, roleForTier } from "./types";

interface Store {
  users: User[];
  uploads: Upload[];
  records: FinancialRecord[];
  issues: IssueLog[];
  commentary: Commentary[];
  thresholds: AlertThreshold[];
  scenarios: Scenario[];
  feedback: Feedback[];
  ratings: InsightRating[];
  notes: PersonalNote[];
  usage: UsageEvent[];
  dataset: DatasetSnapshot;
  access: AccessSnapshot;
  accessAudit: AccessAuditEntry[];
}

function createStore(): Store {
  // With a real data folder configured, skip the illustrative sample figures
  // (and the sample issues/commentary that describe them).
  const realData = !!process.env.DATA_IMPORT_DIR;
  const { upload, records } = seedFinancial();
  return {
    users: structuredClone(seedUsers),
    uploads: realData ? [] : [upload],
    records: realData ? [] : records,
    issues: realData ? [] : structuredClone(seedIssues),
    commentary: realData ? [] : structuredClone(seedCommentary),
    thresholds: structuredClone(seedThresholds),
    scenarios: [],
    feedback: [],
    ratings: [],
    notes: [],
    usage: [],
    dataset: emptySnapshot(),
    access: { grants: defaultGrantMap(), version: 1 },
    accessAudit: [],
  };
}

// Survive Next.js dev hot reloads: one store per server process (fixed key,
// see ./index). Restart the dev server after changing the store shape.
const g = globalThis as unknown as { __iodMemoryData?: Store };
const store = (g.__iodMemoryData ??= createStore());
// A dev server started before the access-matrix fields existed keeps its old store across HMR; fill them in.
const legacy = store as Store & { accessMigrated?: boolean };
if (!legacy.accessMigrated) {
  legacy.accessMigrated = true;
  store.access ??= { grants: defaultGrantMap(), version: 1 };
  store.accessAudit ??= [];
  for (const u of store.users) {
    u.tierId = seedUsers.find((s) => s.id === u.id)?.tierId ?? tierFromLegacyRole(u.role);
    u.permVersion = 1;
  }
}
store.notes ??= []; // added after the access matrix; same reason as above

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Keep existing rows, replace those whose key appears in `incoming`, append the rest. */
export function upsertBy<T>(existing: T[], incoming: T[], key: (row: T) => string): T[] {
  const keys = new Set(incoming.map(key));
  return [...existing.filter((row) => !keys.has(key(row))), ...incoming];
}

function mustFind<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`Not found: ${id}`);
  return item;
}

export const memoryRepository: Repository = {
  users: {
    async list() {
      return [...store.users];
    },
    async findById(id) {
      return store.users.find((u) => u.id === id) ?? null;
    },
    async upsertFromEntra({ entraId, email, name }) {
      const existing = store.users.find((u) => u.entraId === entraId || u.email === email);
      if (existing) {
        Object.assign(existing, {
          entraId,
          email,
          name,
          updatedAt: new Date(),
        });
        return existing;
      }
      const created: User = {
        id: newId("user"),
        entraId,
        email,
        name,
        role: "basic", // MOM A3: new users start as Basic
        tierId: "basic",
        permVersion: 1,
        department: null,
        departments: null,
        jobTitle: null,
        image: null,
        consent: null,
        tourSeen: null,
        theme: "navy",
        locale: "th",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.users.push(created);
      return created;
    },
    async update(id, patch) {
      const u = mustFind(store.users, id);
      Object.assign(u, patch, { updatedAt: new Date() });
      return u;
    },
    async listByRoles(roles) {
      return store.users.filter((u) => u.isActive && roles.includes(u.role));
    },
    async applyAccessChanges(changes, actorId) {
      // All-or-nothing: validate every row first, then apply.
      const targets = changes.map((c) => mustFind(store.users, c.userId));
      const before = targets.map((u) => ({
        id: u.id,
        tierId: u.tierId,
        isActive: u.isActive,
      }));
      const now = new Date();
      changes.forEach((c, i) => {
        const u = targets[i];
        if (c.tierId !== undefined) Object.assign(u, { tierId: c.tierId, role: roleForTier(c.tierId) });
        if (c.isActive !== undefined) u.isActive = c.isActive;
        u.permVersion += 1;
        u.updatedAt = now;
      });
      store.accessAudit.unshift({
        id: newId("audit"),
        actorId,
        action: "users.update",
        before: JSON.stringify(before),
        after: JSON.stringify(
          targets.map((u) => ({
            id: u.id,
            tierId: u.tierId,
            isActive: u.isActive,
          })),
        ),
        createdAt: now,
      });
      return targets;
    },
  },
  uploads: {
    async list() {
      return store.uploads
        .map((u) => ({
          ...u,
          recordCount: store.records.filter((r) => r.uploadId === u.id).length,
        }))
        .sort((a, b) => +b.createdAt - +a.createdAt);
    },
    async create(input, records) {
      const upload: Upload = {
        ...input,
        id: newId("upload"),
        processedAt: new Date(),
        createdAt: new Date(),
        recordCount: records.length,
      };
      store.uploads.push(upload);
      // A newer upload replaces existing rows for the same period/category/type.
      const keys = new Set(records.map((r) => `${r.period}|${r.category}|${r.type}`));
      store.records = store.records.filter((r) => !keys.has(`${r.period}|${r.category}|${r.type}`));
      for (const r of records) {
        store.records.push({
          ...r,
          id: newId("rec"),
          uploadId: upload.id,
          createdAt: new Date(),
        });
      }
      return upload;
    },
    async delete(id) {
      store.uploads = store.uploads.filter((u) => u.id !== id);
      store.records = store.records.filter((r) => r.uploadId !== id);
    },
  },
  financial: {
    async list(filter = {}) {
      return store.records
        .filter(
          (r) =>
            (!filter.period || r.period === filter.period) &&
            (!filter.periodFrom || r.period >= filter.periodFrom) &&
            (!filter.periodTo || r.period <= filter.periodTo) &&
            (!filter.category || r.category === filter.category) &&
            (!filter.type || r.type === filter.type),
        )
        .sort((a, b) => a.period.localeCompare(b.period));
    },
    async replaceDerived(records) {
      const drop = new Set([SEED_UPLOAD_ID, DERIVED_UPLOAD_ID]);
      store.uploads = store.uploads.filter((u) => !drop.has(u.id));
      store.records = store.records.filter((r) => !drop.has(r.uploadId));
      const now = new Date();
      store.uploads.push({
        id: DERIVED_UPLOAD_ID,
        filename: "system/derived-from-datasets",
        originalName: "(คำนวณจากไฟล์ต้นทาง)",
        blobUrl: "system://derived",
        sizeBytes: 0,
        uploadedBy: "system",
        processedAt: now,
        createdAt: now,
        recordCount: records.length,
      });
      for (const r of records) {
        store.records.push({
          ...r,
          id: newId("rec"),
          uploadId: DERIVED_UPLOAD_ID,
          createdAt: now,
        });
      }
    },
  },
  dataset: {
    async applyBatch(batch) {
      const d = store.dataset;
      switch (batch.kind) {
        case "gl":
          d.gl = [...d.gl.filter((t) => !batch.periods.includes(t.period)), ...batch.rows];
          break;
        // MOM U5: new data is added to what is already there; only rows with the
        // same key (or the same GL / activity month) are refreshed.
        case "budgetLines":
          d.budgetLines = upsertBy(d.budgetLines, batch.rows, (l) => `${l.year}|${l.budgetCode}`);
          break;
        case "activities":
          d.activities = [...d.activities.filter((a) => a.source !== batch.source || !batch.periods.includes(a.period)), ...batch.rows];
          break;
        case "budgetProgress":
          d.budgetProgress = upsertBy(d.budgetProgress, batch.rows, (p) => p.budgetCode);
          break;
        case "accountMap":
          d.accountMap = upsertBy(d.accountMap, batch.rows, (a) => `${a.accountCode}|${a.courseCode}`);
          break;
        case "pnlLines":
          d.pnlLines = upsertBy(d.pnlLines, batch.rows, (p) => `${p.sort1}|${p.sort2}|${p.sort3}`);
          break;
        case "departments":
          d.departments = upsertBy(d.departments, batch.rows, (x) => x.code);
          break;
        case "memberStats":
          d.memberStats = upsertBy(d.memberStats, batch.rows, (m) => `${m.memberType}|${m.year}|${m.month}`);
          break;
      }
    },
    async snapshot() {
      return store.dataset;
    },
  },
  issues: {
    async list(filter = {}) {
      return store.issues
        .filter(
          (i) =>
            (!filter.status || i.status === filter.status) &&
            (!filter.severity || i.severity === filter.severity) &&
            (!filter.ownerId || i.ownerId === filter.ownerId),
        )
        .sort((a, b) => +b.createdAt - +a.createdAt);
    },
    async get(id) {
      return store.issues.find((i) => i.id === id) ?? null;
    },
    async create(input) {
      const issue: IssueLog = {
        plan: null,
        approach: null,
        sourceInsightId: null,
        metricLabel: null,
        baselineValue: null,
        ...input,
        outcome: null,
        outcomeResult: "pending",
        id: newId("issue"),
        status: "open",
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.issues.push(issue);
      return issue;
    },
    async update(id, patch) {
      const issue = mustFind(store.issues, id);
      Object.assign(issue, patch, { updatedAt: new Date() });
      if (patch.status) {
        issue.resolvedAt = patch.status === "resolved" || patch.status === "closed" ? new Date() : null;
      }
      return issue;
    },
    async delete(id) {
      store.issues = store.issues.filter((i) => i.id !== id);
    },
  },
  commentary: {
    async get(period) {
      return store.commentary.find((c) => c.period === period) ?? null;
    },
    async upsert(period, content, authorId) {
      const existing = store.commentary.find((c) => c.period === period);
      if (existing) {
        Object.assign(existing, { content, authorId, updatedAt: new Date() });
        return existing;
      }
      const created: Commentary = {
        id: newId("comm"),
        period,
        content,
        authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.commentary.push(created);
      return created;
    },
  },
  thresholds: {
    async list(dashboard) {
      return store.thresholds.filter((t) => !dashboard || t.dashboard === dashboard);
    },
    async upsertMany(items, updatedBy) {
      for (const item of items) {
        const existing = store.thresholds.find((t) => t.dashboard === item.dashboard && t.metric === item.metric);
        if (existing) Object.assign(existing, item, { updatedBy, updatedAt: new Date() });
        else
          store.thresholds.push({
            ...item,
            id: newId("th"),
            updatedBy,
            updatedAt: new Date(),
          });
      }
      return [...store.thresholds];
    },
  },
  scenarios: {
    async list() {
      return [...store.scenarios].sort((a, b) => +b.createdAt - +a.createdAt);
    },
    async get(id) {
      return store.scenarios.find((s) => s.id === id) ?? null;
    },
    async create(input) {
      const s: Scenario = { ...input, id: newId("scn"), createdAt: new Date() };
      store.scenarios.push(s);
      return s;
    },
    async update(id, patch) {
      const s = mustFind(store.scenarios, id);
      Object.assign(s, patch);
      return s;
    },
    async delete(id) {
      store.scenarios = store.scenarios.filter((s) => s.id !== id);
    },
  },
  feedback: {
    async list(filter = {}) {
      return store.feedback
        .filter((f) => (!filter.type || filter.type.includes(f.type)) && (!filter.createdBy || f.createdBy === filter.createdBy))
        .sort((a, b) => +b.createdAt - +a.createdAt);
    },
    async create(input) {
      const f: Feedback = {
        ...input,
        id: newId("fb"),
        status: "open",
        createdAt: new Date(),
      };
      store.feedback.push(f);
      return f;
    },
    async update(id, patch) {
      const f = mustFind(store.feedback, id);
      Object.assign(f, patch);
      return f;
    },
  },
  notes: {
    async list(userId) {
      return store.notes.filter((n) => n.userId === userId).sort((a, b) => +b.createdAt - +a.createdAt);
    },
    async create(input) {
      const now = new Date();
      const n: PersonalNote = { ...input, id: newId("note"), done: false, createdAt: now, updatedAt: now };
      store.notes.push(n);
      return n;
    },
    async update(userId, id, patch) {
      const n = store.notes.find((x) => x.id === id && x.userId === userId);
      if (!n) return null;
      Object.assign(n, patch, { updatedAt: new Date() });
      return n;
    },
    async remove(userId, id) {
      const i = store.notes.findIndex((x) => x.id === id && x.userId === userId);
      if (i < 0) return false;
      store.notes.splice(i, 1);
      return true;
    },
  },
  ratings: {
    async list(userId) {
      return store.ratings.filter((r) => !userId || r.userId === userId);
    },
    async upsert(input) {
      const existing = store.ratings.find((r) => r.userId === input.userId && r.insightKey === input.insightKey);
      if (existing) {
        Object.assign(existing, input, { createdAt: new Date() });
        return existing;
      }
      const r: InsightRating = {
        ...input,
        id: newId("rt"),
        createdAt: new Date(),
      };
      store.ratings.push(r);
      return r;
    },
  },
  usage: {
    async record(input) {
      store.usage.push({ ...input, id: newId("use"), createdAt: new Date() });
      if (store.usage.length > 50_000) store.usage.splice(0, store.usage.length - 50_000);
    },
    async list(since) {
      return store.usage.filter((u) => !since || u.createdAt >= since);
    },
  },
  access: {
    async snapshot() {
      return store.access;
    },
    async applyGrantChanges(changes, actorId, expectedVersion) {
      if (store.access.version !== expectedVersion) return null;
      const effective = normalizeChanges(store.access.grants, changes);
      if (!effective.length) return store.access;
      const before = store.access.grants;
      // Replace (not mutate) so cached readers see a new object.
      store.access = {
        grants: applyChanges(before, effective),
        version: store.access.version + 1,
      };
      store.accessAudit.unshift({
        id: newId("audit"),
        actorId,
        action: "matrix.update",
        before: JSON.stringify(
          effective.map((c) => ({
            ...c,
            effect: before[c.tierId]?.[c.featureKey] ?? null,
          })),
        ),
        after: JSON.stringify(effective),
        createdAt: new Date(),
      });
      return store.access;
    },
    async auditLog(limit = 50) {
      return store.accessAudit.slice(0, limit);
    },
  },
};
