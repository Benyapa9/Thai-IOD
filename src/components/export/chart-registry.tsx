"use client";

import type { PageData } from "@/hooks/dashboard";
import type { FeatureKey } from "@/lib/access/catalog";
import { formatMB } from "@/lib/utils";
import { type Box, ExportBars, ExportKpi, ExportLines, ExportPie, ExportStats, ExportTable } from "./export-charts";
import type { ChartSize } from "./layout-engine";
import type { ExportTheme } from "./themes";

/*
 * Central list of everything that can go into an exported report. To add a
 * chart: add one entry here (id, title, page, size, render, and optionally a
 * native PowerPoint spec). Data always comes from the same dashboard APIs the
 * pages use, with the user's current filters.
 */

export type DataKey = keyof PageData;
export type ReportPage = "main" | "pnl" | "capital";

export const REPORT_PAGES: { id: ReportPage; label: string; feature?: FeatureKey }[] = [
  { id: "main", label: "Main Dashboard" },
  { id: "pnl", label: "P&L", feature: "forecast.view" },
  { id: "capital", label: "Capital (CAPEX)" },
];

/** Editable chart for PowerPoint (pptxgenjs). Values already in display units. */
export interface NativeChart {
  type: "bar" | "line" | "doughnut";
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  horizontal?: boolean;
  stacked?: boolean;
  /** number format shown on the value axis */
  format?: string;
}

export interface ChartEntry<K extends DataKey = DataKey> {
  id: string;
  title: string;
  subtitle?: string;
  page: ReportPage;
  /** Sub-page inside Main Dashboard, shown as a group label */
  section: string;
  data: K;
  size: ChartSize;
  render: (d: PageData[K], theme: ExportTheme, box: Box) => React.ReactNode;
  native?: (d: PageData[K], theme: ExportTheme) => NativeChart | null;
}

const entry = <K extends DataKey>(e: ChartEntry<K>) => e as unknown as ChartEntry;
const mb = (n: number | null | undefined) => Math.round(((n ?? 0) / 1e6) * 100) / 100;
const pctText = (n: number) => `${n.toFixed(1)}%`;
/** Months that already have actuals (so lines do not drop to zero in PowerPoint). */
const actualMonths = <T extends { label: string }>(rows: T[], has: (r: T) => boolean) => {
  const last = rows.reduce((acc, r, i) => (has(r) ? i : acc), -1);
  return last < 0 ? rows : rows.slice(0, last + 1);
};

