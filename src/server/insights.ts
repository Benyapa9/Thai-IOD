import "server-only";
import { ratingWeight } from "@/lib/rating-reasons";
import { type AlertResult } from "@/server/dashboard/alerts";
import { type DashboardContext, type Filters, groupSum, inMonth, is, pct, scoped, sum, ytd } from "@/server/dashboard/context";
import { capitalPage, membershipPage, trainingPage } from "@/server/dashboard/pages";
import { formatPercent, formatTHB } from "@/lib/utils";
import type { IssueCategory, IssueLog, Severity } from "@/types/domain";

/** critical = significantly off plan · warning = drifting · positive = better than plan · info = context */
export type InsightLevel = "critical" | "warning" | "positive" | "info";

/**
 * Classification rules (MOM I3). The reviewer's example was "revenue more than
 * 15% below target"; the exact thresholds still need business confirmation.
 */
export const INSIGHT_RULES = {
  revenueCritical: 15, // % below revenue plan (YTD)
  revenueWarning: 5,
  revenueAhead: 5, // % above revenue plan
  expenseCritical: 10, // % over budget (YTD)
  expenseWarning: 3,
  expenseUnder: 10, // % under budget
  momDrop: 20, // % month-over-month revenue drop
};

export interface Insight {
  id: string;
  /** Group used to learn preferences from ratings (MOM H3). */
  kind: string;
  level: InsightLevel;
  title: string;
  detail: string;
  metric: { value: string; label: string; tone: "bad" | "good" | "neutral"; raw: number };
  impact?: { text: string; tone: "bad" | "good"; amount: number };
  action: string;
  href?: string;
  hrefLabel?: string;
  issue?: { title: string; description: string; severity: Severity; category: IssueCategory };
  trackedIssueId?: string;
}

const LEVEL_ORDER: Record<InsightLevel, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
const gap = (a: number, p: number) => (p ? pct(a - p, p) : 0);
const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : "";
};

