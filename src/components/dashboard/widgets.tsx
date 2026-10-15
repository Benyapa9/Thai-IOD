"use client";

import {
  Activity,
  AlertTriangle,
  Armchair,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  School,
  UserCheck,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  GraduationCap,
  Handshake,
  Landmark,
  Layers,
  LineChart,
  type LucideIcon,
  Maximize2,
  Minimize2,
  Percent,
  PieChart,
  Rocket,
  Scale,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { IconBadge, type IconTone } from "@/components/ui/misc";
import { InfoTip } from "@/components/ui/info-tip";
import { compareValues } from "@/components/ui/sortable";
import { cn, formatMB } from "@/lib/utils";

// ── Panel ────────────────────────────────────────────────────

/** Icon for a panel from its title, so every card gets a consistent visual cue. First match wins. */
const PANEL_ICONS: [RegExp, LucideIcon, IconTone][] = [
  [/timeline/i, CalendarRange, "slate"],
  [/margin/i, Percent, "amber"],
  [/over expense|profit|ebitda|กำไร/i, Scale, "blue"],
  [/operating income|p&l/i, Landmark, "violet"],
  [/capital|capex|outlay|spending by project|budget detail/i, Building2, "violet"],
  [/sponsor/i, Handshake, "pink"],
  [/member/i, Users, "teal"],
  [/seminar|event/i, CalendarDays, "amber"],
  [/course|training|skill/i, GraduationCap, "amber"],
  [/development project/i, Rocket, "violet"],
  [/monthly|budget vs actual|รายเดือน/i, LineChart, "blue"],
  [/by profit center/i, BarChart3, "green"],
  [/by department|overview|หน่วยงาน/i, PieChart, "navy"],
  [/by type/i, Layers, "navy"],
  [/performance/i, Target, "green"],
  [/expend|expense|ค่าใช้จ่าย/i, Wallet, "red"],
  [/revenue|รายได้/i, TrendingUp, "green"],
];
export function panelIcon(title: string): [LucideIcon, IconTone] {
  const hit = PANEL_ICONS.find(([re]) => re.test(title));
  return hit ? [hit[1], hit[2]] : [BarChart3, "navy"];
}

/**
 * Card around a chart or table. Every panel can be expanded to full screen
 * (MOM D5), explains itself on hover (`info`), and can be the target of a
 * `?focus=` link from Insight / alerts (`focusId`, MOM I6).
 */
export function Panel({
  title,
  subtitle,
  info,
  actions,
  className,
  focusId,
  icon,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  info?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  focusId?: string;
  /** Defaults to an icon picked from the title. */
  icon?: LucideIcon;
  tone?: IconTone;
  children: React.ReactNode;
}) {
  const [autoIcon, autoTone] = panelIcon(title);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  return (
    <>
      {expanded && <div className="fixed inset-0 z-40 bg-navy-950/50" onClick={() => setExpanded(false)} aria-hidden />}
      <Card
        data-focus={focusId}
        className={cn("flex scroll-mt-24 flex-col", className, expanded && "panel-expanded fixed inset-2 z-50 overflow-auto sm:inset-6")}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
          {/* Title and the expand button share a row so the button never wraps on its own. */}
          <div className="flex min-w-0 flex-1 basis-48 items-start gap-2.5">
            <IconBadge icon={icon ?? autoIcon} tone={tone ?? autoTone} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-navy-900">
                {title}
                {info && <InfoTip align="start" className="text-navy-600">{info}</InfoTip>}
              </h3>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? "ย่อกลับ (Esc)" : "ขยายเต็มจอ"}
              aria-label={expanded ? "ย่อกลับ" : "ขยายเต็มจอ"}
              className="no-print shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-navy-900 cursor-pointer"
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className="flex-1 p-4">{children}</div>
      </Card>
    </>
  );
}

// ── Gauge (semicircle) ───────────────────────────────────────

