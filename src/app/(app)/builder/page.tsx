"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_COLORS, CHART, axisProps } from "@/components/charts/theme";
import { useCan } from "@/components/layout/user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, SegmentedControl } from "@/components/ui/misc";
import { useRecords } from "@/hooks/queries";
import { downloadCsv } from "@/lib/csv";
import { CATEGORY_LABEL } from "@/lib/labels";
import { formatCompact, formatPeriod, formatTHB, quarterOf } from "@/lib/utils";
import { CATEGORIES, type Category } from "@/types/domain";

type ChartType = "bar" | "line" | "area" | "pie";
type Metric = "revenue" | "expense" | "budget" | "noi";
type Grain = "month" | "quarter";
type Row = Record<string, number | string>;

const METRIC_LABEL: Record<Metric, string> = {
  revenue: "รายได้",
  expense: "ค่าใช้จ่าย",
  budget: "งบประมาณ",
  noi: "NOI (รายได้ − ค่าใช้จ่าย)",
};

export default function BuilderPage() {
  const { data: records = [], isLoading, error } = useRecords();
  const canExport = useCan("report.export");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [grain, setGrain] = useState<Grain>("month");
  const [stacked, setStacked] = useState(false);
  const [cats, setCats] = useState<Category[]>([...CATEGORIES]);
  const monthly = records.filter((r) => r.periodType === "monthly");
  const allPeriods = [...new Set(monthly.map((r) => r.period))].sort();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const pFrom = from || allPeriods[0] || "";
  const pTo = to || allPeriods.at(-1) || "";

  const data = useMemo((): Row[] => {
    const rows = new Map<string, Row>();
    for (const r of monthly) {
      if (r.period < pFrom || r.period > pTo || !cats.includes(r.category)) continue;
      const key = grain === "quarter" ? quarterOf(r.period) : r.period;
      const row = rows.get(key) ?? { period: key, ...Object.fromEntries(cats.map((c) => [c, 0])) };
      const sign = metric === "noi" ? (r.type === "revenue" ? 1 : r.type === "expense" ? -1 : 0) : r.type === metric ? 1 : 0;
      row[r.category] = (row[r.category] as number) + sign * r.amount;
      rows.set(key, row);
    }
    return [...rows.values()]
      .sort((a, b) => String(a.period).localeCompare(String(b.period)))
      .map((r) => ({ ...r, label: formatPeriod(String(r.period)) }));
  }, [monthly, pFrom, pTo, cats, grain, metric]);

  const pieData = cats.map((c) => ({
    name: CATEGORY_LABEL[c],
    category: c,
    value: data.reduce((s, r) => s + Number(r[c] ?? 0), 0),
  }));

  const title = `${METRIC_LABEL[metric]} ${grain === "quarter" ? "รายไตรมาส" : "รายเดือน"}`;

  const series = cats.map((c) => ({ key: c, name: CATEGORY_LABEL[c], color: CATEGORY_COLORS[c] }));
  const stackId = stacked ? "s" : undefined;

  function renderChart() {
    const common = (
      <>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompact(Number(v))} width={52} />
        <Tooltip formatter={(v) => formatTHB(Number(v))} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </>
    );
    if (chartType === "pie") {
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="80%" innerRadius="45%" paddingAngle={1} label={(e) => e.name}>
            {pieData.map((p) => (
              <Cell key={p.category} fill={CATEGORY_COLORS[p.category]} stroke="#fff" />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatTHB(Number(v))} />
        </PieChart>
      );
    }
    if (chartType === "line") {
      return (
        <LineChart data={data}>
          {common}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      );
    }
    if (chartType === "area") {
      return (
        <AreaChart data={data}>
          {common}
          {series.map((s) => (
            <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.25} stackId={stackId} />
          ))}
        </AreaChart>
      );
    }
    return (
      <BarChart data={data}>
        {common}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stackId} maxBarSize={36} />
        ))}
      </BarChart>
    );
  }

  return (
    <>
      <PageHeader title="Chart Builder" description="สร้างกราฟตามมุมมองที่ต้องการจากข้อมูลที่อัปโหลด" />
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock error={error} />
      ) : monthly.length === 0 ? (
        <EmptyState title="ยังไม่มีข้อมูลรายเดือน" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <Label>ประเภทกราฟ</Label>
                <SegmentedControl<ChartType>
                  value={chartType}
                  onChange={setChartType}
                  options={[
                    { value: "bar", label: "Bar" },
                    { value: "line", label: "Line" },
                    { value: "area", label: "Area" },
                    { value: "pie", label: "Pie" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="metric">ตัวชี้วัด</Label>
                <Select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                  {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                    <option key={m} value={m}>
                      {METRIC_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>ช่วงเวลา</Label>
                <SegmentedControl<Grain>
                  value={grain}
                  onChange={setGrain}
                  options={[
                    { value: "month", label: "รายเดือน" },
                    { value: "quarter", label: "รายไตรมาส" },
                  ]}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input type="month" aria-label="ตั้งแต่" value={pFrom} onChange={(e) => setFrom(e.target.value)} />
                  <Input type="month" aria-label="ถึง" value={pTo} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>หมวด</Label>
                <div className="space-y-1.5">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-navy-800"
                        checked={cats.includes(c)}
                        onChange={(e) =>
                          setCats((prev) =>
                            e.target.checked ? CATEGORIES.filter((x) => prev.includes(x) || x === c) : prev.filter((x) => x !== c),
                          )
                        }
                      />
                      <span className="size-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c] }} />
                      {CATEGORY_LABEL[c]}
                    </label>
                  ))}
                </div>
              </div>
              {(chartType === "bar" || chartType === "area") && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-navy-800" checked={stacked} onChange={(e) => setStacked(e.target.checked)} />
                  แสดงแบบซ้อน (Stacked)
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv("iod-chart-data.csv", [
                      ["period", ...cats],
                      ...data.map((r) => [String(r.period), ...cats.map((c) => Number(r[c] ?? 0))]),
                    ])
                  }
                >
                  <Download /> Export CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <EmptyState title="เลือกอย่างน้อย 1 หมวด" />
              ) : (
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
