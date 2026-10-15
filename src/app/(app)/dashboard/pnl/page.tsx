"use client";

import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps } from "@/components/charts/theme";
import { PIE_COLORS } from "@/components/dashboard/pie-panel";
import { Gauge, Panel, Signed, TreeTable } from "@/components/dashboard/widgets";
import { useCan } from "@/components/layout/user-context";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/misc";
import { useDashboardPage } from "@/hooks/dashboard";
import { downloadCsv } from "@/lib/csv";
import { cn, formatMB } from "@/lib/utils";
import type { PnlRow, PnlValues } from "@/server/dashboard/pages";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PnlPage() {
  const { data, isLoading, error } = useDashboardPage("pnl");
  const canExport = useCan("report.export");
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data) return null;
  const d = data.data;
  const { month, year } = data.filters;
  const ytdLabel = month === 1 ? "Jan" : `Jan–${MONTHS_EN[month - 1]}`;
  const next = month < 12 ? MONTHS_EN[month] : "-";
  const toGoLabel = month + 2 <= 12 ? `${MONTHS_EN[month + 1]}–Dec` : "-";

  const v = (r: PnlRow, f: (x: PnlValues) => React.ReactNode) => (r.values ? f(r.values) : "");
  const pctCell = (n: number) => <span className="text-muted-foreground">{n.toFixed(1)}%</span>;
  const columns = [
    { key: "b", label: `Budget ${year}`, render: (r: PnlRow) => v(r, (x) => formatMB(x.budget)) },
    { key: "bp", label: "% to Op. Income", render: (r: PnlRow) => v(r, (x) => pctCell(x.budgetPct)) },
    { key: "by", label: `Budget ${ytdLabel}`, render: (r: PnlRow) => v(r, (x) => formatMB(x.budgetYtd)) },
    { key: "byp", label: "% to Op. Income", render: (r: PnlRow) => v(r, (x) => pctCell(x.budgetYtdPct)) },
    { key: "a", label: `Actual ${ytdLabel}`, render: (r: PnlRow) => v(r, (x) => <b className="text-navy-900">{formatMB(x.actualYtd)}</b>) },
    { key: "ap", label: "% to Op. Income", render: (r: PnlRow) => v(r, (x) => pctCell(x.actualYtdPct)) },
    { key: "n", label: `Budget ${next}`, render: (r: PnlRow) => v(r, (x) => formatMB(x.budgetNext)) },
    { key: "p", label: `Projection ${Math.min(month + 1, 12)} mths`, render: (r: PnlRow) => v(r, (x) => formatMB(x.projection)) },
    {
      key: "rm",
      label: "Remaining Budget",
      render: (r: PnlRow) => v(r, (x) => <span className={cn(x.remaining < 0 && "text-danger")}>{formatMB(x.remaining)}</span>),
    },
    {
      key: "c",
      label: "Change From Plan",
      render: (r: PnlRow) => v(r, (x) => <Signed value={x.changeFromPlan} invert={r.side === "expense"} />),
    },
    { key: "tg", label: `To go ${toGoLabel} Plan`, render: (r: PnlRow) => v(r, (x) => formatMB(x.toGoPlan)) },
    { key: "o", label: `Outlook ${year}`, render: (r: PnlRow) => v(r, (x) => <b className="text-navy-900">{formatMB(x.outlook)}</b>) },
  ];

  const exportCsv = () => {
    const out: (string | number)[][] = [
      ["Line", `Budget ${year}`, "%", `Budget ${ytdLabel}`, "%", `Actual ${ytdLabel}`, "%", `Budget ${next}`, "Projection", "Remaining Budget", "Change From Plan", "To go Plan", `Outlook ${year}`],
    ];
    const walk = (rows: PnlRow[], depth: number) => {
      for (const r of rows) {
        const x = r.values;
        out.push([
          `${"  ".repeat(depth)}${r.label}`,
          ...(x
            ? [x.budget, x.budgetPct.toFixed(1), x.budgetYtd, x.budgetYtdPct.toFixed(1), x.actualYtd, x.actualYtdPct.toFixed(1), x.budgetNext, x.projection, x.remaining, x.changeFromPlan, x.toGoPlan, x.outlook]
            : []),
        ]);
        if (r.children) walk(r.children, depth + 1);
      }
    };
    walk(d.rows, 0);
    downloadCsv(`iod-pnl-${year}-${String(month).padStart(2, "0")}.csv`, out);
  };

  const op = d.operatingIncome;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Operating Income (MB)" subtitle={`Net Operating Income · Actual ${ytdLabel} เทียบแผนทั้งปี`} focusId="operating-income" info="Net Operating Income = รายได้จากการดำเนินงานสุทธิ ตามโครงสร้าง P&L · % Achieved = Actual ÷ Plan ทั้งปี">
          <div className="relative flex flex-col items-center">
            <Gauge value={op.actual} max={op.plan} />
            {op.over > 0 && (
              <span className="absolute top-0 right-0 rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">
                Over Plan +{formatMB(op.over)}
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Operating Income Plan" value={formatMB(op.plan)} />
            <Stat label="Actual Operating Income" value={formatMB(op.actual)} strong />
            <Stat label="% Achieved" value={`${op.achievePct.toFixed(1)}%`} tone={op.achievePct >= 0 ? "good" : "bad"} />
            <Stat label="To Go" value={formatMB(op.toGo)} tone={op.toGo < 0 ? "bad" : "good"} />
            <Stat label="% To Go" value={`${op.toGoPct.toFixed(1)}%`} tone={op.toGoPct < 0 ? "bad" : "good"} />
          </div>
        </Panel>
        <Panel title="Development Project (MB)" subtitle={`งบโครงการพิเศษ (Special Project) · Actual ${ytdLabel} แยกรายเดือน`} className="lg:col-span-2">
          <div className="chart-box" style={{ height: Math.max(220, d.developmentProjects.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.developmentProjects} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={(x) => formatMB(Number(x))} />
                <YAxis type="category" dataKey="name" {...axisProps} width={190} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip formatter={(x) => `${formatMB(Number(x))} MB`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                {d.devMonths.map((mLabel, i) => (
                  <Bar key={mLabel} dataKey={mLabel} name={mLabel} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} maxBarSize={16} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title="P&L (MB)"
        subtitle={`% to Op. Income = ÷ Net Operating Income ของคอลัมน์เดียวกัน · Projection = Actual ${ytdLabel} + Budget ${next} · Outlook = Projection + To go Plan`}
        actions={
          canExport && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          )
        }
      >
        <TreeTable<PnlRow>
          rows={d.rows}
          firstLabel="รายการ"
          columns={columns}
          maxHeight={760}
          rowClassName={(r, depth) =>
            cn(
              r.kind === "header" && "bg-navy-100 font-bold text-navy-900",
              r.kind === "total" && depth === 0 && "bg-navy-900/5 font-bold",
              /^(ebitda|revenues over expenses net)$/i.test(r.label) && "bg-navy-900/10",
            )
          }
        />
      </Panel>
    </div>
  );
}

function Stat({ label, value, tone, strong }: { label: string; value: string; tone?: "good" | "bad"; strong?: boolean }) {
  return (
    <div className="rounded-md bg-muted/70 px-1.5 py-1.5">
      <div
        className={cn(
          "font-semibold tabular-nums text-navy-900",
          strong ? "text-base" : "text-sm",
          tone === "good" && "text-success",
          tone === "bad" && "text-danger",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
