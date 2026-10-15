"use client";

import { useQuery } from "@tanstack/react-query";
import { type Jsonify, api, qs } from "@/lib/api";
import type { TierId } from "@/lib/access/catalog";
import type { FinancialSummary } from "@/lib/finance";
import type { AlertResult } from "@/server/dashboard/alerts";
import type { Insight, INSIGHT_RULES, InsightLevel } from "@/server/insights";
import type {
  Commentary,
  Feedback,
  FeedbackType,
  FinancialFilter,
  FinancialRecord,
  IssueFilter,
  IssueLog,
  Scenario,
  Upload,
  User,
  PersonalNote,
} from "@/types/domain";

export type ClientUser = Jsonify<Omit<User, "entraId">>;
export type ClientNote = Jsonify<PersonalNote>;
export type ClientIssue = Jsonify<IssueLog>;
export type ClientUpload = Jsonify<Upload> & { slot: string | null; uploaderName?: string };
export type ClientScenario = Jsonify<Scenario> & { savedByName?: string };
export type ClientRecord = Jsonify<FinancialRecord>;
export type ClientFeedback = Jsonify<Feedback> & { createdByName?: string };

export interface DataScope {
  year: number;
  fromMonth: number;
  toMonth: number;
  label: string;
  /** First / last GL posting date (YYYY-MM-DD) and a Thai label, e.g. "2 เธก.เธ. 2569 โ€“ 31 เธช.เธ. 2569". */
  fromDate: string;
  toDate: string;
  dateLabel: string;
}
export type InsightGroups = Record<InsightLevel, { count: number; amount: number }>;

export interface InsightsResponse {
  filters: { year: number; month: number; departments: string[] };
  scope: DataScope | null;
  rules: typeof INSIGHT_RULES;
  groups: InsightGroups;
  insights: Insight[];
  myRatings: Record<string, 1 | -1>;
  kindPrefs: Record<string, number>;
}

export interface HomeResponse {
  user: { name: string; jobTitle: string | null; tier: TierId };
  scope: DataScope | null;
  guide: { sections: { key: string; visited: boolean }[]; visitedCount: number; total: number };
  insightOfDay: (Insight & { myRating: number }) | null;
  groups: InsightGroups;
  myOpenFollowUps: number;
  updates: { date: string; title: string; items: string[] }[];
}

export interface UsageResponse {
  thisWeek: number;
  lastWeek: number;
  othersAverage: number;
  otherUsers: number;
  activeDays: number;
  topPages: { key: string; label: string; count: number }[];
  days: { date: string; count: number }[];
}

export type AlertRow = AlertResult;

export const keys = {
  summary: ["summary"] as const,
  records: (f: FinancialFilter) => ["records", f] as const,
  insights: (period?: string, dept?: string) => ["insights", period ?? "", dept ?? ""] as const,
  home: ["home"] as const,
  issues: (f: IssueFilter) => ["issues", f] as const,
  users: ["users"] as const,
  me: ["me"] as const,
  uploads: ["uploads"] as const,
  thresholds: (dashboard: string, period?: string, dept?: string) => ["thresholds", dashboard, period ?? "", dept ?? ""] as const,
  scenarios: ["scenarios"] as const,
  feedback: (types: string) => ["feedback", types] as const,
  usage: ["usage"] as const,
  commentary: (period: string) => ["commentary", period] as const,
  notes: ["notes"] as const,
};

export const useSummary = () =>
  useQuery({ queryKey: keys.summary, queryFn: () => api.get<FinancialSummary>("/api/financial/summary") });

export const useRecords = (filter: FinancialFilter = {}) =>
  useQuery({
    queryKey: keys.records(filter),
    queryFn: () => api.get<{ records: ClientRecord[] }>(`/api/financial${qs({ ...filter })}`).then((r) => r.records),
  });

export const useInsights = (period?: string, dept?: string) =>
  useQuery({
    queryKey: keys.insights(period, dept),
    queryFn: () => api.get<InsightsResponse>(`/api/insights${qs({ period, dept })}`),
    placeholderData: (prev) => prev,
  });

export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => api.get<HomeResponse>("/api/home") });

export const useIssues = (filter: IssueFilter = {}) =>
  useQuery({
    queryKey: keys.issues(filter),
    queryFn: () => api.get<{ issues: ClientIssue[] }>(`/api/issues${qs({ ...filter })}`).then((r) => r.issues),
  });

export const useUsers = () =>
  useQuery({
    queryKey: keys.users,
    queryFn: () => api.get<{ users: ClientUser[] }>("/api/users").then((r) => r.users),
  });

/** My private notes (newest first). */
export const useNotes = () => useQuery({ queryKey: keys.notes, queryFn: () => api.get<{ notes: ClientNote[] }>("/api/notes").then((r) => r.notes) });

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api.get<{ user: ClientUser }>("/api/me").then((r) => r.user) });

export const useUploads = () =>
  useQuery({
    queryKey: keys.uploads,
    queryFn: () => api.get<{ uploads: ClientUpload[] }>("/api/upload").then((r) => r.uploads),
  });

export const useThresholds = (dashboard: string, period?: string, dept?: string) =>
  useQuery({
    queryKey: keys.thresholds(dashboard, period, dept),
    queryFn: () =>
      api
        .get<{ alerts: AlertRow[] }>(`/api/alerts/thresholds${qs({ dashboard, period, dept })}`)
        .then((r) => r.alerts),
  });

export const useScenarios = (enabled = true) =>
  useQuery({
    queryKey: keys.scenarios,
    enabled,
    queryFn: () => api.get<{ scenarios: ClientScenario[] }>("/api/scenarios").then((r) => r.scenarios),
  });

export const useFeedback = (types: FeedbackType[] = []) =>
  useQuery({
    queryKey: keys.feedback(types.join(",")),
    queryFn: () =>
      api.get<{ items: ClientFeedback[] }>(`/api/feedback${qs({ type: types.join(",") })}`).then((r) => r.items),
  });

export const useUsage = () => useQuery({ queryKey: keys.usage, queryFn: () => api.get<UsageResponse>("/api/usage") });

export const useCommentary = (period: string | null) =>
  useQuery({
    queryKey: keys.commentary(period ?? ""),
    enabled: !!period,
    queryFn: () =>
      api.get<{ commentary: Jsonify<Commentary> | null }>(`/api/commentary/${period}`).then((r) => r.commentary),
  });
