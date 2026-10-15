"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
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
import { PIE_COLORS } from "@/components/dashboard/pie-panel";
import { MetricPanel, Panel, Signed, StatCard, TreeTable } from "@/components/dashboard/widgets";
import { ErrorBlock, LoadingBlock, SegmentedControl } from "@/components/ui/misc";
import { useDashboardPage } from "@/hooks/dashboard";
import { formatMB } from "@/lib/utils";
import type { MembershipPage as Data } from "@/server/dashboard/pages";

type PerfRow = Data["performanceByType"][number];
type Mode = "mtd" | "ytd";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function MembershipPage() {
  const { data, isLoading, error } = useDashboardPage("membership");
  const [mode, setMode] = useState<Mode>("mtd");
  const grad = useLineGradient();
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;
  const month = data.filters.month;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel title="Revenue - Membership (MB)" data={d.membership} kind="revenue" focusId="membership" />
        <MetricPanel title="Revenue - Sponsorship (MB)" data={d.sponsorship} kind="revenue" focusId="sponsorship" />
        <MetricPanel title="Revenue - Seminar (MB)" data={d.seminar} kind="revenue" focusId="seminar" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Event Participants" value={d.counts.participants.toLocaleString()} hint="ชื่อ-นามสกุลไม่ซ้ำในแต่ละกิจกรรม (สะสม)" />
        <StatCard label="Number of Events" value={d.counts.events.toLocaleString()} hint="จำนวน regi_Name ไม่ซ้ำ (สะสม)" />
        <StatCard
          label="Number of Active Members"
          value={d.counts.activeMembers !== null ? d.counts.activeMembers.toLocaleString() : "-"}
          hint={`Template Member (Actual) เดือน ${THAI_MONTHS[month - 1]}`}
        />
        <StatCard label="Number of Sponsors" value={d.counts.sponsors.toLocaleString()} hint="บริษัทไม่ซ้ำที่มีเลขที่ใบเสร็จ (สะสม)" />
      </div>

      <Panel
        title="Member Retention & Acquisition"
        subtitle="แท่ง = จำนวนจริงแยกตามประเภทสมาชิก (Annual Fee = ต่ออายุ, Annual New = ใหม่) · เส้น = Plan จาก Template Member"
        actions={
          <SegmentedControl<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "mtd", label: "MTD" },
              { value: "ytd", label: "YTD" },
            ]}
          />
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <MemberChart title={`${mode.toUpperCase()} Member Retention`} rows={d.retention} types={d.memberTypes} mode={mode} />
          <MemberChart title={`${mode.toUpperCase()} Member Acquisition`} rows={d.acquisition} types={d.memberTypes} mode={mode} />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Actual Performance" subtitle="รายได้จริงสะสม เทียบส่วนที่ยังต้องทำ (To Go = Plan − Actual) แยกตามกิจกรรม">
          {d.actualPerformance.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>
          ) : (
            <div className="chart-box" style={{ height: Math.max(180, d.actualPerformance.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.actualPerformance} layout="vertical" stackOffset="expand" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" {...axisProps} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={110} />
                  <Tooltip formatter={(v) => `${formatMB(Number(v))} MB`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="actual" name="Actual Revenue" stackId="a" fill={CHART.revenue} maxBarSize={22} />
                  <Bar dataKey="toGo" name="To Go" stackId="a" fill={CHART.expense} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Performance by Type (MB)" subtitle="Profit Center → โครงการ · สะสม" info="GP (Gross Profit) = Actual Revenue − Direct Expense">
          <TreeTable<PerfRow>
            rows={d.performanceByType}
            firstLabel="Group / โครงการ"
            maxHeight={320}
            columns={[
              { key: "r", label: "Actual Revenue", render: (r) => formatMB(r.revenue), sortValue: (r) => r.revenue },
              { key: "e", label: "Direct Expense", render: (r) => formatMB(r.expense), sortValue: (r) => r.expense },
              { key: "g", label: "GP", render: (r) => <Signed value={r.gp} />, sortValue: (r) => r.gp },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Active Members" subtitle="จำนวนสมาชิกคงอยู่ รายเดือน (Template Member · Actual)">
        <div className="chart-box h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.activeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grad.defs}
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={48} domain={["dataMin - 100", "dataMax + 100"]} />
              <Tooltip />
              <Area dataKey="value" type="monotone" stroke="none" fill={grad.fill} legendType="none" tooltipType="none" baseValue="dataMin" />
              <Line dataKey="value" name="Active Members" type="monotone" stroke={grad.stroke} strokeWidth={3} dot={{ r: 3, fill: grad.dot, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

function MemberChart({
  title,
  rows,
  types,
  mode,
}: {
  title: string;
  rows: Data["retention"];
  types: string[];
  mode: Mode;
}) {
  const data = rows.map((r) => ({
    label: r.label,
    plan: mode === "ytd" ? r.planYtd : r.plan,
    ...(mode === "ytd" ? r.ytd : r.mtd),
  }));
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-navy-800">{title}</div>
      <div className="chart-box h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={40} />
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            {types.map((t, i) => (
              <Bar key={t} dataKey={t} name={t} stackId="m" fill={PIE_COLORS[i % PIE_COLORS.length]} maxBarSize={26} />
            ))}
            <Line dataKey="plan" name="Member Plan" stroke="var(--color-danger)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
