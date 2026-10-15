"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLineGradient } from "@/components/charts/gradients";
import { CHART, axisProps } from "@/components/charts/theme";
import { DrillDialog } from "@/components/dashboard/dashboard-tools";
import { MetricPanel, Panel, Signed, StatCard } from "@/components/dashboard/widgets";
import { ErrorBlock, LoadingBlock, SegmentedControl } from "@/components/ui/misc";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useDashboardFilters, useDashboardPage } from "@/hooks/dashboard";
import { cn, formatMB } from "@/lib/utils";
import type { KpiPage as KpiData } from "@/server/dashboard/pages";
import { PersonalNotesCard } from "@/components/notes/personal-notes";

type Measure = "revenue" | "expense" | "net";
type Mode = "monthly" | "cumulative";

const MEASURE: Record<Measure, { label: string; actual: "revenueActual" | "expenseActual" | "netActual"; plan: "revenuePlan" | "expenseBudget" | "netPlan" }> = {
  revenue: { label: "รายได้", actual: "revenueActual", plan: "revenuePlan" },
  expense: { label: "ค่าใช้จ่าย", actual: "expenseActual", plan: "expenseBudget" },
  net: { label: "รายได้สูง(ต่ำ)กว่าค่าใช้จ่าย", actual: "netActual", plan: "netPlan" },
};

type Monthly = KpiData["monthly"][number];
type DeptRow = KpiData["byDepartment"][number];

function buildSeries(rows: Monthly[], m: (typeof MEASURE)[Measure], mode: Mode) {
  let accA = 0;
  let accP = 0;
  return rows.map((row) => {
    const a = row[m.actual];
    const p = row[m.plan];
    accP += p;
    if (a !== null) accA += a;
    return {
      label: row.label,
      actual: mode === "cumulative" ? (a === null ? null : accA) : a,
      plan: mode === "cumulative" ? accP : p,
    };
  });
}