export function Gauge({
  value,
  max,
  overIsBad = false,
  size = 180,
}: {
  value: number;
  max: number;
  overIsBad?: boolean;
  size?: number;
}) {
  // A planned loss (max ≤ 0) has no meaningful fill ratio: show any positive result as a full, good gauge.
  const scale = max > 0 ? max : Math.max(Math.abs(value), 1);
  const ratio = value > 0 ? Math.min(value / scale, 1) : 0;
  const over = value > max;
  const r = 80;
  const len = Math.PI * r;
  const color =
    max <= 0 && value > max
      ? "var(--color-success)"
      : over
        ? overIsBad
          ? "var(--color-danger)"
          : "var(--color-success)"
        : "var(--color-navy-800)";
  return (
    <svg viewBox="0 0 200 110" width={size} height={(size * 110) / 200} role="img" aria-label={`${formatMB(value)} จาก ${formatMB(max)}`}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--color-navy-100)" strokeWidth="18" />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke={color}
        strokeWidth="18"
        strokeDasharray={`${len * ratio} ${len}`}
      />
      <text x="100" y="86" textAnchor="middle" className="fill-navy-900" style={{ fontSize: 26, fontWeight: 700 }}>
        {formatMB(value)}
      </text>
      <text x="20" y="108" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
        0
      </text>
      <text x="180" y="108" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
        {formatMB(max, 1)}
      </text>
    </svg>
  );
}

// ── Metric panel: gauge + actual / balance / % achieve / % to go ──

export interface ProgressData {
  actual: number;
  /** Plan / budget up to the selected month (YTD) — the gauge maximum. */
  plan: number;
  planFull: number;
  /** Plan − actual for revenue/expense (0 when negative); actual − plan (≤ 0) for profit. */
  balance: number;
  achievePct: number;
  balancePct: number;
  /** Amount beyond plan, drives the Over Plan / Over Budget marker. */
  over: number;
}

type MetricKind = "revenue" | "expense" | "profit";

const LABELS: Record<MetricKind, { plan: string; actual: string; balance: string; balancePct: string; over: string }> = {
  revenue: { plan: "Revenue Plan", actual: "Actual Revenue", balance: "Balance", balancePct: "% To Go", over: "Over Plan" },
  expense: { plan: "Budget Cost", actual: "Actual Expense", balance: "Balance", balancePct: "% Balance", over: "Over Budget" },
  profit: { plan: "Profit Plan", actual: "Actual Profit", balance: "To Go", balancePct: "% To Go", over: "Over Plan" },
};

/**
 * Gauge + cards (Blueprint Main L001–L003): value = actual YTD, maximum = plan YTD.
 * Colours: % Achieved green ≥ 0 (expense: red above 100%); negative To Go red.
 */
const METRIC_INFO: Record<MetricKind, string> = {
  revenue: "Actual = รายได้จริงสะสมถึงเดือนที่เลือก (บัญชีหมวด 4, Cr − Dr) · Plan = แผนรายได้ของเดือน ม.ค. ถึงเดือนที่เลือก · % Achieved = Actual ÷ Plan · % To Go = ส่วนที่ยังขาดเทียบแผน",
  expense: "Actual = ค่าใช้จ่ายจริงสะสม (บัญชีหมวด 5/6, Dr − Cr) ไม่รวมงบลงทุน · Budget = งบประมาณถึงเดือนที่เลือก · % Achieved เกิน 100% = ใช้เกินงบ",
  profit: "รายได้ − ค่าใช้จ่าย (สะสม) เทียบกำไรตามแผน · To Go = ส่วนที่ยังต้องทำเพิ่มให้ถึงแผน",
};

