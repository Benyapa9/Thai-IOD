"use client";

import { Filter, LayoutDashboard, MessageSquareText, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertsButton,
  DepartmentPicker,
  FilterChip,
  PrintHeader,
  RequestDashboardButton,
  useFocusTarget,
} from "@/components/dashboard/dashboard-tools";
import { ExportButton } from "@/components/export/export-dialog";
import { useCan, useT } from "@/components/layout/user-context";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState, IconBadge, LoadingBlock } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { useDashboardFilters, useDashboardMeta } from "@/hooks/dashboard";
import { DASHBOARD_PAGES, type DashboardPage } from "@/lib/alert-defs";
import { cn, formatPeriod } from "@/lib/utils";

const SECTIONS = [
  { href: "/dashboard/main", label: "Main Dashboard" },
  { href: "/dashboard/pnl", label: "P&L" },
  { href: "/dashboard/capital", label: "Capital (CAPEX)" },
];

const MAIN_PAGES: DashboardPage[] = ["kpi", "training", "expenditure", "membership"];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const canUpload = useCan("upload.create");
  const canExport = useCan("report.export");
  const canAlerts = useCan("thresholds.view");
  const canPnl = useCan("forecast.view");
  const { data: meta, isLoading } = useDashboardMeta();
  const { period, dept, pc, focus, departments, setParams } = useDashboardFilters();

  // Keep filters, drop one-off focus when switching pages.
  const keep = new URLSearchParams(Object.entries({ period, dept, pc }).filter(([, v]) => v) as [string, string][]).toString();
  const query = keep ? `?${keep}` : "";
  const inMain = pathname.startsWith("/dashboard/main");
  const showDept = !pathname.startsWith("/dashboard/pnl");
  const page = (Object.keys(DASHBOARD_PAGES) as DashboardPage[]).find((k) => DASHBOARD_PAGES[k].href === pathname);

  const selected = period ?? meta?.periods[0]?.value;
  const selectedLabel = meta?.periods.find((p) => p.value === selected)?.label ?? (selected ? formatPeriod(selected) : "-");
  // YTD is only complete when every month up to the selected one has actuals.
  const missingMonths = (() => {
    if (!selected || !meta || pathname.startsWith("/dashboard/capital")) return [];
    const [y, m] = selected.split("-").map(Number);
    const have = new Set(meta.periods.map((p) => p.value));
    return Array.from({ length: m }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`).filter((p) => !have.has(p));
  })();

  useFocusTarget(focus, !!meta?.hasData);

  const filtersText = [
    `ข้อมูลสะสมถึง ${selectedLabel}`,
    departments.length ? `หน่วยงาน: ${departments.join(", ")}` : meta?.restricted ? "หน่วยงานที่ได้รับสิทธิ์" : "ทุกหน่วยงาน",
    pc ? `Profit Center: ${pc}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const reportTitle = page ? `Dashboard — ${DASHBOARD_PAGES[page].label}` : "Dashboard";

  return (
    <>
      <PrintHeader title={reportTitle} filtersText={filtersText} asOf={meta?.scope?.label ?? selectedLabel} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="no-print flex items-center gap-3">
          <IconBadge icon={LayoutDashboard} tone="blue" size="lg" />
          <div>
            <h1 className="text-2xl leading-tight font-semibold text-navy-900">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Thai IOD — รายงานผลการดำเนินงานทางการเงิน (หน่วย: ล้านบาท)</p>
          </div>
        </div>
        <div data-tour="dashboard-actions" className="no-print flex flex-wrap items-center gap-2">
          {canUpload && (
            <Link href="/upload" className={buttonVariants({ size: "sm" })}>
              <Upload /> {t("dashboard.upload")}
            </Link>
          )}
          {page && canAlerts && <AlertsButton dashboard={page} period={period} dept={dept} />}
          {canExport && <ExportButton title={`รายงาน ${reportTitle} · ${selectedLabel}`} filtersText={filtersText} />}
          {page === "kpi" && (
            <a href="#note" className={buttonVariants({ variant: "outline", size: "sm" })} title="Note ส่วนตัว (เห็นเฉพาะคุณ)">
              <MessageSquareText /> Note
            </a>
          )}
        </div>
      </div>

      <PageGuide
        id="dashboard"
        title="ใช้ Dashboard อย่างไร"
        steps={[
          "เลือกเดือนและหน่วยงาน (เลือกได้หลายหน่วยงาน) — ทุกตัวเลขเป็นค่าสะสมถึงเดือนที่เลือก",
          "ชี้ที่ ⓘ เพื่อดูวิธีคำนวณ · กด ⤢ เพื่อขยายกราฟเต็มจอ · คลิกหัวตารางเพื่อเรียงลำดับ",
          "คลิกแท่งกราฟ Profit Center หรือชื่อหน่วยงานในตาราง เพื่อกรองทั้งหน้า · คลิก Actual เพื่อดูที่มา",
          "“เกณฑ์แจ้งเตือน” ตั้งค่าแยกตามแต่ละ Dashboard · “Export รายงาน” ได้ PDF พร้อมตัวกรอง",
        ]}
      />

      {/* Filter panel: tinted background so it reads as "filters", separate from the report below. */}
      <section
        data-tour="dashboard-filters"
        aria-label="ตัวกรองข้อมูล"
        className="no-print z-10 mb-4 flex lg:sticky lg:top-14 flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-navy-200 bg-white bg-gradient-to-r from-navy-100 via-navy-50 to-white px-4 py-3 shadow-md"
      >
        <span className="flex items-center gap-2 self-center text-sm font-semibold text-navy-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-navy-900 to-navy-500 text-white shadow-sm">
            <Filter className="size-4" aria-hidden />
          </span>
          ตัวกรอง
        </span>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-navy-700" htmlFor="dash-period">
            {t("dashboard.asOf")}
          </label>
          <Select
            id="dash-period"
            className="h-9 w-36 bg-white text-sm"
            value={selected ?? ""}
            onChange={(e) => setParams({ period: e.target.value })}
            disabled={!meta?.periods.length}
          >
            {meta?.periods.length ? (
              meta.periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))
            ) : (
              <option value="">ยังไม่มี Actual</option>
            )}
          </Select>
        </div>
        {showDept && meta && (
          <DepartmentPicker
            all={meta.departments}
            value={departments}
            restricted={meta.restricted}
            onChange={(v) => setParams({ dept: v.length ? v.join(",") : undefined })}
          />
        )}
        {departments.length > 1 &&
          departments.map((d) => (
            <FilterChip key={d} label={d} onClear={() => setParams({ dept: departments.filter((x) => x !== d).join(",") || undefined })} />
          ))}
        {pc && <FilterChip label={`Profit Center: ${pc}`} onClear={() => setParams({ pc: undefined })} />}
        {meta?.scope && <span className="ml-auto self-center text-xs text-navy-700">ข้อมูลที่มี: {meta.scope.label}</span>}
      </section>

      {missingMonths.length > 0 && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-x-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
          <b>ข้อมูล Actual ยังไม่ครบ:</b>
          ขาดเดือน {missingMonths.map((p) => formatPeriod(p)).join(", ")} — ค่าสะสม (YTD) จึงรวมเฉพาะเดือนที่มีไฟล์
          {canUpload && (
            <Link href="/upload" className="font-medium underline">
              เพิ่มข้อมูลล่าสุด
            </Link>
          )}
        </div>
      )}

      <nav className="no-print mb-1 flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.filter((s) => canPnl || s.href !== "/dashboard/pnl").map((s) => {
          const active = pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={`${s.href}${query}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active ? "border-navy-900 text-navy-900" : "border-transparent text-muted-foreground hover:text-navy-800",
              )}
            >
              {s.label}
            </Link>
          );
        })}
        <RequestDashboardButton />
      </nav>
      {inMain && (
        <nav className="no-print mt-2 mb-4 flex flex-wrap gap-1.5">
          {MAIN_PAGES.map((key, i) => {
            const p = DASHBOARD_PAGES[key];
            const active = pathname === p.href;
            return (
              <Link
                key={p.href}
                href={`${p.href}${query}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active ? "border-navy-900 bg-navy-900 text-white" : "border-border bg-white text-navy-800 hover:border-navy-300 hover:bg-navy-50",
                )}
              >
                {i + 1}. {p.label}
              </Link>
            );
          })}
        </nav>
      )}
      {!inMain && <div className="mb-4" />}

      {isLoading ? (
        <LoadingBlock label="กำลังโหลดข้อมูลรายงาน…" />
      ) : !meta?.hasData ? (
        <EmptyState title="ยังไม่มีข้อมูลสำหรับ Dashboard">
          อัปโหลดไฟล์ BG_YEAR และ Actual เพื่อเริ่มต้น
          {canUpload && (
            <div className="mt-3">
              <Link href="/upload" className={buttonVariants({ size: "sm" })}>
                ไปหน้าอัปโหลดข้อมูล
              </Link>
            </div>
          )}
        </EmptyState>
      ) : (
        children
      )}
    </>
  );
}