export function buildInsights(
  ctx: DashboardContext,
  flt: Filters,
  alerts: AlertResult[],
  issues: IssueLog[],
  periodLabel: string,
): Insight[] {
  const out: Insight[] = [];
  const period = `${flt.year}-${String(flt.month).padStart(2, "0")}`;
  const dept = flt.departments.length ? flt.departments.join(",") : undefined;
  const facts = scoped(ctx, flt);
  const y = ytd(flt);
  const R = INSIGHT_RULES;

  // 1) KPI thresholds breached (per dashboard, MOM D10)
  for (const a of alerts.filter((x) => x.breached)) {
    out.push({
      id: `alert-${a.dashboard}-${a.metric}`,
      kind: "alert",
      level: "critical",
      title: `${a.label} เกินเกณฑ์ที่ตั้งไว้`,
      detail: `${a.dashboardLabel} · ${a.hint} · เกณฑ์ ${a.operator === "gt" ? "มากกว่า" : "น้อยกว่า"} ${a.threshold}%`,
      metric: { value: formatPercent(a.value), label: a.label, tone: "bad", raw: a.value },
      action: "เปิด Dashboard เพื่อดูว่าตัวเลขมาจากส่วนไหน แล้วสร้าง Follow-up Action",
      href: `${a.href}&period=${period}${dept ? `&dept=${encodeURIComponent(dept)}` : ""}`,
      hrefLabel: "ดูที่ Dashboard",
      issue: {
        title: `[Alert] ${a.label} — ${a.dashboardLabel} (${periodLabel})`,
        description: `ค่าปัจจุบัน ${formatPercent(a.value)} เทียบเกณฑ์ ${a.operator} ${a.threshold}%`,
        severity: "high",
        category: /expense|capex/.test(a.metric) ? "budget" : "revenue",
      },
    });
  }

  // 2) Revenue by profit center vs plan (YTD)
  const revA = groupSum(facts, (f) => f.profitCenter, (f) => is.actual(f) && is.revenue(f) && y(f));
  const revP = groupSum(facts, (f) => f.profitCenter, (f) => is.budget(f) && is.revenue(f) && y(f));
  for (const [pc, plan] of revP) {
    if (plan < 100_000) continue;
    const actual = revA.get(pc) ?? 0;
    const g = gap(actual, plan);
    const level: InsightLevel | null = g <= -R.revenueCritical ? "critical" : g <= -R.revenueWarning ? "warning" : g >= R.revenueAhead ? "positive" : null;
    if (!level) continue;
    const below = g < 0;
    out.push({
      id: `revpc-${pc}`,
      kind: "revenue-pc",
      level,
      title: `${pc}: รายได้${below ? "ต่ำกว่า" : "สูงกว่า"}แผน`,
      detail: `รายได้สะสม ${formatTHB(actual)} เทียบแผน ${formatTHB(plan)} (${periodLabel})`,
      metric: { value: formatPercent(g), label: "รายได้เทียบแผน YTD", tone: below ? "bad" : "good", raw: g },
      impact: { text: `${below ? "ขาดอีก" : "เกินแผน"} ${formatTHB(Math.abs(actual - plan))}`, tone: below ? "bad" : "good", amount: Math.abs(actual - plan) },
      action: below
        ? `ทบทวนกิจกรรมที่ยังไม่เกิดรายได้ของ ${pc} และเร่งยอดในเดือนที่เหลือ`
        : `ถอดบทเรียนปัจจัยที่ทำให้ ${pc} เกินแผน เพื่อขยายผล`,
      href: `/dashboard/main/kpi${q({ focus: "revenue-by-pc", pc, period, dept })}`,
      hrefLabel: "ดูกราฟรายได้ตาม Profit Center",
      issue: below
        ? {
            title: `${pc}: รายได้ต่ำกว่าแผน ${formatPercent(g)}`,
            description: `รายได้สะสม ${formatTHB(actual)} เทียบแผน ${formatTHB(plan)} (${periodLabel})`,
            severity: level === "critical" ? "high" : "medium",
            category: "revenue",
          }
        : undefined,
    });
  }

  // 3) Expense by department vs budget (YTD)
  const expA = groupSum(facts, (f) => f.department, (f) => is.actual(f) && is.expense(f) && y(f));
  const expB = groupSum(facts, (f) => f.department, (f) => is.budget(f) && is.expense(f) && y(f));
  for (const [department, budget] of expB) {
    if (budget < 100_000) continue;
    const actual = expA.get(department) ?? 0;
    const g = gap(actual, budget);
    const level: InsightLevel | null = g >= R.expenseCritical ? "critical" : g >= R.expenseWarning ? "warning" : g <= -R.expenseUnder ? "positive" : null;
    if (!level) continue;
    const over = g > 0;
    out.push({
      id: `expdept-${department}`,
      kind: "expense-dept",
      level,
      title: `${department}: ${over ? "ใช้งบเกินแผน" : "ใช้งบต่ำกว่าแผน"}`,
      detail: `ค่าใช้จ่ายสะสม ${formatTHB(actual)} เทียบงบ ${formatTHB(budget)} (${periodLabel})`,
      metric: { value: formatPercent(g), label: "ค่าใช้จ่ายเทียบงบ YTD", tone: over ? "bad" : "good", raw: g },
      impact: { text: `${over ? "เกินงบ" : "ประหยัด"} ${formatTHB(Math.abs(actual - budget))}`, tone: over ? "bad" : "good", amount: Math.abs(actual - budget) },
      action: over
        ? `ตรวจรายการค่าใช้จ่ายหลักของ ${department} และกำหนดเพดานค่าใช้จ่ายเดือนถัดไป`
        : `พิจารณาโยกงบที่เหลือของ ${department} ไปยังหน่วยงานที่จำเป็น`,
      href: `/dashboard/main/expenditure${q({ focus: "overview", dept: department, period })}`,
      hrefLabel: "ดูตาราง Overview",
      issue: over
        ? {
            title: `${department}: ใช้งบเกินแผน ${formatPercent(g)}`,
            description: `ค่าใช้จ่ายสะสม ${formatTHB(actual)} เทียบงบ ${formatTHB(budget)} (${periodLabel})`,
            severity: level === "critical" ? "high" : "medium",
            category: "budget",
          }
        : undefined,
    });
  }

  // 4) Membership / sponsorship / seminar revenue
  const m = membershipPage(ctx, flt);
  for (const [key, label, block] of [
    ["membership", "รายได้สมาชิก", m.membership],
    ["sponsorship", "รายได้สปอนเซอร์", m.sponsorship],
    ["seminar", "รายได้สัมมนา", m.seminar],
  ] as const) {
    if (block.plan < 100_000) continue;
    const g = gap(block.actual, block.plan);
    const level: InsightLevel | null = g <= -R.revenueCritical ? "critical" : g <= -R.revenueWarning ? "warning" : g >= R.revenueAhead ? "positive" : null;
    if (!level) continue;
    const below = g < 0;
    out.push({
      id: `segment-${key}`,
      kind: "segment",
      level,
      title: `${label}${below ? "ต่ำกว่า" : "สูงกว่า"}แผน`,
      detail: `สะสม ${formatTHB(block.actual)} เทียบแผน ${formatTHB(block.plan)}`,
      metric: { value: formatPercent(g), label: `${label}เทียบแผน`, tone: below ? "bad" : "good", raw: g },
      impact: { text: `${below ? "ขาดอีก" : "เกินแผน"} ${formatTHB(Math.abs(block.actual - block.plan))}`, tone: below ? "bad" : "good", amount: Math.abs(block.actual - block.plan) },
      action: below ? `ติดตามแผนการขายและการต่ออายุของ${label.replace("รายได้", "")}` : "รักษาแนวทางปัจจุบันและวางเป้าที่ท้าทายขึ้น",
      href: `/dashboard/main/membership${q({ focus: key, period, dept })}`,
      hrefLabel: "ดู Membership & Sponsorship",
      issue: below
        ? { title: `${label}ต่ำกว่าแผน ${formatPercent(g)}`, description: `สะสม ${formatTHB(block.actual)} เทียบแผน ${formatTHB(block.plan)}`, severity: "medium", category: "revenue" }
        : undefined,
    });
  }

  // 5) Training groups losing money
  const t = trainingPage(ctx, flt);
  for (const g of t.table.filter((x) => x.revenueActual > 0 && x.earning < 0)) {
    out.push({
      id: `training-${g.label}`,
      kind: "training",
      level: "warning",
      title: `หลักสูตรกลุ่ม ${g.label}: ค่าใช้จ่ายสูงกว่ารายได้`,
      detail: `รายได้ ${formatTHB(g.revenueActual)} ค่าใช้จ่าย ${formatTHB(g.expenseActual)}`,
      metric: { value: `${g.marginPct.toFixed(1)}%`, label: "Margin", tone: "bad", raw: g.marginPct },
      impact: { text: `ขาดทุน ${formatTHB(Math.abs(g.earning))}`, tone: "bad", amount: Math.abs(g.earning) },
      action: "ทบทวนต้นทุนต่อรุ่นและจำนวนที่นั่งขั้นต่ำของหลักสูตรในกลุ่มนี้",
      href: `/dashboard/main/training${q({ focus: "courses", period, dept })}`,
      hrefLabel: "ดู Performance by Courses",
    });
  }

  // 6) Month-over-month revenue drop by profit center
  const prev = flt.month - 1;
  if (prev >= 1 && ctx.actualMonths.get(flt.year)?.includes(prev)) {
    const now = groupSum(facts, (f) => f.profitCenter, (f) => is.actual(f) && is.revenue(f) && inMonth(flt.month)(f));
    const before = groupSum(facts, (f) => f.profitCenter, (f) => is.actual(f) && is.revenue(f) && inMonth(prev)(f));
    for (const [pc, b] of before) {
      if (b < 500_000) continue;
      const n = now.get(pc) ?? 0;
      const g = gap(n, b);
      if (g > -R.momDrop) continue;
      out.push({
        id: `mom-${pc}`,
        kind: "revenue-mom",
        level: "warning",
        title: `${pc}: รายได้เดือนล่าสุดลดลงจากเดือนก่อน`,
        detail: `${formatTHB(b)} → ${formatTHB(n)}`,
        metric: { value: formatPercent(g), label: "รายได้ MoM", tone: "bad", raw: g },
        impact: { text: `ลดลง ${formatTHB(b - n)}`, tone: "bad", amount: b - n },
        action: `ตรวจสอบว่าเป็นผลจากรอบกิจกรรม (ฤดูกาล) หรือยอดขายลดลงจริงของ ${pc}`,
        href: `/dashboard/main/kpi${q({ focus: "monthly", pc, period, dept })}`,
        hrefLabel: "ดูแนวโน้มรายเดือน",
      });
    }
  }

  // 7) CAPEX projects flagged Delay
  const c = capitalPage(ctx, flt);
  const delayed = c.projects.filter((p) => p.status === "Delay");
  if (delayed.length) {
    const amount = delayed.reduce((s, p) => s + p.monthly.reduce((a, b) => a + b, 0), 0);
    out.push({
      id: "capex-delay",
      kind: "capex",
      level: "warning",
      title: `งบลงทุน ${delayed.length} โครงการมีงบเกินวันสิ้นสุดโครงการ`,
      detail: delayed.map((p) => p.name).slice(0, 3).join(" · "),
      metric: { value: String(delayed.length), label: "โครงการ Delay", tone: "bad", raw: delayed.length },
      impact: { text: `งบที่เกี่ยวข้อง ${formatTHB(amount)}`, tone: "bad", amount },
      action: "ยืนยันวันสิ้นสุดใหม่หรือปรับแผนการเบิกจ่ายของโครงการ",
      href: `/dashboard/capital${q({ focus: "timeline", period, dept })}`,
      hrefLabel: "ดู Project Timeline",
    });
  }

  // 8) Overdue follow-up actions
  const today = new Date();
  const overdue = issues.filter((i) => i.dueDate && new Date(i.dueDate) < today && (i.status === "open" || i.status === "in_progress"));
  if (overdue.length) {
    out.push({
      id: "followup-overdue",
      kind: "followup",
      level: overdue.some((i) => i.severity === "critical") ? "critical" : "warning",
      title: "Follow-up Actions เลยกำหนด",
      detail: overdue.map((i) => i.title).slice(0, 3).join(" · "),
      metric: { value: String(overdue.length), label: "รายการเลยกำหนด", tone: "bad", raw: overdue.length },
      action: "ติดตามผู้รับผิดชอบ อัปเดตแผน หรือปรับกำหนดเสร็จ",
      href: "/follow-up",
      hrefLabel: "เปิด Follow-up Actions",
    });
  }

  // 9) Context
  const revenue = sum(facts, is.actual, is.revenue, y);
  const expense = sum(facts, is.actual, is.expense, y);
  if (revenue) {
    const margin = pct(revenue - expense, revenue);
    out.push({
      id: "summary-margin",
      kind: "summary",
      level: "info",
      title: "รายได้สูงกว่าค่าใช้จ่ายสะสม (Margin)",
      detail: `รายได้ ${formatTHB(revenue)} · ค่าใช้จ่าย ${formatTHB(expense)}`,
      metric: { value: `${margin.toFixed(1)}%`, label: "Margin YTD", tone: margin >= 0 ? "good" : "bad", raw: margin },
      impact: { text: `ส่วนต่าง ${formatTHB(revenue - expense)}`, tone: margin >= 0 ? "good" : "bad", amount: Math.abs(revenue - expense) },
      action: "ใช้เป็นเกณฑ์เทียบเมื่อวางงบประมาณปีถัดไป",
      href: `/dashboard/main/kpi${q({ focus: "net", period, dept })}`,
      hrefLabel: "ดู Revenue Over Expense",
    });
  }

  const open = new Map(issues.filter((i) => i.status === "open" || i.status === "in_progress").map((i) => [i.sourceInsightId ?? i.title, i.id]));
  for (const i of out) i.trackedIssueId = open.get(i.id) ?? (i.issue ? open.get(i.issue.title) : undefined);

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (b.impact?.amount ?? 0) - (a.impact?.amount ?? 0));
}

