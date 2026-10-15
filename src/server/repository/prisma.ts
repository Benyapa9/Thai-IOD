import type {
  AlertThreshold as DbThreshold,
  Feedback as DbFeedback,
  InsightRating as DbRating,
  IssueLog as DbIssue,
  Scenario as DbScenario,
  User as DbUser,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AlertThreshold, Feedback, FinancialRecord, InsightRating, IssueLog, PersonalNote, Scenario, User } from "@/types/domain";
import type { ActivitySource, DatasetSnapshot } from "@/types/dataset";
import { FEATURES, FEATURE_BY_KEY, TIERS, tierFromLegacyRole } from "@/lib/access/catalog";
import { type GrantMap, defaultGrantMap, grantsFromRows, normalizeChanges } from "@/lib/access/engine";
import { DERIVED_UPLOAD_ID, type AccessAuditEntry, type AccessSnapshot, type Repository, type UserPatch, NoActiveItError, roleForTier } from "./types";
import { SEED_UPLOAD_ID } from "./seed";

/** SQL Server caps a statement at 2,100 parameters — work in small chunks. */
async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

const parse = <T>(s: string | null): T | null => (s ? (JSON.parse(s) as T) : null);

// Azure SQL stores enums and JSON as plain strings; convert at the boundary.
const toUser = (u: DbUser): User => ({
  ...(u as unknown as User),
  departments: parse<string[]>(u.departments),
  consent: parse(u.consent),
  tourSeen: parse<Record<string, number>>(u.tourSeen),
});
const userData = (patch: UserPatch) => ({
  ...patch,
  departments: patch.departments === undefined ? undefined : patch.departments === null ? null : JSON.stringify(patch.departments),
  consent: patch.consent === undefined ? undefined : patch.consent === null ? null : JSON.stringify(patch.consent),
  tourSeen: patch.tourSeen === undefined ? undefined : patch.tourSeen === null ? null : JSON.stringify(patch.tourSeen),
});
const toIssue = (i: DbIssue) => i as IssueLog;
const toThreshold = (t: DbThreshold) => t as AlertThreshold;
const toFeedback = (f: DbFeedback) => f as Feedback;
const toRating = (r: DbRating) => r as InsightRating;
const toScenario = (s: DbScenario): Scenario => ({
  ...s,
  levers: JSON.parse(s.levers),
  projections: JSON.parse(s.projections),
});

/*
 * Dataset snapshot cache (per server instance). Cleared on every upload here; the
 * TTL covers other instances (e.g. scaled-out web apps) picking up new uploads.
 */
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const snapshotCache = globalThis as unknown as {
  __iodSnapshot?: { at: number; data: DatasetSnapshot };
};

/*
 * Access tables are seeded / synced from src/lib/access/catalog.ts once per
 * process (idempotent): features and tiers are upserted, the default matrix is
 * written only when the table is empty, and users without a tier are migrated
 * from their old role (staff→Basic, manager→Standard, cfo→Advanced, admin→IT).
 */
const accessSeed = globalThis as unknown as { __iodAccessSeed?: Promise<void> };
function ensureAccessSeed() {
  accessSeed.__iodAccessSeed ??= (async () => {
    for (const t of [...TIERS].sort((a, b) => a.level - b.level)) {
      await prisma.tier.upsert({
        where: { id: t.id },
        update: {
          name: t.name,
          level: t.level,
          inheritsFromId: t.inheritsFromId,
        },
        create: {
          id: t.id,
          name: t.name,
          level: t.level,
          inheritsFromId: t.inheritsFromId,
        },
      });
    }
    for (const f of FEATURES) {
      await prisma.feature.upsert({
        where: { key: f.key },
        update: {
          name: f.name,
          groupKey: f.groupKey,
          route: f.route,
          sortOrder: f.sortOrder,
        },
        create: {
          key: f.key,
          name: f.name,
          groupKey: f.groupKey,
          route: f.route,
          sortOrder: f.sortOrder,
        },
      });
    }
    if ((await prisma.tierFeature.count()) === 0) {
      const ids = new Map((await prisma.feature.findMany()).map((x) => [x.key, x.id]));
      const rows = Object.entries(defaultGrantMap()).flatMap(([tierId, row]) =>
        Object.entries(row ?? {}).map(([key, effect]) => ({
          tierId,
          featureId: ids.get(key)!,
          effect: effect as string,
        })),
      );
      await prisma.tierFeature.createMany({ data: rows });
    }
    await prisma.accessState.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global", version: 1 },
    });
    for (const u of await prisma.user.findMany({
      where: { tierId: null },
      select: { id: true, role: true },
    })) {
      await prisma.user.update({
        where: { id: u.id },
        data: { tierId: tierFromLegacyRole(u.role) },
      });
    }
  })().catch((err) => {
    accessSeed.__iodAccessSeed = undefined;
    throw err;
  });
  return accessSeed.__iodAccessSeed;
}