export const CHART_REGISTRY: ChartEntry[] = [
  // ── Main · Key Financial Indicators ──
  entry({
    id: "kpi.revenue",
    title: "Revenue (MB)",
    subtitle: "รายได้สะสม (YTD) เทียบแผน",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportKpi
        label="Actual Revenue"
        actual={d.revenue.actual}
        plan={d.revenue.plan}
        achievePct={d.revenue.achievePct}
        extra={[{ label: "แผนทั้งปี", value: formatMB(d.revenue.planFull) }]}
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "kpi.expense",
    title: "Expenditures (MB)",
    subtitle: "ค่าใช้จ่ายสะสม (YTD) เทียบงบ",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportKpi
        label="Actual Expense"
        actual={d.expense.actual}
        plan={d.expense.plan}
        achievePct={d.expense.achievePct}
        extra={[{ label: "งบทั้งปี", value: formatMB(d.expense.planFull) }]}
        invert
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "kpi.net",
    title: "Revenue Over Expense (MB)",
    subtitle: "กำไรสะสม (YTD) เทียบแผน",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "quarter",
    render: (d, theme, box) => <ExportKpi label="Actual Profit" actual={d.net.actual} plan={d.net.plan} achievePct={d.net.achievePct} theme={theme} box={box} />,
  }),
  entry({
    id: "kpi.ebitda",
    title: "EBITDA (YTD)",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportStats
        items={[
          { label: "Actual EBITDA (MB)", value: formatMB(d.ebitda.actual) },
          { label: "Budget EBITDA (MB)", value: formatMB(d.ebitda.budget) },
          { label: "% ของ Net Operating Income (Actual)", value: pctText(d.ebitda.actualPct) },
          { label: "% ของ Net Operating Income (Budget)", value: pctText(d.ebitda.budgetPct) },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "kpi.monthly",
    title: "Monthly Performance — Revenue",
    subtitle: "รายได้รายเดือน Actual เทียบ Target (ล้านบาท)",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "half",
    render: (d, theme, box) => (
      <ExportLines
        data={d.monthly}
        category="label"
        series={[
          { key: "revenueActual", name: "Actual", color: 0 },
          { key: "revenuePlan", name: "Target", color: 1, dashed: true },
        ]}
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => {
      const rows = actualMonths(d.monthly, (r) => r.revenueActual !== null);
      return {
        type: "line",
        labels: rows.map((r) => r.label),
        series: [
          { name: "Actual", values: rows.map((r) => mb(r.revenueActual)), color: theme.series[0] },
          { name: "Target", values: rows.map((r) => mb(r.revenuePlan)), color: theme.series[1] },
        ],
        format: "#,##0.0",
      };
    },
  }),
  entry({
    id: "kpi.profitCenter",
    title: "Revenue by Profit Center",
    subtitle: "รายได้สะสม Actual เทียบ Plan (ล้านบาท)",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars
        data={d.byProfitCenter.slice(0, 10)}
        category="profitCenter"
        series={[
          { key: "actual", name: "Actual", color: 0 },
          { key: "plan", name: "Plan", color: 1 },
        ]}
        horizontal
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => {
      const rows = d.byProfitCenter.slice(0, 10);
      return {
        type: "bar",
        horizontal: true,
        labels: rows.map((r) => r.profitCenter),
        series: [
          { name: "Actual", values: rows.map((r) => mb(r.actual)), color: theme.series[0] },
          { name: "Plan", values: rows.map((r) => mb(r.plan)), color: theme.series[1] },
        ],
        format: "#,##0.0",
      };
    },
  }),
  entry({
    id: "kpi.atAGlance",
    title: "P&L At A Glance by Department",
    subtitle: "แผนสะสม (YTD) และส่วนที่เหลือจากแผนทั้งปี (ล้านบาท)",
    page: "main",
    section: "Key Financial Indicators",
    data: "kpi",
    size: "full",
    render: (d, theme, box) => (
      <ExportTable
        rows={d.byDepartment}
        cols={[
          { label: "หน่วยงาน", value: (r) => r.department },
          { label: "Revenue Plan", value: (r) => formatMB(r.revenuePlan), align: "right" },
          { label: "Revenue To Go", value: (r) => formatMB(r.revenueToGo), align: "right" },
          { label: "Expense Budget", value: (r) => formatMB(r.expenseBudget), align: "right" },
          { label: "Expense Balance", value: (r) => formatMB(r.expenseBalance), align: "right", tone: (r) => (r.expenseBalance < 0 ? "neg" : null) },
          { label: "Profit Plan", value: (r) => formatMB(r.profitPlan), align: "right" },
          { label: "Profit To Go", value: (r) => formatMB(r.profitToGo), align: "right" },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),

  // ── Main · Training ──
  entry({
    id: "training.counts",
    title: "Training — จำนวนหลักสูตรและที่นั่ง",
    page: "main",
    section: "Training Courses",
    data: "training",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportStats
        items={[
          { label: "หลักสูตร", value: d.counts.courses.toLocaleString("th-TH") },
          { label: "รุ่น (Class)", value: d.counts.classes.toLocaleString("th-TH") },
          { label: "ที่นั่งตามแผน", value: d.counts.seatPlan.toLocaleString("th-TH") },
          { label: "ที่นั่งจริง", value: d.counts.actualSeats.toLocaleString("th-TH") },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "training.revenueByGroup",
    title: "Training Revenue by Skill Group",
    subtitle: "สัดส่วนรายได้สะสม (YTD)",
    page: "main",
    section: "Training Courses",
    data: "training",
    size: "half",
    render: (d, theme, box) => <ExportPie data={d.revenueByGroup} theme={theme} box={box} />,
    native: (d) => ({ type: "doughnut", labels: d.revenueByGroup.map((r) => r.name), series: [{ name: "Revenue", values: d.revenueByGroup.map((r) => mb(r.value)) }] }),
  }),
  entry({
    id: "training.margin",
    title: "Margin by Program",
    subtitle: "รายได้และกำไร (ล้านบาท)",
    page: "main",
    section: "Training Courses",
    data: "training",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars
        data={d.marginByGroup}
        category="name"
        series={[
          { key: "revenue", name: "Revenue", color: 0 },
          { key: "earning", name: "Earning", color: 1 },
        ]}
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => ({
      type: "bar",
      labels: d.marginByGroup.map((r) => r.name),
      series: [
        { name: "Revenue", values: d.marginByGroup.map((r) => mb(r.revenue)), color: theme.series[0] },
        { name: "Earning", values: d.marginByGroup.map((r) => mb(r.earning)), color: theme.series[1] },
      ],
      format: "#,##0.0",
    }),
  }),

  // ── Main · Expenditure ──
  entry({
    id: "expenditure.monthly",
    title: "Expenditure — Budget vs Actual",
    subtitle: "ค่าใช้จ่ายรายเดือน (ล้านบาท)",
    page: "main",
    section: "Expenditure by Department",
    data: "expenditure",
    size: "half",
    render: (d, theme, box) => (
      <ExportLines
        data={d.monthly}
        category="label"
        series={[
          { key: "actual", name: "Actual", color: 0 },
          { key: "budget", name: "Budget", color: 1, dashed: true },
        ]}
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => {
      const rows = actualMonths(d.monthly, (r) => r.actual !== null);
      return {
        type: "line",
        labels: rows.map((r) => r.label),
        series: [
          { name: "Actual", values: rows.map((r) => mb(r.actual)), color: theme.series[0] },
          { name: "Budget", values: rows.map((r) => mb(r.budget)), color: theme.series[1] },
        ],
        format: "#,##0.0",
      };
    },
  }),
  entry({
    id: "expenditure.byDepartment",
    title: "Expenditure by Department",
    subtitle: "ค่าใช้จ่ายสะสม (YTD) สูงสุด 10 หน่วยงาน (ล้านบาท)",
    page: "main",
    section: "Expenditure by Department",
    data: "expenditure",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars
        data={[...d.byDepartment].sort((a, b) => b.value - a.value).slice(0, 10)}
        category="name"
        series={[{ key: "value", name: "Actual", color: 0 }]}
        horizontal
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => {
      const rows = [...d.byDepartment].sort((a, b) => b.value - a.value).slice(0, 10);
      return { type: "bar", horizontal: true, labels: rows.map((r) => r.name), series: [{ name: "Actual", values: rows.map((r) => mb(r.value)), color: theme.series[0] }], format: "#,##0.0" };
    },
  }),
  entry({
    id: "expenditure.overview",
    title: "Expenditure Overview by Department",
    subtitle: "งบประมาณเทียบค่าใช้จ่ายจริงสะสม (ล้านบาท)",
    page: "main",
    section: "Expenditure by Department",
    data: "expenditure",
    size: "full",
    render: (d, theme, box) => (
      <ExportTable
        rows={[...d.overview].sort((a, b) => b.actual - a.actual)}
        cols={[
          { label: "หน่วยงาน", value: (r) => r.department },
          { label: "Budget", value: (r) => formatMB(r.budget), align: "right" },
          { label: "Actual", value: (r) => formatMB(r.actual), align: "right" },
          { label: "Variance", value: (r) => formatMB(r.variance), align: "right", tone: (r) => (r.variance < 0 ? "neg" : "pos") },
          { label: "% ที่ใช้", value: (r) => pctText(r.usedPct), align: "right", tone: (r) => (r.usedPct > 100 ? "neg" : null) },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),

  // ── Main · Membership ──
  entry({
    id: "membership.segments",
    title: "Membership, Sponsorship & Seminar",
    subtitle: "รายได้สะสม Actual เทียบ Plan (ล้านบาท)",
    page: "main",
    section: "Membership & Sponsorship",
    data: "membership",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars
        data={[
          { name: "Membership", actual: d.membership.actual, plan: d.membership.plan },
          { name: "Sponsorship", actual: d.sponsorship.actual, plan: d.sponsorship.plan },
          { name: "Seminar", actual: d.seminar.actual, plan: d.seminar.plan },
        ]}
        category="name"
        series={[
          { key: "actual", name: "Actual", color: 0 },
          { key: "plan", name: "Plan", color: 1 },
        ]}
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => ({
      type: "bar",
      labels: ["Membership", "Sponsorship", "Seminar"],
      series: [
        { name: "Actual", values: [d.membership.actual, d.sponsorship.actual, d.seminar.actual].map(mb), color: theme.series[0] },
        { name: "Plan", values: [d.membership.plan, d.sponsorship.plan, d.seminar.plan].map(mb), color: theme.series[1] },
      ],
      format: "#,##0.0",
    }),
  }),
  entry({
    id: "membership.active",
    title: "Active Members",
    subtitle: "จำนวนสมาชิกคงอยู่รายเดือน",
    page: "main",
    section: "Membership & Sponsorship",
    data: "membership",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars data={d.activeSeries} category="label" series={[{ key: "value", name: "Active Members", color: 0 }]} theme={theme} box={box} />
    ),
    native: (d, theme) => {
      const rows = actualMonths(d.activeSeries, (r) => r.value !== null);
      return { type: "bar", labels: rows.map((r) => r.label), series: [{ name: "Active Members", values: rows.map((r) => r.value ?? 0), color: theme.series[0] }], format: "#,##0" };
    },
  }),
  entry({
    id: "membership.counts",
    title: "Events & Sponsors",
    page: "main",
    section: "Membership & Sponsorship",
    data: "membership",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportStats
        items={[
          { label: "งานสัมมนา / Event", value: d.counts.events.toLocaleString("th-TH") },
          { label: "ผู้เข้าร่วม", value: d.counts.participants.toLocaleString("th-TH") },
          { label: "ผู้สนับสนุน", value: d.counts.sponsors.toLocaleString("th-TH") },
          { label: "สมาชิกคงอยู่", value: d.counts.activeMembers === null ? "-" : d.counts.activeMembers.toLocaleString("th-TH") },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),

  // ── P&L ──
  entry({
    id: "pnl.operatingIncome",
    title: "Operating Income",
    subtitle: "Net Operating Income สะสมเทียบแผนทั้งปี",
    page: "pnl",
    section: "P&L",
    data: "pnl",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportKpi
        label="Actual Operating Income"
        actual={d.operatingIncome.actual}
        plan={d.operatingIncome.plan}
        achievePct={d.operatingIncome.achievePct}
        extra={[{ label: "To Go", value: formatMB(d.operatingIncome.toGo) }]}
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "pnl.summary",
    title: "P&L Summary",
    subtitle: "บรรทัดหลักของงบกำไรขาดทุน (ล้านบาท)",
    page: "pnl",
    section: "P&L",
    data: "pnl",
    size: "full",
    render: (d, theme, box) => (
      <ExportTable
        rows={d.rows.filter((r) => r.values)}
        cols={[
          { label: "รายการ", value: (r) => r.label, bold: (r) => r.kind === "total" },
          { label: "Budget ทั้งปี", value: (r) => formatMB(r.values!.budget), align: "right", bold: (r) => r.kind === "total" },
          { label: "Budget YTD", value: (r) => formatMB(r.values!.budgetYtd), align: "right" },
          { label: "Actual YTD", value: (r) => formatMB(r.values!.actualYtd), align: "right", bold: (r) => r.kind === "total" },
          {
            label: "เทียบแผน",
            value: (r) => formatMB(r.values!.changeFromPlan),
            align: "right",
            tone: (r) => ((r.side === "expense" ? -1 : 1) * r.values!.changeFromPlan < 0 ? "neg" : "pos"),
          },
          { label: "Outlook", value: (r) => formatMB(r.values!.outlook), align: "right" },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "pnl.devProjects",
    title: "Development Projects",
    subtitle: "ค่าใช้จ่ายงบโครงการพิเศษรายเดือน แยกตามประเภท (ล้านบาท)",
    page: "pnl",
    section: "P&L",
    data: "pnl",
    size: "half",
    render: (d, theme, box) => {
      const rows = d.devMonths.map((m) => ({ month: m, ...Object.fromEntries(d.developmentProjects.map((p) => [String(p.name), Number(p[m] ?? 0)])) }));
      return (
        <ExportBars
          data={rows}
          category="month"
          series={d.developmentProjects.map((p, i) => ({ key: String(p.name), name: String(p.name), color: i, stack: "s" }))}
          theme={theme}
          box={box}
        />
      );
    },
    native: (d, theme) =>
      d.developmentProjects.length
        ? {
            type: "bar",
            stacked: true,
            labels: d.devMonths,
            series: d.developmentProjects.map((p, i) => ({
              name: String(p.name),
              values: d.devMonths.map((m) => mb(Number(p[m] ?? 0))),
              color: theme.series[i % theme.series.length],
            })),
            format: "#,##0.0",
          }
        : null,
  }),

  // ── Capital ──
  entry({
    id: "capital.outlay",
    title: "Capital Outlay",
    subtitle: "เบิกจ่ายงบลงทุนสะสมเทียบแผน",
    page: "capital",
    section: "Capital (CAPEX)",
    data: "capital",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportKpi
        label="Expense Cost"
        actual={d.outlay.actual}
        plan={d.outlay.plan}
        achievePct={d.outlay.achievePct}
        extra={[{ label: "Balance", value: formatMB(d.outlay.balance) }]}
        invert
        theme={theme}
        box={box}
      />
    ),
  }),
  entry({
    id: "capital.status",
    title: "Project Status",
    subtitle: "สถานะโครงการงบลงทุน",
    page: "capital",
    section: "Capital (CAPEX)",
    data: "capital",
    size: "quarter",
    render: (d, theme, box) => (
      <ExportPie
        data={[
          { name: "Completed", value: d.statusCounts.completed },
          { name: "In-Progress", value: d.statusCounts.inProgress },
          { name: "Delay", value: d.statusCounts.delay },
        ].filter((x) => x.value > 0)}
        theme={theme}
        box={box}
      />
    ),
    native: (d) => ({
      type: "doughnut",
      labels: ["Completed", "In-Progress", "Delay"],
      series: [{ name: "โครงการ", values: [d.statusCounts.completed, d.statusCounts.inProgress, d.statusCounts.delay] }],
    }),
  }),
  entry({
    id: "capital.byDepartment",
    title: "Capital Expense by Department",
    subtitle: "ค่าใช้จ่ายงบลงทุนที่ใช้ไป (ล้านบาท)",
    page: "capital",
    section: "Capital (CAPEX)",
    data: "capital",
    size: "half",
    render: (d, theme, box) => (
      <ExportBars
        data={[...d.byDepartment].sort((a, b) => b.value - a.value).slice(0, 10)}
        category="name"
        series={[{ key: "value", name: "Expense", color: 0 }]}
        horizontal
        theme={theme}
        box={box}
      />
    ),
    native: (d, theme) => {
      const rows = [...d.byDepartment].sort((a, b) => b.value - a.value).slice(0, 10);
      return { type: "bar", horizontal: true, labels: rows.map((r) => r.name), series: [{ name: "Expense", values: rows.map((r) => mb(r.value)), color: theme.series[0] }], format: "#,##0.0" };
    },
  }),
  entry({
    id: "capital.projects",
    title: "Capital Projects",
    subtitle: "โครงการงบลงทุน เรียงตามงบประมาณ (ล้านบาท)",
    page: "capital",
    section: "Capital (CAPEX)",
    data: "capital",
    size: "full",
    render: (d, theme, box) => (
      <ExportTable
        rows={d.projects}
        cols={[
          { label: "โครงการ", value: (r) => r.name },
          { label: "หน่วยงาน", value: (r) => r.department },
          { label: "Budget YTD", value: (r) => formatMB(r.budget), align: "right" },
          { label: "ใช้ไป", value: (r) => formatMB(r.used), align: "right" },
          { label: "% Achieve", value: (r) => pctText(r.achievePct), align: "right" },
          { label: "สถานะ", value: (r) => r.status, tone: (r) => (r.status === "Delay" ? "neg" : r.status === "Completed" ? "pos" : null) },
        ]}
        theme={theme}
        box={box}
      />
    ),
  }),
];

export const ENTRY_BY_ID = new Map(CHART_REGISTRY.map((e) => [e.id, e]));
