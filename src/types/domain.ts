import type { TierId } from "@/lib/access/catalog";

/**
 * Access levels (MOM A2–A4): no position-based roles — every user is a user,
 * with a level an admin assigns. New users start as Basic.
 *  - basic:    view Home / Insight / Dashboard, simulate, give feedback
 *  - standard: + upload files, ask the AI assistant, follow-up actions, save scenarios
 *  - advanced: everything, including thresholds and user administration
 */
export const ROLES = ["basic", "standard", "advanced"] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = ["training", "membership", "sponsorship", "corporate"] as const;
export type Category = (typeof CATEGORIES)[number];

export const RECORD_TYPES = ["revenue", "expense", "budget"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const PERIOD_TYPES = ["monthly", "quarterly", "annual"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ISSUE_CATEGORIES = ["budget", "revenue", "compliance", "system", "other"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const OUTCOME_RESULTS = ["pending", "improved", "not_improved"] as const;
export type OutcomeResult = (typeof OUTCOME_RESULTS)[number];

export const THEMES = ["navy", "teal", "burgundy", "forest", "graphite", "custom"] as const;
export type Theme = (typeof THEMES)[number];

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Which Microsoft profile fields the user allowed us to sync (MOM A7). */
export interface ProfileConsent {
  name: boolean;
  email: boolean;
  jobTitle: boolean;
  photo: boolean;
  decidedAt: string;
}

export interface User {
  id: string;
  entraId: string;
  email: string;
  name: string;
  /** Legacy level, kept for backward compatibility. Access is decided by tierId. */
  role: Role;
  /** Access tier (Basic / Standard / Advanced / IT); null = not migrated yet → derived from role. */
  tierId: TierId | null;
  /** Bumped when this user's tier or status changes, so sessions refresh their permissions. */
  permVersion: number;
  department: string | null;
  /** Departments whose data the user may see; null = all departments (MOM A5). */
  departments: string[] | null;
  jobTitle: string | null;
  image: string | null;
  consent: ProfileConsent | null;
  /** Product tours already finished or skipped: tour id → version seen. */
  tourSeen: Record<string, number> | null;
  theme: Theme;
  locale: Locale;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Upload {
  id: string;
  filename: string;
  originalName: string;
  blobUrl: string;
  sizeBytes: number;
  uploadedBy: string;
  processedAt: Date | null;
  createdAt: Date;
  recordCount: number;
}

export interface FinancialRecord {
  id: string;
  period: string;
  periodType: PeriodType;
  category: Category;
  type: RecordType;
  amount: number;
  currency: string;
  uploadId: string;
  createdAt: Date;
}

export type NewFinancialRecord = Pick<
  FinancialRecord,
  "period" | "periodType" | "category" | "type" | "amount" | "currency"
>;

/** Follow-up action — turns an insight into a tracked action (MOM F1/F2). */
export interface IssueLog {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  category: IssueCategory;
  status: IssueStatus;
  reporter: string;
  ownerId: string | null;
  dueDate: Date | null;
  resolvedAt: Date | null;
  plan: string | null;
  approach: string | null;
  outcome: string | null;
  outcomeResult: OutcomeResult;
  sourceInsightId: string | null;
  metricLabel: string | null;
  baselineValue: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Commentary {
  id: string;
  period: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** KPI alert threshold, scoped to one dashboard page (MOM D10). */
export interface AlertThreshold {
  id: string;
  dashboard: string;
  metric: string;
  threshold: number;
  operator: "gt" | "lt";
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

/** Scenario: lever key → % change; snapshot keeps the filters and baseline at save time. */
export interface Scenario {
  id: string;
  name: string;
  levers: Record<string, number>;
  projections: ScenarioSnapshot;
  savedBy: string;
  createdAt: Date;
}

export interface ScenarioSnapshot {
  period: string;
  departments: string[];
  asOf: string;
  baseline: { key: string; label: string; kind: "revenue" | "expense"; value: number }[];
  totals: { baseRevenue: number; baseExpense: number; revenue: number; expense: number };
}

export const FEEDBACK_TYPES = ["issue", "new_request", "insight_request", "page_feedback"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_STATUSES = ["open", "in_review", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** System feedback: problems, new dashboard requests, insight requests, page ratings (MOM F3/D1/I7/I8). */
export interface Feedback {
  id: string;
  type: FeedbackType;
  title: string;
  detail: string | null;
  page: string | null;
  rating: "helpful" | "not_helpful" | null;
  status: FeedbackStatus;
  createdBy: string;
  createdAt: Date;
}

/** A private note to self (only its author can see it), listed on Home as a reminder. */
export interface PersonalNote {
  id: string;
  userId: string;
  content: string;
  /** Optional target date, yyyy-mm-dd */
  dueDate: string | null;
  done: boolean;
  /** Where it was written, e.g. "/dashboard/main/kpi" */
  page: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Like / dislike on an insight, used to pick tomorrow's Insight of the Day (MOM H3). */
export interface InsightRating {
  id: string;
  userId: string;
  insightKey: string;
  kind: string;
  rating: 1 | -1;
  reason?: string | null;
  comment?: string | null;
  createdAt: Date;
}

/** One page view (MOM F4 My Usage Log, H1 guide progress). */
export interface UsageEvent {
  id: string;
  userId: string;
  path: string;
  section: string;
  createdAt: Date;
}

export interface FinancialFilter {
  period?: string;
  periodFrom?: string;
  periodTo?: string;
  category?: Category;
  type?: RecordType;
}

export interface IssueFilter {
  status?: IssueStatus;
  severity?: Severity;
  ownerId?: string;
}
