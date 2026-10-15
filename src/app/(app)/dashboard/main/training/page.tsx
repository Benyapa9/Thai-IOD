"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PIE_COLORS, PiePanel } from "@/components/dashboard/pie-panel";
import { MetricPanel, Panel, Signed, StatCard, TreeTable } from "@/components/dashboard/widgets";
import { ErrorBlock, LoadingBlock } from "@/components/ui/misc";
import { useDashboardPage } from "@/hooks/dashboard";
import { cn, formatMB } from "@/lib/utils";
import type { TrainingPage as Data } from "@/server/dashboard/pages";

type Row = Data["table"][number];

export default function TrainingPage() {
  const { data, isLoading, error } = useDashboardPage("training");
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;

  const pct = (v: number) => `${v.toFixed(1)}%`;
  const num = (v: number) => (v ? v.toLocaleString() : "-");
  const columns = [
    { key: "rp", label: "Revenue Plan", render: (r: Row) => formatMB(r.revenuePlan), sortValue: (r: Row) => r.revenuePlan },
    { key: "ra", label: "Actual Revenue", render: (r: Row) => <b className="text-navy-900">{formatMB(r.revenueActual)}</b>, sortValue: (r: Row) => r.revenueActual },
    { key: "v", label: "Variance", render: (r: Row) => <Signed value={r.variance} />, sortValue: (r: Row) => r.variance },
    { key: "b", label: "Direct Cost", render: (r: Row) => formatMB(r.budget), sortValue: (r: Row) => r.budget },
    { key: "ea", label: "Actual Expense", render: (r: Row) => formatMB(r.expenseActual), sortValue: (r: Row) => r.expenseActual },
    { key: "cr", label: "Cost to Revenue", render: (r: Row) => (r.revenueActual ? pct(r.costToRevenuePct) : "-"), sortValue: (r: Row) => (r.revenueActual ? r.costToRevenuePct : null) },
    { key: "ev", label: "Variance Exp.", render: (r: Row) => <Signed value={r.expenseVariance} invert />, sortValue: (r: Row) => r.expenseVariance },
    { key: "e", label: "Earning", render: (r: Row) => <Signed value={r.earning} />, sortValue: (r: Row) => r.earning },
    {
      key: "m",
      label: "Margin",
      render: (r: Row) =>
        r.revenueActual ? <span className={cn(r.marginPct >= 0 ? "text-success" : "text-danger")}>{pct(r.marginPct)}</span> : "-",
      sortValue: (r: Row) => (r.revenueActual ? r.marginPct : null),
    },
    { key: "sp", label: "Seats Plan", render: (r: Row) => num(r.seatPlan), sortValue: (r: Row) => r.seatPlan },
    { key: "sa", label: "Actual Seats", render: (r: Row) => num(r.seatActual), sortValue: (r: Row) => r.seatActual },
    { key: "sv", label: "Variance", render: (r: Row) => (r.seatPlan || r.seatActual ? num(r.seatVariance) : "-"), sortValue: (r: Row) => r.seatVariance },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricPanel title="Revenue (MB)" data={d.revenue} kind="revenue" focusId="revenue" />
        <MetricPanel title="Expenditures (MB)" data={d.expense} kind="expense" focusId="expense" />
        <div className="grid grid-cols-2 gap-4 xl:col-span-2">
          <StatCard label="Number of Courses" value={d.counts.courses.toLocaleString()} hint="หลักสูตรที่มีรายได้จริง" />
          <StatCard label="Number of Class" value={d.counts.classes.toLocaleString()} hint="รหัสงบประมาณที่มีรายได้จริง (ไม่รวม Makeup)" />
          <StatCard label="Seats Plan" value={d.counts.seatPlan.toLocaleString()} hint="ที่นั่งตามแผน (BG_YEAR)" />
          <StatCard
            label="Actual Seats"
            value={d.counts.actualSeats.toLocaleString()}
            hint="ที่นั่งจาก BG_Capital ของรุ่นที่มีรายได้จริง"
            tone={d.counts.actualSeats >= d.counts.seatPlan ? "good" : "neutral"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PiePanel title="Revenue by Skill Groups (MB)" data={d.revenueByGroup} />
        <MarginPanel data={d.marginByGroup} />
      </div>

      <Panel title="Performance by Courses (MB)" subtitle="Grouping → Course → Class · สะสมถึงเดือนที่เลือก · คลิกเพื่อขยาย · คลิกหัวตารางเพื่อเรียง" focusId="courses" info="Variance = Actual Revenue − Revenue Plan · Cost to Revenue = Actual Expense ÷ Actual Revenue · Earning = Actual Revenue − Actual Expense · Margin = Earning ÷ Actual Revenue">
        <TreeTable rows={d.table} columns={columns} firstLabel="Grouping / Course / Class" maxHeight={520} />
      </Panel>
    </div>
  );
}

/** Revenue by Margin (Blueprint L003): margin % for DCP, DCP Residential, In-House and Non-DCP. */
function MarginPanel({ data }: { data: Data["marginByGroup"] }) {
  const slices = data.filter((x) => x.marginPct > 0);
  return (
    <Panel title="Revenue by Margin (%)" subtitle="Margin = Earning ÷ Actual Revenue · DCP / DCP Residential / In-House / Non-DCP">
      {slices.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <div className="chart-box h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="marginPct"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={1}
                  label={({ value }) => `${Number(value).toFixed(1)}%`}
                  labelLine={false}
                >
                  {slices.map((x, i) => (
                    <Cell key={x.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <table className="self-center text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-medium">กลุ่ม</th>
                <th className="py-1 text-right font-medium">Revenue</th>
                <th className="py-1 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => (
                <tr key={x.name} className="border-t border-border">
                  <td className="py-1.5 text-navy-900">{x.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMB(x.revenue)}</td>
                  <td className={cn("py-1.5 text-right font-semibold tabular-nums", x.marginPct >= 0 ? "text-success" : "text-danger")}>
                    {x.marginPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