/** Count and money value per group (MOM I4). */
export function summarizeGroups(insights: Insight[]) {
  const groups = { critical: { count: 0, amount: 0 }, warning: { count: 0, amount: 0 }, positive: { count: 0, amount: 0 }, info: { count: 0, amount: 0 } };
  for (const i of insights) {
    groups[i.level].count++;
    groups[i.level].amount += i.impact?.amount ?? 0;
  }
  return groups;
}

const LEVEL_WEIGHT: Record<InsightLevel, number> = { critical: 3, warning: 2, positive: 1.5, info: 0.5 };

/**
 * Insight of the Day (MOM H2/H3): urgency + learned preference for the insight
 * kind, excluding ones the user disliked; rotates daily among close candidates.
 */
export function pickInsightOfDay(
  insights: Insight[],
  ratings: { insightKey: string; kind: string; rating: number; reason?: string | null }[],
  day: string,
) {
  const disliked = new Set(ratings.filter((r) => r.rating < 0).map((r) => r.insightKey));
  const pref = new Map<string, { sum: number; n: number }>();
  for (const r of ratings) {
    const p = pref.get(r.kind) ?? { sum: 0, n: 0 };
    p.sum += ratingWeight(r);
    p.n++;
    pref.set(r.kind, p);
  }
  const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 1000;
  const scored = insights
    .filter((i) => !disliked.has(i.id))
    .map((i) => {
      const p = pref.get(i.kind);
      const score = LEVEL_WEIGHT[i.level] + (p ? (p.sum / p.n) * 1.5 : 0) + hash(`${day}|${i.id}`) / 2000;
      return { i, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.i ?? insights[0] ?? null;
}