export function MetricPanel({
  title,
  data,
  kind = "revenue",
  focusId,
  onDrill,
}: {
  title: string;
  data: ProgressData;
  kind?: MetricKind;
  focusId?: string;
  /** Click "Actual" to see where the number comes from (MOM D7). */
  onDrill?: () => void;
}) {
  const L = LABELS[kind];
  const achieveBad = kind === "expense" ? data.achievePct > 100 : data.achievePct < 0;
  const balanceBad = data.balance < 0;
  return (
    <Panel title={title} subtitle="ล้านบาท (MB) · สะสมถึงเดือนที่เลือก (YTD)" info={METRIC_INFO[kind]} focusId={focusId}>
      <div className="relative flex flex-col items-center">
        <Gauge value={data.actual} max={data.plan} overIsBad={kind === "expense"} />
        {data.over > 0 && (
          <span
            className={cn(
              "absolute top-0 right-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
              kind === "expense" ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
            )}
          >
            {L.over} +{formatMB(data.over)}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Mini label={L.plan} value={formatMB(data.plan)} />
        {onDrill ? (
          <button
            type="button"
            onClick={onDrill}
            title="คลิกเพื่อดูรายละเอียดว่ามาจากหน่วยงาน / โครงการใด"
            className="group rounded-md ring-navy-300 hover:ring-2 cursor-pointer"
          >
            <Mini label={`${L.actual} ▸`} value={formatMB(data.actual)} tone="strong" />
          </button>
        ) : (
          <Mini label={L.actual} value={formatMB(data.actual)} tone="strong" />
        )}
        <Mini label={L.balance} value={formatMB(data.balance)} tone={balanceBad ? "bad" : undefined} />
        <Mini label="% Achieved" value={data.plan ? `${data.achievePct.toFixed(1)}%` : "-"} tone={achieveBad ? "bad" : "good"} />
        <Mini label={L.balancePct} value={data.plan ? `${data.balancePct.toFixed(1)}%` : "-"} tone={data.balancePct < 0 ? "bad" : "good"} />
        <Mini label="แผนทั้งปี" value={formatMB(data.planFull)} />
      </div>
    </Panel>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "strong" | "good" | "bad" }) {
  return (
    <div className={cn("rounded-lg px-1.5 py-2", tone === "strong" ? "bg-navy-50 ring-1 ring-navy-100" : tone === "good" ? "bg-success-soft/60" : tone === "bad" ? "bg-danger-soft/70" : "bg-muted/70")}>
      <div
        className={cn(
          "text-[15px] font-semibold tabular-nums text-navy-900",
          tone === "strong" && "text-lg font-bold",
          tone === "good" && "text-success",
          tone === "bad" && "text-danger",
        )}
      >
        {value}
      </div>
      <div className="text-xs leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

const STAT_ICONS: [RegExp, LucideIcon, IconTone][] = [
  [/ebitda/i, Activity, "blue"],
  [/course/i, BookOpen, "amber"],
  [/class/i, School, "amber"],
  [/seat/i, Armchair, "violet"],
  [/participant/i, Users, "teal"],
  [/event/i, CalendarDays, "amber"],
  [/member/i, UserCheck, "teal"],
  [/sponsor/i, Handshake, "pink"],
  [/completed/i, CheckCircle2, "green"],
  [/progress/i, Clock, "amber"],
  [/delay/i, AlertTriangle, "red"],
];

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  iconTone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
  icon?: LucideIcon;
  iconTone?: IconTone;
}) {
  const hit = STAT_ICONS.find(([re]) => re.test(label));
  const Icon = icon ?? hit?.[1] ?? BarChart3;
  const toneOf = iconTone ?? hit?.[2] ?? (tone === "good" ? "green" : tone === "bad" ? "red" : "navy");
  return (
    <Card className="flex items-start gap-3 px-4 py-3.5">
      <IconBadge icon={Icon} tone={toneOf} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        <div
          className={cn(
            "mt-0.5 text-2xl leading-tight font-bold tabular-nums",
            tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-navy-900",
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </Card>
  );
}

// ── Expandable pivot table ───────────────────────────────────

export interface TreeRow {
  label: string;
  sub?: string;
  children?: TreeRow[];
}

export interface Column<R> {
  key: string;
  label: string;
  render: (row: R) => React.ReactNode;
  /** Value used when the user sorts by this column (MOM D8). */
  sortValue?: (row: R) => number | string | null;
  className?: string;
}

type TreeSort = { key: string; dir: "asc" | "desc" } | null;

/** Sort each level of the tree by the chosen column; children stay under their parent. */
function sortTree<R extends TreeRow>(rows: R[], columns: Column<R>[], sort: TreeSort): R[] {
  if (!sort) return rows;
  const get = sort.key === "__label" ? (r: R) => r.label : columns.find((c) => c.key === sort.key)?.sortValue;
  if (!get) return rows;
  const f = sort.dir === "asc" ? 1 : -1;
  return [...rows]
    .sort((a, b) => f * compareValues(get(a), get(b)))
    .map((r) => (r.children?.length ? { ...r, children: sortTree(r.children as R[], columns, sort) } : r));
}

export function TreeTable<R extends TreeRow>({
  rows,
  columns,
  firstLabel,
  defaultOpen = false,
  maxHeight = 420,
  rowClassName,
}: {
  rows: R[];
  columns: Column<R>[];
  firstLabel: string;
  defaultOpen?: boolean;
  maxHeight?: number;
  rowClassName?: (row: R, depth: number) => string | undefined;
}) {
  const [sort, setSort] = useState<TreeSort>(null);
  const toggle = (key: string, numeric: boolean) =>
    setSort((s) => (s?.key !== key ? { key, dir: numeric ? "desc" : "asc" } : s.dir === (numeric ? "desc" : "asc") ? { key, dir: numeric ? "asc" : "desc" } : null));
  const sorted = sortTree(rows, columns, sort);
  const icon = (key: string) => {
    const Icon = sort?.key !== key ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return <Icon className={cn("size-3 shrink-0", sort?.key === key ? "opacity-100" : "opacity-50")} />;
  };
  return (
    <div className="table-box overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="border-b border-border bg-navy-900 px-2 py-2 text-left font-semibold text-white">
              <button type="button" onClick={() => toggle("__label", false)} className="inline-flex items-center gap-1 cursor-pointer">
                {firstLabel} {icon("__label")}
              </button>
            </th>
            {columns.map((c) => (
              <th key={c.key} className="border-b border-border bg-navy-900 px-2 py-2 text-right font-semibold whitespace-nowrap text-white">
                {c.sortValue ? (
                  <button type="button" onClick={() => toggle(c.key, true)} className="inline-flex items-center gap-1 cursor-pointer">
                    {icon(c.key)} {c.label}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <TreeNode key={`${r.label}-${i}`} row={r} depth={0} columns={columns} defaultOpen={defaultOpen} rowClassName={rowClassName} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TreeNode<R extends TreeRow>({
  row,
  depth,
  columns,
  defaultOpen,
  rowClassName,
}: {
  row: R;
  depth: number;
  columns: Column<R>[];
  defaultOpen: boolean;
  rowClassName?: (row: R, depth: number) => string | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const kids = (row.children ?? []) as R[];
  return (
    <>
      <tr className={cn("hover:bg-navy-50/70", depth === 0 && "bg-navy-50/40 font-medium", rowClassName?.(row, depth))}>
        <td className="border-b border-border px-2 py-1.5" style={{ paddingLeft: 8 + depth * 16 }}>
          {kids.length ? (
            <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-left text-navy-900 cursor-pointer">
              <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
              {row.label}
            </button>
          ) : (
            <span className="pl-4.5 text-navy-900">{row.label}</span>
          )}
          {row.sub && <div className="pl-4.5 text-[11px] text-muted-foreground">{row.sub}</div>}
        </td>
        {columns.map((c) => (
          <td key={c.key} className={cn("border-b border-border px-2 py-1.5 text-right tabular-nums whitespace-nowrap", c.className)}>
            {c.render(row)}
          </td>
        ))}
      </tr>
      {open &&
        kids.map((k, i) => (
          <TreeNode key={`${k.label}-${i}`} row={k} depth={depth + 1} columns={columns} defaultOpen={false} rowClassName={rowClassName} />
        ))}
    </>
  );
}

/** Coloured value: negative red, positive green (for variances). */
export function Signed({ value, format = formatMB, invert = false }: { value: number; format?: (n: number) => string; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return <span className={cn(value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-danger")}>{format(value)}</span>;
}
