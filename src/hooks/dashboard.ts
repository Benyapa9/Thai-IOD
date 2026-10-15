"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { api, qs } from "@/lib/api";
import type { AlertResult } from "@/server/dashboard/alerts";
import type {
  CapitalPage,
  ExpenditurePage,
  KpiPage,
  MembershipPage,
  PnlPage,
  TrainingPage,
} from "@/server/dashboard/pages";
import type { DataScope } from "./queries";

export interface PageData {
  kpi: KpiPage;
  training: TrainingPage;
  expenditure: ExpenditurePage;
  membership: MembershipPage;
  pnl: PnlPage;
  capital: CapitalPage;
}

export interface DashboardMeta {
  /** Newest first (MOM D2). */
  periods: { value: string; label: string }[];
  /** A–Z, limited to the user's departments (MOM D3, A5). */
  departments: string[];
  profitCenters: string[];
  restricted: boolean;
  budgetYears: number[];
  hasData: boolean;
  scope: DataScope | null;
  sources: Record<string, number>;
}

export interface ResolvedFilters {
  year: number;
  month: number;
  departments: string[];
  profitCenter?: string;
}

export interface DrillData {
  metric: "revenue" | "expense";
  total: number;
  byDepartment: { name: string; value: number; share: number }[];
  byProfitCenter: { name: string; value: number; share: number }[];
  byProject: { name: string; value: number; share: number }[];
  byMonth: { name: string; value: number; share: number }[];
}

/** URL search params drive every dashboard filter, so links and exports are shareable. */
export function useDashboardFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const period = params.get("period") ?? undefined;
  const dept = params.get("dept") ?? undefined;
  const pc = params.get("pc") ?? undefined;
  const focus = params.get("focus") ?? undefined;

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("focus");
      const s = next.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    },
    [params, router, pathname],
  );

  return { period, dept, pc, focus, departments: dept ? dept.split(",") : [], setParams };
}

export function useDashboardMeta() {
  return useQuery({
    queryKey: ["dashboard", "meta"],
    queryFn: () => api.get<DashboardMeta>("/api/dashboard/meta"),
  });
}

export function useDashboardPage<P extends keyof PageData>(page: P) {
  const { period, dept, pc } = useDashboardFilters();
  return useQuery({
    queryKey: ["dashboard", page, period, dept, pc],
    queryFn: () =>
      api.get<{ filters: ResolvedFilters; data: PageData[P]; alerts: AlertResult[] }>(
        `/api/dashboard/${page}${qs({ period, dept, pc })}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useDrill(metric: "revenue" | "expense" | null) {
  const { period, dept, pc } = useDashboardFilters();
  return useQuery({
    queryKey: ["dashboard", "drill", metric, period, dept, pc],
    enabled: !!metric,
    queryFn: () => api.get<DrillData>(`/api/dashboard/drill${qs({ metric: metric ?? undefined, period, dept, pc })}`),
  });
}
