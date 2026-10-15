"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps } from "@/components/charts/theme";
import { PiePanel } from "@/components/dashboard/pie-panel";
import { MetricPanel, Panel, StatCard } from "@/components/dashboard/widgets";
import { ErrorBlock, LoadingBlock } from "@/components/ui/misc";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useDashboardFilters, useDashboardPage } from "@/hooks/dashboard";
import { cn, formatDate, formatMB, formatPeriod } from "@/lib/utils";
import type { CapitalPage as Data } from "@/server/dashboard/pages";

type Project = Data["projects"][number];

/** Blueprint L003: Delay = red, In-Progress = yellow, Completed = green. */
const STATUS_STYLE: Record<string, { row: string; badge: string }> = {
  Delay: { row: "bg-danger-soft", badge: "bg-danger text-white" },
  "In-Progress": { row: "bg-warning-soft", badge: "bg-warning text-white" },
  Completed: { row: "bg-success-soft", badge: "bg-success text-white" },
};
const STATUS_ORDER = ["Delay", "In-Progress", "Completed"];

export default function CapitalPage() {
  const { data, isLoading, error } = useDashboardPage("capital");
  const { setParams } = useDashboardFilters();
  const { sorted, sort, toggle } = useSort(data?.data.projects ?? [], {
    code: (p: Project) => p.budgetCode,
    dept: (p: Project) => p.department,
    name: (p: Project) => p.name,
    budget: (p: Project) => p.budget,
    used: (p: Project) => p.used,
    balance: (p: Project) => p.balance,
    achieve: (p: Project) => (p.budget ? p.achievePct : null),
    start: (p: Project) => (p.startDate ? +new Date(p.startDate) : null),
    end: (p: Project) => (p.endDate ? +new Date(p.endDate) : null),
  });
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;

  const top = d.projects.slice(0, 15).map((p) => ({
    name: p.name.length > 34 ? `${p.name.slice(0, 33)}…` : p.name,
    used: p.used,
    balance: Math.max(p.capitalBalance, 0),
  }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        ประเภทงบประมาณ = งบลงทุน · ไม่รวมสถานะยกเลิก · Actual = ค่าใช้จ่ายตามงบประมาณใช้ไป (BG_Capital)
        {d.asOf && <> ข้อมูล ณ {formatPeriod(d.asOf)}</>} · Budget Cost = งบรายเดือนถึงเดือนที่เลือก
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel title="Capital Outlay (MB)" data={d.outlay} kind="expense" focusId="outlay" />
        <div className="lg:col-span-2">
          <PiePanel title="Actual CapEx Outlay Pie (MB)" subtitle="แยกตามหน่วยงาน" data={d.byDepartment} onSelect={(name) => setParams({ dept: name })} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Completed" value={String(d.statusCounts.completed)} tone="good" hint="สถานะโครงการ เสร็จสิ้น" />
        <StatCard label="In-Progress" value={String(d.statusCounts.inProgress)} hint="งบที่วางไว้อยู่ก่อนวันสิ้นสุดโครงการ" />
        <StatCard
          label="Delay"
          value={String(d.statusCounts.delay)}
          tone={d.statusCounts.delay ? "bad" : "neutral"}
          hint="มีงบที่วางไว้เกินวันสิ้นสุดโครงการ"
        />
      </div>

      <Panel title="Project Timeline – On Plan vs Delay (MB)" subtitle="งบประมาณรายเดือนตาม BG_YEAR · คลิกสถานะเพื่อขยาย" focusId="timeline" info="Delay = มีงบที่วางไว้หลังวันสิ้นสุดโครงการ · In-Progress = งบอยู่ก่อนวันสิ้นสุด · Completed = สถานะเสร็จสิ้น">
        <Timeline projects={d.projects} months={d.months} />
      </Panel>

      <Panel title="Actual Spending by Project (MB)" subtitle="15 โครงการที่งบสูงสุด · งบประมาณใช้ไป (Achieve) และคงเหลือ (Balance)">
        <div className="chart-box" style={{ height: Math.max(220, top.length * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => formatMB(Number(v))} />
              <YAxis type="category" dataKey="name" {...axisProps} width={230} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${formatMB(Number(v))} MB`} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="used" name="Achieve (ใช้ไป)" stackId="a" fill={CHART.revenue} maxBarSize={16} />
              <Bar dataKey="balance" name="Balance (คงเหลือ)" stackId="a" fill={CHART.expense} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Budget Detail (MB)" subtitle="Budget Cost ถึงเดือนที่เลือก · % To Achieve = Actual ÷ Budget Cost">
        <div className="table-box max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <SortTh label="Budget Code" sortKey="code" sort={sort} onSort={toggle} />
              <SortTh label="Department" sortKey="dept" sort={sort} onSort={toggle} />
              <SortTh label="Project" sortKey="name" sort={sort} onSort={toggle} />
              <SortTh label="Budget Cost" sortKey="budget" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Actual Expense" sortKey="used" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Actual Balance" sortKey="balance" sort={sort} onSort={toggle} align="right" />
              <SortTh label="% To Achieve" sortKey="achieve" sort={sort} onSort={toggle} align="right" />
              <SortTh label="เริ่ม" sortKey="start" sort={sort} onSort={toggle} />
              <SortTh label="สิ้นสุด" sortKey="end" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.budgetCode} className="hover:bg-navy-50/60">
                <Td className="py-1.5 font-mono text-xs">{p.budgetCode}</Td>
                <Td className="py-1.5">{p.department}</Td>
                <Td className="max-w-64 py-1.5 font-medium text-navy-900">{p.name}</Td>
                <Td className="py-1.5 text-right tabular-nums">{formatMB(p.budget)}</Td>
                <Td className="py-1.5 text-right tabular-nums">{formatMB(p.used)}</Td>
                <Td className={cn("py-1.5 text-right tabular-nums", p.balance < 0 && "text-danger")}>{formatMB(p.balance)}</Td>
                <Td
                  className={cn(
                    "py-1.5 text-right font-semibold tabular-nums",
                    p.achievePct > 100 || p.achievePct < 0 ? "text-danger" : "text-success",
                  )}
                >
                  {p.budget ? `${p.achievePct.toFixed(1)}%` : "-"}
                </Td>
                <Td className="py-1.5 whitespace-nowrap">{formatDate(p.startDate)}</Td>
                <Td className="py-1.5 whitespace-nowrap">{formatDate(p.endDate)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Panel>
    </div>
  );
}

function Timeline({ projects, months }: { projects: Project[]; months: string[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Delay: true });
  const groups = STATUS_ORDER.map((status) => ({ status, items: projects.filter((p) => p.status === status) })).filter(
    (g) => g.items.length,
  );
  const sumMonths = (items: Project[], i: number) => items.reduce((s, p) => s + (p.monthly[i] ?? 0), 0);
  // Small amounts (< 0.05 MB) would round to "0.0" — show two decimals for those.
  const cell = (v: number) => (!v ? "" : Math.abs(v) < 5e4 ? formatMB(v, 2) : formatMB(v));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-navy-900 px-2 py-2 text-left font-semibold text-white">SLA Status / Project</th>
            {months.map((m) => (
              <th key={m} className="bg-navy-900 px-2 py-2 text-right font-semibold text-white">
                {m}
              </th>
            ))}
            <th className="bg-navy-900 px-2 py-2 text-right font-semibold text-white">Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <TimelineGroup
              key={g.status}
              status={g.status}
              items={g.items}
              open={!!open[g.status]}
              onToggle={() => setOpen((o) => ({ ...o, [g.status]: !o[g.status] }))}
              sumMonths={sumMonths}
              cell={cell}
              monthCount={months.length}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineGroup({
  status,
  items,
  open,
  onToggle,
  sumMonths,
  cell,
  monthCount,
}: {
  status: string;
  items: Project[];
  open: boolean;
  onToggle: () => void;
  sumMonths: (items: Project[], i: number) => number;
  cell: (v: number) => string;
  monthCount: number;
}) {
  const style = STATUS_STYLE[status];
  const total = items.reduce((s, p) => s + p.monthly.reduce((a, b) => a + b, 0), 0);
  return (
    <>
      <tr className={cn("font-semibold", style.row)}>
        <td className="sticky left-0 border-b border-border px-2 py-1.5">
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 cursor-pointer">
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            <span className={cn("rounded px-1.5 py-0.5 text-[11px]", style.badge)}>{status}</span>
            <span className="text-navy-900">{items.length} โครงการ</span>
          </button>
        </td>
        {Array.from({ length: monthCount }, (_, i) => (
          <td key={i} className="border-b border-border px-2 py-1.5 text-right tabular-nums">
            {cell(sumMonths(items, i))}
          </td>
        ))}
        <td className="border-b border-border px-2 py-1.5 text-right tabular-nums">{formatMB(total)}</td>
      </tr>
      {open &&
        items.map((p) => (
          <tr key={p.budgetCode} className="hover:bg-navy-50/60">
            <td className="sticky left-0 border-b border-border bg-white px-2 py-1.5 pl-8">
              <div className="text-navy-900">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {p.department} · สิ้นสุด {formatDate(p.endDate)}
              </div>
            </td>
            {p.monthly.map((v, i) => (
              <td key={i} className="border-b border-border px-2 py-1.5 text-right tabular-nums">
                {cell(v)}
              </td>
            ))}
            <td className="border-b border-border px-2 py-1.5 text-right font-medium tabular-nums">
              {formatMB(p.monthly.reduce((a, b) => a + b, 0))}
            </td>
          </tr>
        ))}
    </>
  );
}
