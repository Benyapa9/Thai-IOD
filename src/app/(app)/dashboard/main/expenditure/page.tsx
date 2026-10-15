"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLineGradient } from "@/components/charts/gradients";
import { CHART, axisProps } from "@/components/charts/theme";
import { DrillDialog } from "@/components/dashboard/dashboard-tools";
import { PiePanel } from "@/components/dashboard/pie-panel";
import { MetricPanel, Panel, Signed, TreeTable } from "@/components/dashboard/widgets";
import { ErrorBlock, LoadingBlock } from "@/components/ui/misc";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useDashboardFilters, useDashboardPage } from "@/hooks/dashboard";
import { cn, formatMB } from "@/lib/utils";
import type { ExpenditurePage as Data } from "@/server/dashboard/pages";

type TypeRow = Data["byType"][number];
type OverviewRow = Data["overview"][number];

export default function ExpenditurePage() {
  const { data, isLoading, error } = useDashboardPage("expenditure");
  const { setParams } = useDashboardFilters();
  const [drill, setDrill] = useState<"expense" | null>(null);
  const grad = useLineGradient();
  const { sorted, sort, toggle } = useSort(
    data?.data.overview ?? [],
    {
      department: (r: OverviewRow) => r.department,
      budget: (r: OverviewRow) => r.budget,
      actual: (r: OverviewRow) => r.actual,
      variance: (r: OverviewRow) => r.variance,
      used: (r: OverviewRow) => (r.budget ? r.usedPct : null),
    },
  );
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel title="Expenditures (MB)" data={d.expense} kind="expense" focusId="expense" onDrill={() => setDrill("expense")} />
        <div className="lg:col-span-2">
          <PiePanel
            title="Expenditure by Department (MB)"
            subtitle="ค่าใช้จ่ายจริงสะสม"
            info="ค่าใช้จ่ายจริง (บัญชีหมวด 5/6) สะสมถึงเดือนที่เลือก แยกตามหน่วยงานเจ้าของงบ"
            data={d.byDepartment}
            onSelect={(name) => setParams({ dept: name })}
          />
        </div>
      </div>

      <Panel title="Budget Vs Actual (MB)" subtitle="รายเดือน" info="Budget = งบค่าใช้จ่ายรายเดือนตาม BG_YEAR · Actual = ค่าใช้จ่ายจริงของเดือนนั้น" focusId="monthly">
        <div className="chart-box h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grad.defs}
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => formatMB(Number(v), 0)} width={44} />
              <Tooltip formatter={(v) => (v === null ? "-" : `${formatMB(Number(v))} MB`)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="budget" name="Budget" stroke={CHART.budget} strokeDasharray="5 4" strokeWidth={2} dot={false} />
              <Area dataKey="actual" type="monotone" stroke="none" fill={grad.fill} legendType="none" tooltipType="none" />
              <Line dataKey="actual" name="Actual" type="monotone" stroke={grad.stroke} strokeWidth={3} dot={{ r: 4, fill: grad.dot, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Expenditure by Type" subtitle="ประเภทค่าใช้จ่ายทางบัญชี → หน่วยงาน → โครงการ · คลิกเพื่อขยาย" info="% to Ratio Expense = ค่าใช้จ่ายของแถวนั้น ÷ ค่าใช้จ่ายรวมทั้งหมด">
          <TreeTable<TypeRow>
            rows={d.byType}
            firstLabel="ประเภท / หน่วยงาน / โครงการ"
            columns={[
              { key: "a", label: "Actual (MB)", render: (r) => formatMB(r.actual), sortValue: (r) => r.actual },
              { key: "p", label: "% to Ratio Expense", render: (r) => `${r.sharePct.toFixed(1)}%`, sortValue: (r) => r.sharePct },
            ]}
          />
        </Panel>

        <Panel
          title="Overview (MB)"
          subtitle="งบประมาณถึงเดือนที่เลือก เทียบค่าใช้จ่ายจริง · คลิกชื่อหน่วยงานเพื่อกรอง"
          info="Variance = Budget − Actual (ติดลบ = ใช้เกินงบ) · % ใช้ไป = Actual ÷ Budget"
          focusId="overview"
        >
          <div className="table-box max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortTh label="หน่วยงาน" sortKey="department" sort={sort} onSort={toggle} />
                  <SortTh label="Budget (YTD)" sortKey="budget" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Actual" sortKey="actual" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Variance" sortKey="variance" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="% ใช้ไป" sortKey="used" sort={sort} onSort={toggle} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.department} className="hover:bg-navy-50/60">
                    <Td className="py-1.5">
                      <button type="button" onClick={() => setParams({ dept: r.department })} className="text-left font-medium text-navy-900 hover:underline cursor-pointer">
                        {r.department}
                      </button>
                    </Td>
                    <Td className="py-1.5 text-right tabular-nums">{formatMB(r.budget)}</Td>
                    <Td className="py-1.5 text-right tabular-nums">{formatMB(r.actual)}</Td>
                    <Td className="py-1.5 text-right tabular-nums">
                      <Signed value={r.variance} />
                    </Td>
                    <Td className={cn("py-1.5 text-right font-semibold tabular-nums", r.usedPct > 100 ? "text-danger" : "text-navy-900")}>
                      {r.budget ? `${r.usedPct.toFixed(1)}%` : "-"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <DrillDialog metric={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