export default function KpiPage() {
  const { data, isLoading, error } = useDashboardPage("kpi");
  const { pc, setParams } = useDashboardFilters();
  const [measure, setMeasure] = useState<Measure>("revenue");
  const [mode, setMode] = useState<Mode>("monthly");
  const [drill, setDrill] = useState<"revenue" | "expense" | null>(null);
  const grad = useLineGradient();
  const rows = data?.data.byDepartment ?? [];
  const { sorted, sort, toggle } = useSort(rows, {
    department: (r: DeptRow) => r.department,
    revenuePlan: (r: DeptRow) => r.revenuePlan,
    revenueToGo: (r: DeptRow) => r.revenueToGo,
    expenseBudget: (r: DeptRow) => r.expenseBudget,
    expenseBalance: (r: DeptRow) => r.expenseBalance,
    profitPlan: (r: DeptRow) => r.profitPlan,
    profitToGo: (r: DeptRow) => r.profitToGo,
  });
  type SortKey = Parameters<typeof toggle>[0];

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;

  const m = MEASURE[measure];
  const series = buildSeries(d.monthly, m, mode);
  const th = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} align={align} />
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricPanel title="Revenue (MB)" data={d.revenue} kind="revenue" focusId="revenue" onDrill={() => setDrill("revenue")} />
        <MetricPanel title="Expenditures (MB)" data={d.expense} kind="expense" focusId="expense" onDrill={() => setDrill("expense")} />
        <MetricPanel title="Revenue Over Expense (MB)" data={d.net} kind="profit" focusId="net" />
        <div className="grid gap-4" data-focus="ebitda">
          <StatCard
            label="Actual EBITDA (YTD)"
            value={formatMB(d.ebitda.actual)}
            hint={`Actual EBITDA ${d.ebitda.actualPct.toFixed(1)}% ของ Net Operating Income`}
            tone={d.ebitda.actual >= 0 ? "good" : "bad"}
          />
          <StatCard label="Budget EBITDA (YTD)" value={formatMB(d.ebitda.budget)} hint={`Budget EBITDA ${d.ebitda.budgetPct.toFixed(1)}% ของ Net Operating Income`} />
        </div>
      </div>

      {/* MOM D9: revenue / profit charts use the full width. */}
      <Panel
        title="Monthly Performance of selected measure"
        subtitle="เลือกตัวชี้วัดและมุมมอง (รายเดือน / สะสม)"
        info="เส้นทึบ = ผลจริงรายเดือน (หรือสะสม) · พื้นที่เส้นประ = แผน/งบประมาณของเดือนเดียวกัน · เดือนที่ยังไม่มีไฟล์ Actual จะไม่แสดงจุด"
        focusId="monthly"
        actions={
          <div className="flex flex-wrap gap-2">
            <SegmentedControl<Measure>
              value={measure}
              onChange={setMeasure}
              options={[
                { value: "revenue", label: "Revenue" },
                { value: "expense", label: "Expense" },
                { value: "net", label: "Rev. over Exp." },
              ]}
            />
            <SegmentedControl<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: "monthly", label: "รายเดือน" },
                { value: "cumulative", label: "สะสม" },
              ]}
            />
          </div>
        }
      >
        <div className="chart-box h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grad.defs}
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => formatMB(Number(v), 0)} width={44} />
              <Tooltip formatter={(v) => (v === null ? "-" : `${formatMB(Number(v))} MB`)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="plan" name={`Target ${m.label}`} type="monotone" stroke={CHART.budget} fill={CHART.budget} fillOpacity={0.12} strokeDasharray="5 4" />
              <Area dataKey="actual" type="monotone" stroke="none" fill={grad.fill} legendType="none" tooltipType="none" connectNulls={false} />
              <Line dataKey="actual" name={`Actual ${m.label}`} type="monotone" stroke={grad.stroke} strokeWidth={3} dot={{ r: 4, fill: grad.dot, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {d.monthly.filter((x) => x.revenueActual !== null).length <= 1 && (
          <p className="mt-2 text-xs text-muted-foreground">ขณะนี้มีข้อมูล Actual เพียงเดือนเดียว — กราฟจะแสดงแนวโน้มเมื่ออัปโหลดไฟล์ Actual ของเดือนอื่นเพิ่ม</p>
        )}
      </Panel>

      <Panel
        title="Revenue (MB) by Profit Center"
        subtitle="ผลจริงเทียบแผน ถึงเดือนที่เลือก · คลิกแท่งกราฟเพื่อกรองทั้งหน้าตาม Profit Center"
        info="Revenue = รายได้จริงสะสม · Revenue Plan = แผนรายได้ถึงเดือนที่เลือก แยกตาม Profit Center ใน BG_YEAR"
        focusId="revenue-by-pc"
      >
        <div className="chart-box" style={{ height: Math.max(260, d.byProfitCenter.length * 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.byProfitCenter} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => formatMB(Number(v), 0)} />
              <YAxis type="category" dataKey="profitCenter" {...axisProps} width={150} />
              <Tooltip formatter={(v) => `${formatMB(Number(v))} MB`} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="actual"
                name="Revenue"
                fill={CHART.revenue}
                maxBarSize={12}
                radius={[0, 3, 3, 0]}
                className="cursor-pointer"
                onClick={(entry) => {
                  const name = (entry as unknown as { profitCenter?: string }).profitCenter;
                  if (name) setParams({ pc: pc === name ? undefined : name });
                }}
              >
                {d.byProfitCenter.map((r) => (
                  <Cell key={r.profitCenter} fillOpacity={!pc || pc === r.profitCenter ? 1 : 0.3} />
                ))}
              </Bar>
              <Bar dataKey="plan" name="Revenue Plan" fill={CHART.expense} maxBarSize={12} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="P&L At A Glance (MB)"
        subtitle="Plan / Budget = ถึงเดือนที่เลือก · To Go / Balance = แผนทั้งปี − ผลจริงสะสม · คลิกชื่อหน่วยงานเพื่อกรองทั้งหน้า"
        info="Revenue To Go = แผนรายได้ทั้งปี − รายได้จริงสะสม · Balance = งบค่าใช้จ่ายทั้งปี − ค่าใช้จ่ายจริงสะสม (ติดลบ = ใช้เกินงบ) · Profit = Revenue − Expense"
      >
        <div className="table-box max-h-[480px] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {th("department", "หน่วยงาน", "left")}
                {th("revenuePlan", "Revenue Plan")}
                {th("revenueToGo", "Revenue To Go")}
                {th("expenseBudget", "Expense Budget")}
                {th("expenseBalance", "Balance")}
                {th("profitPlan", "Profit Plan")}
                {th("profitToGo", "Profit To Go")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.department} className="hover:bg-navy-50/60">
                  <Td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => setParams({ dept: r.department })}
                      title="กรองทั้งหน้าตามหน่วยงานนี้"
                      className="text-left font-medium text-navy-900 hover:underline cursor-pointer"
                    >
                      {r.department}
                    </button>
                  </Td>
                  <Td className="py-1.5 text-right tabular-nums">{formatMB(r.revenuePlan)}</Td>
                  <Td className="py-1.5 text-right tabular-nums">{formatMB(r.revenueToGo)}</Td>
                  <Td className="py-1.5 text-right tabular-nums">{formatMB(r.expenseBudget)}</Td>
                  <Td className="py-1.5 text-right tabular-nums">
                    <Signed value={r.expenseBalance} />
                  </Td>
                  <Td className={cn("py-1.5 text-right tabular-nums", r.profitPlan < 0 && "text-danger")}>{formatMB(r.profitPlan)}</Td>
                  <Td className="py-1.5 text-right tabular-nums">{formatMB(r.profitToGo)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* MOM D9: management note at the bottom. */}
      <PersonalNotesCard page="/dashboard/main/kpi" />
      <DrillDialog metric={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
