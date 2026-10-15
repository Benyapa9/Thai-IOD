import { z } from "zod";
import { RATING_REASON_KEYS } from "@/lib/rating-reasons";
import { type FeatureKey, TIER_IDS, isFeatureKey } from "@/lib/access/catalog";
import {
  CATEGORIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  LOCALES,
  OUTCOME_RESULTS,
  RECORD_TYPES,
  SEVERITIES,
  THEMES,
} from "@/types/domain";

const period = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]|Q[1-4]))?$/, "รูปแบบงวดไม่ถูกต้อง");

/** "" or null → null (clear), undefined → undefined (unchanged), else Date */
const nullableDate = z
  .union([z.literal(""), z.null(), z.coerce.date()])
  .optional()
  .transform((v) => (v === "" ? null : v));

export const periodSchema = period;

export const financialFilterSchema = z.object({
  period: period.optional(),
  periodFrom: period.optional(),
  periodTo: period.optional(),
  category: z.enum(CATEGORIES).optional(),
  type: z.enum(RECORD_TYPES).optional(),
});

export const issueFilterSchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  ownerId: z.string().optional(),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(3, "หัวข้ออย่างน้อย 3 ตัวอักษร").max(200),
  description: z
    .string()
    .trim()
    .max(4000)
    .nullish()
    .transform((v) => v || null),
  severity: z.enum(SEVERITIES),
  category: z.enum(ISSUE_CATEGORIES),
  ownerId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  dueDate: nullableDate.transform((v) => v ?? null),
  // Created from an insight: remember where it came from to compare results later (MOM F2).
  plan: z.string().trim().max(4000).nullish().transform((v) => v || null),
  approach: z.string().trim().max(4000).nullish().transform((v) => v || null),
  sourceInsightId: z.string().max(200).nullish().transform((v) => v || null),
  metricLabel: z.string().max(200).nullish().transform((v) => v || null),
  baselineValue: z.number().nullish().transform((v) => (v === undefined ? null : v)),
});

export const updateIssueSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  ownerId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  dueDate: nullableDate,
  plan: z.string().trim().max(4000).nullable().optional(),
  approach: z.string().trim().max(4000).nullable().optional(),
  outcome: z.string().trim().max(4000).nullable().optional(),
  outcomeResult: z.enum(OUTCOME_RESULTS).optional(),
});

export const commentarySchema = z.object({
  content: z.string().trim().max(10_000),
});

export const thresholdsSchema = z.object({
  thresholds: z
    .array(
      z.object({
        dashboard: z.enum(["kpi", "training", "expenditure", "membership", "pnl", "capital"]),
        metric: z.string().min(1).max(60),
        threshold: z.coerce.number().min(-100).max(1000),
        operator: z.enum(["gt", "lt"]),
        isActive: z.boolean(),
      }),
    )
    .min(1),
});

const leverValue = z.coerce.number().min(-100).max(200);
export const scenarioSchema = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อ Scenario").max(100),
  levers: z.record(z.string().max(120), leverValue),
  projections: z.object({
    period: z.string(),
    departments: z.array(z.string()),
    asOf: z.string(),
    baseline: z.array(
      z.object({ key: z.string(), label: z.string(), kind: z.enum(["revenue", "expense"]), value: z.number() }),
    ),
    totals: z.object({ baseRevenue: z.number(), baseExpense: z.number(), revenue: z.number(), expense: z.number() }),
  }),
});
export const scenarioPatchSchema = scenarioSchema.partial();

/**
 * Per-user profile fields an admin may edit (department data access, MOM A5).
 * Tier and active status go through PATCH /api/users (bulk, audited) only.
 */
export const updateUserSchema = z
  .object({
  department: z.string().trim().max(100).nullable().optional(),
  // null = all departments; an empty list is rejected so it can never mean "everything" by accident.
  departments: z.array(z.string().max(120)).min(1, "ต้องเลือกอย่างน้อย 1 แผนก หรือเลือก “ทุกแผนก”").nullable().optional(),
  })
  .strict();

export const consentSchema = z.object({
  name: z.boolean(),
  email: z.boolean(),
  jobTitle: z.boolean(),
  photo: z.boolean(),
});

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).optional(),
  locale: z.enum(LOCALES).optional(),
});

export const followUpPatchSchema = z.object({
  plan: z.string().trim().max(4000).nullable().optional(),
  approach: z.string().trim().max(4000).nullable().optional(),
  outcome: z.string().trim().max(4000).nullable().optional(),
  outcomeResult: z.enum(OUTCOME_RESULTS).optional(),
});

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().trim().min(2, "กรุณากรอกหัวข้อ").max(200),
  detail: z
    .string()
    .trim()
    .max(4000)
    .nullish()
    .transform((v) => v || null),
  page: z.string().max(200).nullish().transform((v) => v || null),
  rating: z.enum(["helpful", "not_helpful"]).nullish().transform((v) => v ?? null),
});
export const feedbackPatchSchema = z.object({ status: z.enum(FEEDBACK_STATUSES) });

export const ratingSchema = z.object({
  insightKey: z.string().min(1).max(200),
  kind: z.string().min(1).max(60),
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.enum(RATING_REASON_KEYS).nullish(),
  comment: z.string().trim().max(1000).nullish(),
});

export const usageSchema = z.object({ path: z.string().min(1).max(300) });

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

/** Product tour finished or skipped. */
export const tourSeenSchema = z.object({
  tourId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  version: z.number().int().min(1).max(10_000),
});

// ── Access matrix (access-matrix phases 3 & 5) ─────────────────────────────

const featureKey = z
  .string()
  .refine(isFeatureKey, "ไม่รู้จักฟีเจอร์นี้")
  .transform((k) => k as FeatureKey);

/** PUT /api/access/matrix — only the cells that changed, plus the version they were based on. */
export const matrixUpdateSchema = z
  .object({
    version: z.number().int().min(1),
    changes: z
      .array(
        z
          .object({
            tierId: z.enum(TIER_IDS),
            featureKey,
            effect: z.enum(["allow", "deny"]).nullable(),
          })
          .strict(),
      )
      .min(1, "ไม่มีการเปลี่ยนแปลงให้บันทึก")
      .max(500),
  })
  .strict();

/** PATCH /api/users — tier / active changes for one or more users. */
export const usersAccessSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            userId: z.string().min(1).max(64),
            tierId: z.enum(TIER_IDS).optional(),
            isActive: z.boolean().optional(),
          })
          .strict()
          .refine((c) => c.tierId !== undefined || c.isActive !== undefined, "ต้องระบุระดับหรือสถานะอย่างน้อย 1 อย่าง"),
      )
      .min(1, "ไม่มีการเปลี่ยนแปลงให้บันทึก")
      .max(500)
      .refine((rows) => new Set(rows.map((r) => r.userId)).size === rows.length, "มีผู้ใช้ซ้ำในรายการ"),
  })
  .strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ต้องอยู่ในรูปแบบ ปปปป-ดด-วว");

/** Private note to self (POST /api/notes). */
export const noteCreateSchema = z
  .object({
    content: z.string().trim().min(1, "กรุณาพิมพ์ข้อความ").max(1000),
    dueDate: isoDate.nullish(),
    page: z.string().max(200).nullish(),
  })
  .strict();

/** PATCH /api/notes/[id] — tick done, edit text or due date. */
export const noteUpdateSchema = z
  .object({
    content: z.string().trim().min(1).max(1000).optional(),
    dueDate: isoDate.nullable().optional(),
    done: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "ไม่มีข้อมูลที่จะแก้ไข");