/** Grants cached per access version — only the version row is read on each request. */
const accessCache = globalThis as unknown as {
  __iodAccessCache?: AccessSnapshot;
};
async function readAccess(): Promise<AccessSnapshot> {
  await ensureAccessSeed();
  const state = await prisma.accessState.findUnique({
    where: { id: "global" },
  });
  const version = state?.version ?? 1;
  const cached = accessCache.__iodAccessCache;
  if (cached && cached.version === version) return cached;
  const rows = await prisma.tierFeature.findMany({
    include: { feature: { select: { key: true } } },
  });
  const grants: GrantMap = grantsFromRows(
    rows.map((r) => ({
      tierId: r.tierId,
      featureKey: r.feature.key,
      effect: r.effect,
    })),
  );
  return (accessCache.__iodAccessCache = { grants, version });
}

const toAudit = (a: { id: string; actorId: string; action: string; before: string; after: string; createdAt: Date }) => a as AccessAuditEntry;

export const prismaRepository: Repository = {
  users: {
    async list() {
      return (await prisma.user.findMany({ orderBy: { name: "asc" } })).map(toUser);
    },
    async findById(id) {
      const u = await prisma.user.findUnique({ where: { id } });
      return u ? toUser(u) : null;
    },
    async upsertFromEntra({ entraId, email, name }) {
      await ensureAccessSeed(); // the Basic tier row must exist first
      return toUser(
        await prisma.user.upsert({
          where: { entraId },
          update: { email, name },
          create: { entraId, email, name, role: "basic", tierId: "basic" }, // new users start as Basic
        }),
      );
    },
    async update(id, patch) {
      return toUser(await prisma.user.update({ where: { id }, data: userData(patch) }));
    },
    async listByRoles(roles) {
      return (
        await prisma.user.findMany({
          where: { isActive: true, role: { in: roles } },
        })
      ).map(toUser);
    },
    async applyAccessChanges(changes, actorId) {
      await ensureAccessSeed();
      return prisma.$transaction(async (tx) => {
        const before = await tx.user.findMany({
          where: { id: { in: changes.map((c) => c.userId) } },
          select: { id: true, tierId: true, isActive: true },
        });
        if (before.length !== new Set(changes.map((c) => c.userId)).size) throw new Error("Not found: user");
        const updated: User[] = [];
        for (const c of changes) {
          updated.push(
            toUser(
              await tx.user.update({
                where: { id: c.userId },
                data: {
                  ...(c.tierId !== undefined ? { tierId: c.tierId, role: roleForTier(c.tierId) } : {}),
                  ...(c.isActive !== undefined ? { isActive: c.isActive } : {}),
                  permVersion: { increment: 1 },
                },
              }),
            ),
          );
        }
        // Re-checked inside the transaction so two admins demoting different IT users at once cannot both succeed.
        if ((await tx.user.count({ where: { tierId: "it", isActive: true } })) < 1) throw new NoActiveItError();
        await tx.accessAuditLog.create({
          data: {
            actorId,
            action: "users.update",
            before: JSON.stringify(before),
            after: JSON.stringify(
              updated.map((u) => ({
                id: u.id,
                tierId: u.tierId,
                isActive: u.isActive,
              })),
            ),
          },
        });
        return updated;
      });
    },
  },
  uploads: {
    async list() {
      const rows = await prisma.upload.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { records: true } } },
      });
      return rows.map(({ _count, ...u }) => ({
        ...u,
        recordCount: _count.records,
      }));
    },
    async create(input, records) {
      return prisma.$transaction(async (tx) => {
        const upload = await tx.upload.create({
          data: { ...input, processedAt: new Date() },
        });
        // A newer upload replaces existing rows for the same period/category/type.
        const keys = [...new Map(records.map((r) => [`${r.period}|${r.category}|${r.type}`, r])).values()];
        await inChunks(keys, 200, (chunk) =>
          tx.financialRecord.deleteMany({
            where: {
              OR: chunk.map((r) => ({
                period: r.period,
                category: r.category,
                type: r.type,
              })),
            },
          }),
        );
        await inChunks(records, 200, (chunk) =>
          tx.financialRecord.createMany({
            data: chunk.map((r) => ({ ...r, uploadId: upload.id })),
          }),
        );
        return { ...upload, recordCount: records.length };
      });
    },
    async delete(id) {
      await prisma.upload.delete({ where: { id } });
    },
  },
  financial: {
    async list(filter = {}) {
      const rows = await prisma.financialRecord.findMany({
        where: {
          period: filter.period ?? {
            gte: filter.periodFrom,
            lte: filter.periodTo,
          },
          category: filter.category,
          type: filter.type,
        },
        orderBy: { period: "asc" },
      });
      return rows as FinancialRecord[];
    },
    async replaceDerived(records) {
      await prisma.$transaction(async (tx) => {
        await tx.upload.deleteMany({
          where: { id: { in: [DERIVED_UPLOAD_ID, SEED_UPLOAD_ID] } },
        });
        await tx.upload.create({
          data: {
            id: DERIVED_UPLOAD_ID,
            filename: "system/derived-from-datasets",
            originalName: "(คำนวณจากไฟล์ต้นทาง)",
            blobUrl: "system://derived",
            sizeBytes: 0,
            uploadedBy: "system",
            processedAt: new Date(),
          },
        });
        await inChunks(records, 200, (chunk) =>
          tx.financialRecord.createMany({
            data: chunk.map((r) => ({ ...r, uploadId: DERIVED_UPLOAD_ID })),
          }),
        );
      });
    },
  },
  dataset: {
    /**
     * MOM U5: new data is appended; rows with the same key are refreshed.
     * GL and activity files replace only the months they contain.
     */
    async applyBatch(batch) {
      await prisma.$transaction(
        async (tx) => {
          switch (batch.kind) {
            case "gl":
              await tx.glTransaction.deleteMany({
                where: { period: { in: batch.periods } },
              });
              await inChunks(batch.rows, 150, (data) => tx.glTransaction.createMany({ data }));
              break;
            case "budgetLines":
              await inChunks(batch.rows, 500, (chunk) =>
                tx.budgetLine.deleteMany({
                  where: { budgetCode: { in: chunk.map((l) => l.budgetCode) } },
                }),
              );
              await inChunks(batch.rows, 60, (chunk) =>
                tx.budgetLine.createMany({
                  data: chunk.map((l) => ({
                    ...l,
                    revenueMonthly: JSON.stringify(l.revenueMonthly),
                    expenseMonthly: JSON.stringify(l.expenseMonthly),
                  })),
                }),
              );
              break;
            case "budgetProgress":
              await inChunks(batch.rows, 500, (chunk) =>
                tx.budgetProgress.deleteMany({
                  where: { budgetCode: { in: chunk.map((p) => p.budgetCode) } },
                }),
              );
              await inChunks(batch.rows, 100, (data) => tx.budgetProgress.createMany({ data }));
              break;
            case "accountMap":
              await inChunks(batch.rows, 200, (chunk) =>
                tx.accountMap.deleteMany({
                  where: {
                    OR: chunk.map((a) => ({
                      accountCode: a.accountCode,
                      courseCode: a.courseCode,
                    })),
                  },
                }),
              );
              await tx.accountMap.createMany({ data: batch.rows });
              break;
            case "pnlLines":
              await tx.pnlLine.deleteMany({
                where: {
                  OR: batch.rows.map((p) => ({
                    sort1: p.sort1,
                    sort2: p.sort2,
                    sort3: p.sort3,
                  })),
                },
              });
              await tx.pnlLine.createMany({ data: batch.rows });
              break;
            case "departments":
              await tx.department.deleteMany({
                where: { code: { in: batch.rows.map((d) => d.code) } },
              });
              await tx.department.createMany({ data: batch.rows });
              break;
            case "memberStats":
              await inChunks(batch.rows, 200, (chunk) =>
                tx.memberStat.deleteMany({
                  where: {
                    OR: chunk.map((m) => ({
                      memberType: m.memberType,
                      year: m.year,
                      month: m.month,
                    })),
                  },
                }),
              );
              await inChunks(batch.rows, 300, (data) => tx.memberStat.createMany({ data }));
              break;
            case "activities":
              await tx.activityStat.deleteMany({
                where: { source: batch.source, period: { in: batch.periods } },
              });
              await inChunks(batch.rows, 150, (chunk) =>
                tx.activityStat.createMany({
                  data: chunk.map((a) => ({
                    ...a,
                    companyKeys: JSON.stringify(a.companyKeys),
                  })),
                }),
              );
              break;
          }
        },
        { timeout: 120_000 },
      );
      snapshotCache.__iodSnapshot = undefined; // next read sees the new data
    },
    async snapshot(): Promise<DatasetSnapshot> {
      // Reading every dataset table on each request is slow; reuse it until an upload changes it.
      const cached = snapshotCache.__iodSnapshot;
      if (cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached.data;
      const [gl, budgetLines, budgetProgress, accountMap, pnlLines, departments, memberStats, activities] = await Promise.all([
        prisma.glTransaction.findMany(),
        prisma.budgetLine.findMany(),
        prisma.budgetProgress.findMany(),
        prisma.accountMap.findMany(),
        prisma.pnlLine.findMany(),
        prisma.department.findMany(),
        prisma.memberStat.findMany(),
        prisma.activityStat.findMany(),
      ]);
      const data: DatasetSnapshot = {
        gl,
        budgetLines: budgetLines.map((l) => ({
          ...l,
          revenueMonthly: JSON.parse(l.revenueMonthly) as number[],
          expenseMonthly: JSON.parse(l.expenseMonthly) as number[],
        })),
        budgetProgress,
        accountMap,
        pnlLines,
        departments,
        memberStats,
        activities: activities.map((a) => ({
          ...a,
          source: a.source as ActivitySource,
          companyKeys: JSON.parse(a.companyKeys) as string[],
        })),
      };
      snapshotCache.__iodSnapshot = { at: Date.now(), data };
      return data;
    },
  },
  issues: {
    async list(filter = {}) {
      return (
        await prisma.issueLog.findMany({
          where: filter,
          orderBy: { createdAt: "desc" },
        })
      ).map(toIssue);
    },
    async get(id) {
      const i = await prisma.issueLog.findUnique({ where: { id } });
      return i ? toIssue(i) : null;
    },
    async create(input) {
      return toIssue(await prisma.issueLog.create({ data: input }));
    },
    async update(id, patch) {
      const resolvedAt = patch.status === undefined ? undefined : patch.status === "resolved" || patch.status === "closed" ? new Date() : null;
      return toIssue(
        await prisma.issueLog.update({
          where: { id },
          data: { ...patch, resolvedAt },
        }),
      );
    },
    async delete(id) {
      await prisma.issueLog.delete({ where: { id } });
    },
  },
  commentary: {
    async get(period) {
      return prisma.commentary.findUnique({ where: { period } });
    },
    async upsert(period, content, authorId) {
      return prisma.commentary.upsert({
        where: { period },
        update: { content, authorId },
        create: { period, content, authorId },
      });
    },
  },
  thresholds: {
    async list(dashboard) {
      return (
        await prisma.alertThreshold.findMany({
          where: dashboard ? { dashboard } : undefined,
        })
      ).map(toThreshold);
    },
    async upsertMany(items, updatedBy) {
      await prisma.$transaction(
        items.map((item) =>
          prisma.alertThreshold.upsert({
            where: {
              dashboard_metric: {
                dashboard: item.dashboard,
                metric: item.metric,
              },
            },
            update: { ...item, updatedBy },
            create: { ...item, updatedBy },
          }),
        ),
      );
      return (await prisma.alertThreshold.findMany()).map(toThreshold);
    },
  },
  scenarios: {
    async list() {
      return (await prisma.scenario.findMany({ orderBy: { createdAt: "desc" } })).map(toScenario);
    },
    async get(id) {
      const s = await prisma.scenario.findUnique({ where: { id } });
      return s ? toScenario(s) : null;
    },
    async create(input) {
      return toScenario(
        await prisma.scenario.create({
          data: {
            name: input.name,
            savedBy: input.savedBy,
            levers: JSON.stringify(input.levers),
            projections: JSON.stringify(input.projections),
          },
        }),
      );
    },
    async update(id, patch) {
      return toScenario(
        await prisma.scenario.update({
          where: { id },
          data: {
            name: patch.name,
            levers: patch.levers ? JSON.stringify(patch.levers) : undefined,
            projections: patch.projections ? JSON.stringify(patch.projections) : undefined,
          },
        }),
      );
    },
    async delete(id) {
      await prisma.scenario.delete({ where: { id } });
    },
  },
  feedback: {
    async list(filter = {}) {
      return (
        await prisma.feedback.findMany({
          where: {
            type: filter.type ? { in: filter.type } : undefined,
            createdBy: filter.createdBy,
          },
          orderBy: { createdAt: "desc" },
        })
      ).map(toFeedback);
    },
    async create(input) {
      return toFeedback(await prisma.feedback.create({ data: input }));
    },
    async update(id, patch) {
      return toFeedback(await prisma.feedback.update({ where: { id }, data: patch }));
    },
  },
  notes: {
    async list(userId) {
      return (await prisma.personalNote.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })) as PersonalNote[];
    },
    async create(input) {
      return (await prisma.personalNote.create({ data: input })) as PersonalNote;
    },
    async update(userId, id, patch) {
      // updateMany with the owner in the filter: a note of someone else matches 0 rows.
      const { count } = await prisma.personalNote.updateMany({ where: { id, userId }, data: patch });
      return count ? ((await prisma.personalNote.findUnique({ where: { id } })) as PersonalNote) : null;
    },
    async remove(userId, id) {
      return (await prisma.personalNote.deleteMany({ where: { id, userId } })).count > 0;
    },
  },
  ratings: {
    async list(userId) {
      return (
        await prisma.insightRating.findMany({
          where: userId ? { userId } : undefined,
        })
      ).map(toRating);
    },
    async upsert(input) {
      return toRating(
        await prisma.insightRating.upsert({
          where: {
            userId_insightKey: {
              userId: input.userId,
              insightKey: input.insightKey,
            },
          },
          update: {
            rating: input.rating,
            kind: input.kind,
            reason: input.reason ?? null,
            comment: input.comment || null,
            createdAt: new Date(),
          },
          create: { ...input, reason: input.reason ?? null, comment: input.comment || null },
        }),
      );
    },
  },
  usage: {
    async record(input) {
      await prisma.usageEvent.create({ data: input });
    },
    async list(since) {
      return prisma.usageEvent.findMany({
        where: since ? { createdAt: { gte: since } } : undefined,
      });
    },
  },
  access: {
    snapshot: readAccess,
    async applyGrantChanges(changes, actorId, expectedVersion) {
      const current = await readAccess();
      if (current.version !== expectedVersion) return null;
      const effective = normalizeChanges(current.grants, changes);
      if (!effective.length) return current;
      const stale = new Error("stale access version");
      try {
        await prisma.$transaction(async (tx) => {
          // Claim the version first: a concurrent save makes this match 0 rows and the whole transaction rolls back.
          const claimed = await tx.accessState.updateMany({
            where: { id: "global", version: expectedVersion },
            data: { version: { increment: 1 } },
          });
          if (claimed.count !== 1) throw stale;
          const ids = new Map(
            (
              await tx.feature.findMany({
                where: { key: { in: effective.map((c) => c.featureKey) } },
              })
            ).map((x) => [x.key, x.id]),
          );
          for (const c of effective) {
            const featureId = ids.get(c.featureKey);
            if (!featureId || !FEATURE_BY_KEY[c.featureKey]) throw new Error(`Unknown feature ${c.featureKey}`);
            if (c.effect === null) {
              await tx.tierFeature.deleteMany({
                where: { tierId: c.tierId, featureId },
              });
            } else {
              await tx.tierFeature.upsert({
                where: { tierId_featureId: { tierId: c.tierId, featureId } },
                update: { effect: c.effect },
                create: { tierId: c.tierId, featureId, effect: c.effect },
              });
            }
          }
          await tx.accessAuditLog.create({
            data: {
              actorId,
              action: "matrix.update",
              before: JSON.stringify(
                effective.map((c) => ({
                  ...c,
                  effect: current.grants[c.tierId]?.[c.featureKey] ?? null,
                })),
              ),
              after: JSON.stringify(effective),
            },
          });
        });
      } catch (err) {
        if (err === stale) return null;
        throw err;
      }
      return readAccess();
    },
    async auditLog(limit = 50) {
      return (
        await prisma.accessAuditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      ).map(toAudit);
    },
  },
};
