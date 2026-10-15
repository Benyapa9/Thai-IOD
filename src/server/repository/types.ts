import type {
  AlertThreshold,
  Commentary,
  Feedback,
  FinancialFilter,
  FinancialRecord,
  InsightRating,
  IssueFilter,
  IssueLog,
  NewFinancialRecord,
  PersonalNote,
  Role,
  Scenario,
  Upload,
  UsageEvent,
  User,
} from "@/types/domain";
import type { DatasetBatch, DatasetSnapshot } from "@/types/dataset";
import type { TierId } from "@/lib/access/catalog";
import type { GrantChange, GrantMap } from "@/lib/access/engine";

/** Upload that owns FinancialRecords derived from source datasets. */
export const DERIVED_UPLOAD_ID = "derived-dataset";

export const emptySnapshot = (): DatasetSnapshot => ({
  gl: [],
  budgetLines: [],
  budgetProgress: [],
  accountMap: [],
  pnlLines: [],
  departments: [],
  memberStats: [],
  activities: [],
});

export type NewIssue = Pick<
  IssueLog,
  "title" | "description" | "severity" | "category" | "reporter" | "ownerId" | "dueDate"
> &
  Partial<Pick<IssueLog, "plan" | "approach" | "sourceInsightId" | "metricLabel" | "baselineValue">>;
export type IssuePatch = Partial<
  Pick<
    IssueLog,
    | "status"
    | "ownerId"
    | "dueDate"
    | "severity"
    | "title"
    | "description"
    | "plan"
    | "approach"
    | "outcome"
    | "outcomeResult"
  >
>;

export type NewUpload = Pick<
  Upload,
  "filename" | "originalName" | "blobUrl" | "sizeBytes" | "uploadedBy"
>;

export type ThresholdInput = Pick<AlertThreshold, "dashboard" | "metric" | "threshold" | "operator" | "isActive">;

export type UserPatch = Partial<
  Pick<User, "role" | "tierId" | "isActive" | "department" | "departments" | "jobTitle" | "image" | "consent" | "tourSeen" | "theme" | "locale" | "name" | "email">
>;

/** One row of a bulk user change (only the fields that change). */
export interface UserAccessChange {
  userId: string;
  tierId?: TierId;
  isActive?: boolean;
}

export interface AccessSnapshot {
  grants: GrantMap;
  /** Bumped on every matrix change. */
  version: number;
}

export interface AccessAuditEntry {
  id: string;
  actorId: string;
  action: "matrix.update" | "users.update";
  before: string;
  after: string;
  createdAt: Date;
}

export type NewFeedback = Pick<Feedback, "type" | "title" | "detail" | "page" | "rating" | "createdBy">;

/**
 * Data access boundary. `prisma.ts` talks to Azure SQL; `memory.ts` is an
 * in-process demo store used when DATABASE_URL is not configured.
 */
export interface Repository {
  users: {
    list(): Promise<User[]>;
    findById(id: string): Promise<User | null>;
    upsertFromEntra(input: { entraId: string; email: string; name: string }): Promise<User>;
    update(id: string, patch: UserPatch): Promise<User>;
    listByRoles(roles: Role[]): Promise<User[]>;
    /**
     * Change tiers / active status of several users in one transaction (MOM A3,
     * access-matrix phase 5). Bumps each changed user's permVersion and writes
     * one AccessAuditLog entry. Returns the updated users.
     */
    applyAccessChanges(changes: UserAccessChange[], actorId: string): Promise<User[]>;
  };
  uploads: {
    list(): Promise<Upload[]>;
    create(input: NewUpload, records: NewFinancialRecord[]): Promise<Upload>;
    delete(id: string): Promise<void>;
  };
  financial: {
    list(filter?: FinancialFilter): Promise<FinancialRecord[]>;
    /** Replaces records derived from source datasets (and drops demo seed data). */
    replaceDerived(records: NewFinancialRecord[]): Promise<void>;
  };
  dataset: {
    applyBatch(batch: DatasetBatch): Promise<void>;
    snapshot(): Promise<DatasetSnapshot>;
  };
  issues: {
    list(filter?: IssueFilter): Promise<IssueLog[]>;
    get(id: string): Promise<IssueLog | null>;
    create(input: NewIssue): Promise<IssueLog>;
    update(id: string, patch: IssuePatch): Promise<IssueLog>;
    delete(id: string): Promise<void>;
  };
  commentary: {
    get(period: string): Promise<Commentary | null>;
    upsert(period: string, content: string, authorId: string): Promise<Commentary>;
  };
  thresholds: {
    list(dashboard?: string): Promise<AlertThreshold[]>;
    upsertMany(items: ThresholdInput[], updatedBy: string): Promise<AlertThreshold[]>;
  };
  scenarios: {
    list(): Promise<Scenario[]>;
    get(id: string): Promise<Scenario | null>;
    create(input: Omit<Scenario, "id" | "createdAt">): Promise<Scenario>;
    update(id: string, patch: Partial<Pick<Scenario, "name" | "levers" | "projections">>): Promise<Scenario>;
    delete(id: string): Promise<void>;
  };
  feedback: {
    list(filter?: { type?: Feedback["type"][]; createdBy?: string }): Promise<Feedback[]>;
    create(input: NewFeedback): Promise<Feedback>;
    update(id: string, patch: Partial<Pick<Feedback, "status">>): Promise<Feedback>;
  };
  /** Private notes: every method is scoped to the owner. */
  notes: {
    list(userId: string): Promise<PersonalNote[]>;
    create(input: Pick<PersonalNote, "userId" | "content" | "dueDate" | "page">): Promise<PersonalNote>;
    /** null when the note does not exist or belongs to someone else */
    update(userId: string, id: string, patch: Partial<Pick<PersonalNote, "content" | "dueDate" | "done">>): Promise<PersonalNote | null>;
    remove(userId: string, id: string): Promise<boolean>;
  };
  ratings: {
    list(userId?: string): Promise<InsightRating[]>;
    upsert(input: Omit<InsightRating, "id" | "createdAt">): Promise<InsightRating>;
  };
  usage: {
    record(input: Omit<UsageEvent, "id" | "createdAt">): Promise<void>;
    list(since?: Date): Promise<UsageEvent[]>;
  };
  access: {
    /** Current explicit grants of every tier, plus the access version. */
    snapshot(): Promise<AccessSnapshot>;
    /** Apply matrix changes in one transaction, write the audit log, bump the version. */
    /** Applies only if the matrix is still at expectedVersion (checked atomically); null when someone saved first. */
    applyGrantChanges(changes: GrantChange[], actorId: string, expectedVersion: number): Promise<AccessSnapshot | null>;
    auditLog(limit?: number): Promise<AccessAuditEntry[]>;
  };
}

/** Legacy `role` kept in sync with the tier (IT had no old level of its own). */
/** Thrown by applyAccessChanges when no active IT user would remain (checked inside the transaction). */
export class NoActiveItError extends Error {}

export const roleForTier = (tier: TierId): Role => (tier === "it" ? "advanced" : tier);
