import "server-only";
import {
  type DashboardContext,
  type Fact,
  type Filters,
  UNASSIGNED,
  groupSum,
  inDepartments,
  inMonth,
  is,
  isTrainingActivity,
  norm,
  pct,
  progress,
  scoped,
  sum,
  ytd,
} from "./context";

/**
 * Page calculations follow the signed Business Blueprints:
 *  - "Business Blueprint IOD Project Financial Analytic – Main" (5.1–5.4)
 *  - "… – P&L" (5.1) and "… – Capital Expenditure" (5.1)
 * Actual = GL (Cr − Dr for 4xxxx, Dr − Cr for 5/6xxxx) joined to BG_YEAR by budget code.
 * Plan / Budget = BG_YEAR monthly columns up to the selected month (YTD).
 */

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const acct = (...prefixes: string[]) => (f: Fact) =>
  f.scenario === "budget" || prefixes.some((p) => f.accountCode?.startsWith(p));

function hasActual(ctx: DashboardContext, year: number, month: number) {
  return ctx.actualMonths.get(year)?.includes(month) ?? false;
}

/** Revenue / expense / profit blocks (Main L001–L003). */
function pnlBlock(facts: Fact[], flt: Filters) {
  const y = ytd(flt);
  const rev = progress(sum(facts, is.actual, is.revenue, y), sum(facts, is.budget, is.revenue, y), sum(facts, is.budget, is.revenue));
  const exp = progress(sum(facts, is.actual, is.expense, y), sum(facts, is.budget, is.expense, y), sum(facts, is.budget, is.expense));
  // Profit: To Go = Actual Profit − Profit Plan (shown as 0 when ahead of plan).
  const profitActual = rev.actual - exp.actual;
  const profitPlan = rev.plan - exp.plan;
  const profit = {
    actual: profitActual,
    plan: profitPlan,
    planFull: rev.planFull - exp.planFull,
    balance: Math.min(profitActual - profitPlan, 0),
    achievePct: pct(profitActual, profitPlan),
    balancePct: pct(Math.min(profitActual - profitPlan, 0), profitPlan),
    over: Math.max(profitActual - profitPlan, 0),
  };
  return { revenue: rev, expense: exp, net: profit };
}

function monthlySeries(ctx: DashboardContext, facts: Fact[], flt: Filters) {
  return MONTH_LABELS.map((label, i) => {
    const m = i + 1;
    const actual = hasActual(ctx, flt.year, m) && m <= flt.month;
    const rA = sum(facts, is.actual, is.revenue, inMonth(m));
    const eA = sum(facts, is.actual, is.expense, inMonth(m));
    const rB = sum(facts, is.budget, is.revenue, inMonth(m));
    const eB = sum(facts, is.budget, is.expense, inMonth(m));
    return {
      month: m,
      label,
      revenueActual: actual ? rA : null,
      revenuePlan: rB,
      expenseActual: actual ? eA : null,
      expenseBudget: eB,
      netActual: actual ? rA - eA : null,
      netPlan: rB - eB,
    };
  });
}

const DIRECT_TYPES = new Set(["directexpenses", "passthroughcost", "salariesandbenefitsdl"]);
const ADMIN_TYPES = new Set(["administrativeexpenses", "salariesandbenefitsidl", "bonus"]);
const NOI_REVENUE = new Set(["publictrainning", "inhousetraining", "cactraining", "seminars", "membershipfees", "revenuefromboardroomassessment"]);

/** EBITDA (Main L005): revenue − direct − administrative; excludes Special Project and งบลงทุน budgets. */
function ebitdaOf(facts: Fact[], pred: (f: Fact) => boolean) {
  const f = facts.filter((x) => !x.isSpecial && pred(x));
  const revenue = sum(f, is.revenue);
  const direct = sum(f, is.expense, (x) => DIRECT_TYPES.has(x.pnlKey));
  const admin = sum(f, is.expense, (x) => ADMIN_TYPES.has(x.pnlKey));
  const noi = sum(f, is.revenue, (x) => NOI_REVENUE.has(x.pnlKey));
  const ebitda = revenue - direct - admin;
  return { value: ebitda, pct: pct(ebitda, noi) };
}

// ── 1. Key Financial Indicators ──────────────────────────────

export function kpiPage(ctx: DashboardContext, flt: Filters) {
  const facts = scoped(ctx, flt).filter(acct("4", "5", "6"));
  const block = pnlBlock(facts, flt);
  const y = ytd(flt);

  const actualE = ebitdaOf(facts, (f) => is.actual(f) && y(f));
  const budgetE = ebitdaOf(facts, (f) => is.budget(f) && y(f));

  // P&L At A Glance (L008): YTD plan, To Go against the full-year plan.
  const byDepartment = ctx.departments
    .map((department) => {
      const b = pnlBlock(facts.filter((x) => x.department === department), flt);
      return {
        department,
        revenuePlan: b.revenue.plan,
        revenueToGo: b.revenue.planFull - b.revenue.actual,
        expenseBudget: b.expense.plan,
        expenseBalance: b.expense.planFull - b.expense.actual,
        profitPlan: b.net.plan,
        profitToGo: b.net.planFull - b.net.actual,
      };
    })
    .filter((r) => r.revenuePlan || r.expenseBudget || r.revenueToGo || r.expenseBalance);

  const pcActual = groupSum(facts, (f) => f.profitCenter, (f) => is.actual(f) && is.revenue(f) && y(f));
  const pcPlan = groupSum(facts, (f) => f.profitCenter, (f) => is.budget(f) && is.revenue(f) && y(f));
  const byProfitCenter = [...new Set([...pcActual.keys(), ...pcPlan.keys()])]
    .map((profitCenter) => ({ profitCenter, actual: pcActual.get(profitCenter) ?? 0, plan: pcPlan.get(profitCenter) ?? 0 }))
    .filter((r) => r.actual || r.plan)
    .sort((a, b) => b.plan + b.actual - (a.plan + a.actual));

  return {
    ...block,
    ebitda: { actual: actualE.value, actualPct: actualE.pct, budget: budgetE.value, budgetPct: budgetE.pct },
    monthly: monthlySeries(ctx, facts, flt),
    byDepartment,
    byProfitCenter,
  };
}

// ── 2. Training courses ──────────────────────────────────────

const MARGIN_GROUPS = ["DCP", "DCP Residential(E)", "DCP Residential(T)", "In-House"];
function marginGroup(course: string | null) {
  const c = norm(course);
  return MARGIN_GROUPS.find((g) => norm(g) === c) ?? "Non-DCP";
}

export function trainingPage(ctx: DashboardContext, flt: Filters) {
  // Revenue: accounts 41/44; expense: accounts 5 (Blueprint 5.2 L001/L002).
  const facts = scoped(ctx, flt).filter(
    (f) =>
      isTrainingActivity(f.activity) &&
      (f.scenario === "budget" ||
        (f.kind === "revenue" ? /^4[14]/.test(f.accountCode ?? "") : f.accountCode?.startsWith("5"))),
  );
  const y = ytd(flt);
  const block = pnlBlock(facts, flt);

  const seatOf = new Map(ctx.snapshot.budgetProgress.map((p) => [p.budgetCode, p.seat ?? 0]));
  const withRevenue = new Set(
    facts.filter((f) => is.actual(f) && is.revenue(f) && y(f) && f.budgetCode).map((f) => f.budgetCode!),
  );
  const lineOf = (code: string) => ctx.lines.get(code);

  // Number of courses / classes: only budget codes with actual revenue (Makeup excluded from classes).
  const revenueLines = [...withRevenue].map(lineOf).filter((l): l is NonNullable<typeof l> => !!l);
  const courses = new Set(revenueLines.map((l) => norm(l.courseCode)).filter((c) => c && c !== "none"));
  const classes = revenueLines.filter((l) => !/make ?up/i.test(`${l.name} ${l.className ?? ""}`));
  const seatPlan = ctx.snapshot.budgetLines
    .filter(
      (l) =>
        l.year === flt.year &&
        isTrainingActivity(l.activity) &&
        l.status !== "ยกเลิก" &&
        inDepartments(flt, ctx.canonicalDepartment(l.department)) &&
        (!l.startDate || l.startDate.getUTCMonth() + 1 <= flt.month),
    )
    .reduce((s, l) => s + (l.seat ?? 0), 0);
  const actualSeats = [...withRevenue].reduce((s, code) => s + (seatOf.get(code) ?? 0), 0);

  // Performance by courses (L006): Grouping → Course → Class, YTD.
  type Row = { revenuePlan: number; revenueActual: number; budget: number; expenseActual: number; seatPlan: number; seatActual: number };
  const blank = (): Row => ({ revenuePlan: 0, revenueActual: 0, budget: 0, expenseActual: 0, seatPlan: 0, seatActual: 0 });
  const byClass = new Map<string, Row & { group: string; course: string; className: string; name: string }>();
  for (const f of facts) {
    if (!y(f) || !f.budgetCode) continue;
    let r = byClass.get(f.budgetCode);
    if (!r) {
      r = {
        ...blank(),
        group: f.grouping,
        course: f.courseCode ?? UNASSIGNED,
        className: f.className ?? "-",
        name: f.budgetName,
        seatPlan: lineOf(f.budgetCode)?.seat ?? 0,
        seatActual: withRevenue.has(f.budgetCode) ? (seatOf.get(f.budgetCode) ?? 0) : 0,
      };
      byClass.set(f.budgetCode, r);
    }
    if (f.scenario === "budget" && f.kind === "revenue") r.revenuePlan += f.amount;
    if (f.scenario === "actual" && f.kind === "revenue") r.revenueActual += f.amount;
    if (f.scenario === "budget" && f.kind === "expense") r.budget += f.amount;
    if (f.scenario === "actual" && f.kind === "expense") r.expenseActual += f.amount;
  }
  const metrics = (r: Row) => ({
    ...r,
    variance: r.revenueActual - r.revenuePlan,
    costToRevenuePct: pct(r.expenseActual, r.revenueActual),
    expenseVariance: r.expenseActual - r.budget,
    earning: r.revenueActual - r.expenseActual,
    marginPct: pct(r.revenueActual - r.expenseActual, r.revenueActual),
    seatVariance: r.seatPlan - r.seatActual,
  });
  const add = (a: Row, b: Row): Row => ({
    revenuePlan: a.revenuePlan + b.revenuePlan,
    revenueActual: a.revenueActual + b.revenueActual,
    budget: a.budget + b.budget,
    expenseActual: a.expenseActual + b.expenseActual,
    seatPlan: a.seatPlan + b.seatPlan,
    seatActual: a.seatActual + b.seatActual,
  });
  const groups = new Map<string, Map<string, (Row & { className: string; name: string })[]>>();
  for (const r of byClass.values()) {
    if (!groups.has(r.group)) groups.set(r.group, new Map());
    const courses = groups.get(r.group)!;
    if (!courses.has(r.course)) courses.set(r.course, []);
    courses.get(r.course)!.push(r);
  }
  const table = [...groups.entries()]
    .map(([group, courseMap]) => {
      const courseRows = [...courseMap.entries()].map(([course, cls]) => ({
        label: course,
        ...metrics(cls.reduce(add, blank())),
        children: cls
          .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }))
          .map((c) => ({ label: c.className, sub: c.name, ...metrics(c) })),
      }));
      return {
        label: group,
        ...metrics(courseRows.reduce(add, blank())),
        children: courseRows.sort((a, b) => b.revenueActual - a.revenueActual || b.revenuePlan - a.revenuePlan),
      };
    })
    .sort((a, b) => b.revenueActual - a.revenueActual || b.revenuePlan - a.revenuePlan);

  // Donuts: revenue by skill grouping; margin % by DCP / DCP Residential / In-House / Non-DCP.
  const revByGroup = groupSum(facts, (f) => f.grouping, (f) => is.actual(f) && is.revenue(f) && y(f));
  const marginAgg = new Map<string, { revenue: number; expense: number }>();
  for (const f of facts) {
    if (!is.actual(f) || !y(f)) continue;
    const g = marginGroup(f.courseCode);
    const a = marginAgg.get(g) ?? { revenue: 0, expense: 0 };
    a[f.kind] += f.amount;
    marginAgg.set(g, a);
  }

  return {
    ...block,
    counts: { courses: courses.size, classes: classes.length, seatPlan, actualSeats },
    revenueByGroup: [...revByGroup.entries()].map(([name, value]) => ({ name, value })).filter((x) => x.value > 0),
    marginByGroup: [...marginAgg.entries()]
      .map(([name, a]) => ({ name, revenue: a.revenue, earning: a.revenue - a.expense, marginPct: pct(a.revenue - a.expense, a.revenue) }))
      .filter((x) => x.revenue > 0),
    table,
  };
}

// ── 3. Expenditure by department ─────────────────────────────

export function expenditurePage(ctx: DashboardContext, flt: Filters) {
  const facts = scoped(ctx, flt).filter((f) => is.expense(f) && acct("5", "6")(f));
  const y = ytd(flt);
  const block = pnlBlock(facts, flt);

  const actualByDept = groupSum(facts, (f) => f.department, (f) => is.actual(f) && y(f));
  const budgetByDept = groupSum(facts, (f) => f.department, (f) => is.budget(f) && y(f));
  const overview = ctx.departments
    .map((department) => {
      const actual = actualByDept.get(department) ?? 0;
      const budget = budgetByDept.get(department) ?? 0;
      return { department, budget, actual, variance: budget - actual, usedPct: pct(actual, budget) };
    })
    .filter((r) => r.budget || r.actual);

  // Expenditure by Type (L001-C6): expense type → department → project, Actual and % of total.
  const totalActual = block.expense.actual;
  const typeLabel = (f: Fact) => ctx.pnlByKey.get(f.pnlKey)?.key ?? "ยังไม่จับคู่ประเภท";
  const tree = new Map<string, Map<string, Map<string, number>>>();
  for (const f of facts) {
    if (!is.actual(f) || !y(f)) continue;
    const t = typeLabel(f);
    if (!tree.has(t)) tree.set(t, new Map());
    const d = tree.get(t)!;
    if (!d.has(f.department)) d.set(f.department, new Map());
    const p = d.get(f.department)!;
    p.set(f.budgetName, (p.get(f.budgetName) ?? 0) + f.amount);
  }
  const node = (label: string, actual: number) => ({ label, actual, sharePct: pct(actual, totalActual) });
  const byType = [...tree.entries()]
    .map(([type, depts]) => {
      const children = [...depts.entries()]
        .map(([dept, projects]) => {
          const kids = [...projects.entries()].map(([n, v]) => node(n, v)).sort((a, b) => b.actual - a.actual);
          return { ...node(dept, kids.reduce((s, k) => s + k.actual, 0)), children: kids };
        })
        .sort((a, b) => b.actual - a.actual);
      return { ...node(type, children.reduce((s, c) => s + c.actual, 0)), children };
    })
    .sort((a, b) => b.actual - a.actual);

  return {
    expense: block.expense,
    byDepartment: overview.filter((r) => r.actual > 0).map((r) => ({ name: r.department, value: r.actual })),
    monthly: monthlySeries(ctx, facts, flt).map((m) => ({ month: m.month, label: m.label, actual: m.expenseActual, budget: m.expenseBudget })),
    byType,
    overview,
  };
}

// ── 4. Membership, sponsorship and seminar ───────────────────

const SPONSOR_KEYS = new Set(["revenuefromdonationsandsponsorshipsmme", "revenuefromdonationsandsponsorshipscac"]);

export function membershipPage(ctx: DashboardContext, flt: Filters) {
  const facts = scoped(ctx, flt).filter(acct("4", "5", "6"));
  const y = ytd(flt);
  const segment = (keys: (k: string) => boolean) =>
    pnlBlock(facts.filter((f) => is.revenue(f) && keys(f.pnlKey)), flt).revenue;

  const inYtd = (p: string) => {
    const [yy, mm] = p.split("-").map(Number);
    return yy === flt.year && mm <= flt.month;
  };
  const acts = ctx.snapshot.activities.filter((a) => inYtd(a.period));
  const of = (s: string) => acts.filter((a) => a.source === s);

  const stat = (type: string, m: number) =>
    ctx.snapshot.memberStats.find((s) => s.memberType === type && s.year === flt.year && s.month === m)?.value ?? null;

  // Member retention / acquisition (L008–L011): counts by member type, plan line from Template Member.
  const memberActs = ctx.snapshot.activities.filter((a) => a.source === "member" && a.period.startsWith(`${flt.year}-`));
  const memberTypes = [...new Set(memberActs.map((a) => a.memberType ?? "ไม่ระบุ"))].sort();
  const series = (field: "renewMembers" | "newMembers", planType: string) => {
    const running: Record<string, number> = {};
    let planCum = 0;
    return MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const period = `${flt.year}-${String(m).padStart(2, "0")}`;
      const plan = stat(planType, m) ?? 0;
      planCum += plan;
      const show = m <= flt.month && memberActs.some((a) => a.period === period);
      const mtd: Record<string, number | null> = {};
      const ytdV: Record<string, number | null> = {};
      for (const t of memberTypes) {
        const v = memberActs.filter((a) => a.period === period && (a.memberType ?? "ไม่ระบุ") === t).reduce((s, a) => s + a[field], 0);
        running[t] = (running[t] ?? 0) + (m <= flt.month ? v : 0);
        mtd[t] = show ? v : null;
        ytdV[t] = show ? running[t] : null;
      }
      return { label, plan, planYtd: planCum, mtd, ytd: ytdV };
    });
  };

  // Actual Performance (L012) and Performance by Type (L013) for the activities on this page.
  const pageRevenue = (f: Fact) => f.pnlKey === "membershipfees" || SPONSOR_KEYS.has(f.pnlKey) || f.pnlKey === "seminars";
  const pageActivities = new Set(facts.filter((f) => is.revenue(f) && pageRevenue(f)).map((f) => f.activity));
  const actualPerformance = [...pageActivities]
    .map((activity) => {
      const f = facts.filter((x) => x.activity === activity && is.revenue(x));
      const actual = sum(f, is.actual, y);
      const plan = sum(f, is.budget, y);
      return { name: activity, actual: Math.max(actual, 0), toGo: Math.max(plan - actual, 0), achievePct: pct(actual, plan) };
    })
    .filter((r) => r.actual || r.toGo)
    .sort((a, b) => b.actual + b.toGo - (a.actual + a.toGo));

  const perfCodes = new Set(facts.filter((f) => is.revenue(f) && pageRevenue(f) && f.budgetCode).map((f) => f.budgetCode!));
  const perf = new Map<string, Map<string, { revenue: number; expense: number }>>();
  for (const f of facts) {
    if (!is.actual(f) || !y(f) || !f.budgetCode || !perfCodes.has(f.budgetCode)) continue;
    if (!perf.has(f.profitCenter)) perf.set(f.profitCenter, new Map());
    const m = perf.get(f.profitCenter)!;
    const r = m.get(f.budgetName) ?? { revenue: 0, expense: 0 };
    r[f.kind] += f.amount;
    m.set(f.budgetName, r);
  }
  const performanceByType = [...perf.entries()]
    .map(([label, items]) => {
      const children = [...items.entries()]
        .map(([name, v]) => ({ label: name, revenue: v.revenue, expense: v.expense, gp: v.revenue - v.expense }))
        .sort((a, b) => b.revenue - a.revenue);
      const revenue = children.reduce((s, c) => s + c.revenue, 0);
      const expense = children.reduce((s, c) => s + c.expense, 0);
      return { label, revenue, expense, gp: revenue - expense, children };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    membership: segment((k) => k === "membershipfees"),
    sponsorship: segment((k) => SPONSOR_KEYS.has(k)),
    seminar: segment((k) => k === "seminars"),
    counts: {
      events: new Set(of("event").map((a) => a.eventName)).size,
      participants: of("event").reduce((s, a) => s + a.participants, 0),
      sponsors: new Set(of("sponsor").flatMap((a) => a.companyKeys)).size,
      activeMembers: stat("Actual", flt.month),
    },
    memberTypes,
    retention: series("renewMembers", "Plan Renew"),
    acquisition: series("newMembers", "Plan Member New"),
    activeSeries: MONTH_LABELS.map((label, i) => ({ label, value: stat("Actual", i + 1) })),
    performanceByType,
    actualPerformance,
  };
}

// ── 5. P&L ───────────────────────────────────────────────────

export interface PnlValues {
  budget: number;
  budgetPct: number;
  budgetYtd: number;
  budgetYtdPct: number;
  actualYtd: number;
  actualYtdPct: number;
  budgetNext: number;
  projection: number;
  remaining: number;
  changeFromPlan: number;
  toGoPlan: number;
  outlook: number;
}
export interface PnlRow {
  id: string;
  label: string;
  depth: number;
  kind: "header" | "group" | "leaf" | "total";
  side: "revenue" | "expense" | "result";
  values: PnlValues | null;
  children?: PnlRow[];
}

type Raw = Omit<PnlValues, "budgetPct" | "budgetYtdPct" | "actualYtdPct" | "remaining">;

/** P&L Blueprint 5.1 (L001 Revenue / L002 Expense). */
export function pnlPage(ctx: DashboardContext, flt: Filters) {
  const facts = scoped(ctx, flt);
  const y = ytd(flt);
  const m = flt.month;

  const rawFor = (pred: (f: Fact) => boolean): Raw => {
    const f = facts.filter(pred);
    const budget = sum(f, is.budget);
    const budgetYtd = sum(f, is.budget, y);
    const actualYtd = sum(f, is.actual, y);
    const budgetNext = m < 12 ? sum(f, is.budget, inMonth(m + 1)) : 0; // Budget of the next month only
    const toGoPlan = sum(f, is.budget, (x) => x.month > m + 1); // remaining months after next
    const projection = actualYtd + budgetNext;
    return { budget, budgetYtd, actualYtd, budgetNext, projection, changeFromPlan: actualYtd - budgetYtd, toGoPlan, outlook: projection + toGoPlan };
  };
  const zero: Raw = rawFor(() => false);
  const combine = (a: Raw, b: Raw, sign: 1 | -1): Raw => {
    const out = {} as Raw;
    for (const k of Object.keys(a) as (keyof Raw)[]) out[k] = a[k] + sign * b[k];
    return out;
  };

  // Leaf rows from the P&L master; Special Project rows come from งบโครงการพิเศษ budgets.
  const sections = new Map<number, typeof ctx.pnl>();
  for (const p of ctx.pnl) {
    if (!sections.has(p.sort1)) sections.set(p.sort1, []);
    sections.get(p.sort1)!.push(p);
  }
  type Node = { id: string; label: string; depth: number; kind: PnlRow["kind"]; side: PnlRow["side"]; raw: Raw | null; children?: Node[] };
  const leaf = (key: string, label: string, depth: number, side: PnlRow["side"]): Node => ({
    id: `leaf-${key}`,
    label,
    depth,
    kind: "leaf",
    side,
    raw: rawFor((f) => f.pnlKey === key && (side === "revenue" ? is.revenue(f) : is.expense(f))),
  });
  const totalOf = (nodes: Node[]) => nodes.reduce((acc, n) => (n.raw ? combine(acc, n.raw, 1) : acc), zero);

  const groups: { sort1: number; level1: string | null; rows: Node[]; total: Raw }[] = [];
  for (const [sort1, items] of sections) {
    const withL2 = items.filter((p) => p.level2);
    if (!withL2.length) continue;
    const side: PnlRow["side"] = sort1 < 5 ? "revenue" : "expense";
    const byL2 = new Map<string, typeof items>();
    for (const p of withL2) {
      if (!byL2.has(p.level2!)) byL2.set(p.level2!, []);
      byL2.get(p.level2!)!.push(p);
    }
    const rows: Node[] = [];
    for (const [level2, l2] of byL2) {
      const leaves = l2.filter((p) => p.level3 && p.key);
      if (leaves.length) {
        const children = leaves.map((p) => leaf(norm(p.key), p.level3!, 2, side));
        rows.push({ id: `g-${sort1}-${norm(level2)}`, label: level2, depth: 1, kind: "group", side, raw: totalOf(children), children });
      } else if (l2[0].key) {
        rows.push(leaf(norm(l2[0].key), level2, 1, side));
      } else {
        rows.push({ id: `calc-${norm(level2)}`, label: level2, depth: 1, kind: "total", side: "result", raw: null });
      }
    }
    groups.push({ sort1, level1: items[0].level1, rows, total: totalOf(rows) });
  }

  const section = (level1: string) => groups.find((g) => g.level1 === level1);
  const unmappedRev = rawFor((f) => is.revenue(f) && !f.pnlKey);
  const unmappedExp = rawFor((f) => is.expense(f) && !f.pnlKey);
  const revenueGroups = groups.filter((g) => g.sort1 < 5);
  const totalRevenue = combine(revenueGroups.reduce((a, g) => combine(a, g.total, 1), zero), unmappedRev, 1);
  const noi = section("Net Operating Income")?.total ?? zero;
  const direct = section("Total Direct Expense")?.total ?? zero;
  const admin = section("Total Administrative Expenses")?.total ?? zero;
  const tail = groups.find((g) => g.level1 === null)?.rows ?? [];
  const dep = tail.find((r) => r.id === "leaf-depreciationamortization")?.raw ?? zero;
  const tax = tail.find((r) => r.id === "leaf-tax")?.raw ?? zero;
  const special = tail.find((r) => r.kind === "group")?.raw ?? zero;

  const beforeAdmin = combine(totalRevenue, direct, -1);
  const ebt = combine(combine(beforeAdmin, admin, -1), dep, -1);
  const afterTax = combine(ebt, tax, -1);
  const ebitda = combine(ebt, dep, 1);
  const net = combine(combine(afterTax, special, -1), unmappedExp, -1);
  for (const r of tail) if (r.kind === "total") r.raw = /ebt/i.test(r.label) ? ebt : afterTax;

  // % to Operating Income uses the Net Operating Income total of the same column.
  const finish = (n: Node): PnlRow => {
    const v = n.raw;
    let values: PnlValues | null = null;
    if (v) {
      const remaining = v.budget - v.projection;
      values = {
        ...v,
        budgetPct: pct(v.budget, noi.budget),
        budgetYtdPct: pct(v.budgetYtd, noi.budgetYtd),
        actualYtdPct: pct(v.actualYtd, noi.actualYtd),
        // Revenue lines whose projection already exceeds the budget show 0.
        remaining: n.side === "revenue" ? Math.max(remaining, 0) : remaining,
      };
    }
    return { id: n.id, label: n.label, depth: n.depth, kind: n.kind, side: n.side, values, children: n.children?.map(finish) };
  };
  const header = (label: string): PnlRow => ({ id: `h-${norm(label)}`, label, depth: 0, kind: "header", side: "result", values: null });
  const totalRow = (label: string, raw: Raw, side: PnlRow["side"] = "result") => finish({ id: `t-${norm(label)}`, label, depth: 0, kind: "total", side, raw });
  const sectionRow = (g: (typeof groups)[number]) =>
    finish({ id: `s-${g.sort1}`, label: g.level1 ?? "", depth: 0, kind: "group", side: g.sort1 < 5 ? "revenue" : "expense", raw: g.total, children: g.rows });

  const rows: PnlRow[] = [header("Revenue")];
  for (const g of revenueGroups) rows.push(sectionRow(g));
  if (unmappedRev.actualYtd || unmappedRev.budget)
    rows.push(finish({ id: "unmapped-rev", label: "รายได้ที่ยังไม่จับคู่บรรทัด P&L", depth: 0, kind: "leaf", side: "revenue", raw: unmappedRev }));
  rows.push(totalRow("Total Revenue", totalRevenue, "revenue"));
  rows.push(header("Expense"));
  const directG = section("Total Direct Expense");
  if (directG) rows.push(sectionRow(directG));
  rows.push(totalRow("Revenues over expenses Before Administrative Exp.", beforeAdmin));
  const adminG = section("Total Administrative Expenses");
  if (adminG) rows.push(sectionRow(adminG));
  rows.push(totalRow("EBITDA", ebitda));
  for (const r of tail) rows.push(finish({ ...r, depth: 0 }));
  if (unmappedExp.actualYtd || unmappedExp.budget)
    rows.push(finish({ id: "unmapped-exp", label: "ค่าใช้จ่ายที่ยังไม่จับคู่บรรทัด P&L", depth: 0, kind: "leaf", side: "expense", raw: unmappedExp }));
  rows.push(totalRow("Revenues over expenses Net", net));

  // Operating Income card (L001): Net Operating Income revenue, actual YTD vs full-year plan.
  const opActual = noi.actualYtd;
  const opPlan = noi.budget;

  // Development Project (L002): Special Project budgets, actual by expense type, stacked by month.
  const specialFacts = facts.filter((f) => f.isSpecial && is.actual(f) && is.expense(f) && y(f));
  const devTypes = [...new Set(specialFacts.map((f) => ctx.pnlByKey.get(f.pnlKey)?.key ?? "อื่น ๆ"))];
  const developmentProjects = devTypes.map((type) => {
    const row: Record<string, number | string> = { name: type };
    for (let mm = 1; mm <= m; mm++) {
      row[MONTH_LABELS[mm - 1]] = sum(specialFacts, inMonth(mm), (f) => (ctx.pnlByKey.get(f.pnlKey)?.key ?? "อื่น ๆ") === type);
    }
    return row;
  });

  return {
    rows,
    operatingIncome: {
      actual: opActual,
      plan: opPlan,
      achievePct: pct(opActual, opPlan),
      toGo: opActual - opPlan,
      toGoPct: pct(opActual - opPlan, opPlan),
      over: Math.max(opActual - opPlan, 0),
    },
    developmentProjects,
    devMonths: MONTH_LABELS.slice(0, m),
  };
}

// ── 6. Capital expenditure ───────────────────────────────────

/** CAPEX Blueprint 5.1: ประเภทงบประมาณ = งบลงทุน, สถานะโครงการ ≠ ยกเลิก. */
export function capitalPage(ctx: DashboardContext, flt: Filters) {
  const progressByCode = new Map(ctx.snapshot.budgetProgress.map((p) => [p.budgetCode, p]));
  const asOf = ctx.snapshot.budgetProgress[0]?.asOf ?? null;

  const projects = ctx.snapshot.budgetLines
    .filter(
      (l) =>
        l.year === flt.year &&
        l.isCapital &&
        l.status !== "ยกเลิก" &&
        inDepartments(flt, ctx.canonicalDepartment(l.department)),
    )
    .map((l) => {
      const p = progressByCode.get(l.budgetCode);
      const monthly = l.expenseMonthly.map((v) => v ?? 0);
      const budget = monthly.slice(0, flt.month).reduce((a, b) => a + b, 0); // Budget Cost YTD
      const used = p?.expenseUsed ?? 0; // ค่าใช้จ่ายตามงบประมาณใช้ไป (Expense Cost)
      const endMonth = l.endDate && l.endDate.getUTCFullYear() === flt.year ? l.endDate.getUTCMonth() + 1 : 12;
      const plannedAfterEnd = l.endDate && l.endDate.getUTCFullYear() < flt.year ? monthly.some((v) => v) : monthly.slice(endMonth).some((v) => v);
      const status = l.status === "เสร็จสิ้น" ? "Completed" : plannedAfterEnd ? "Delay" : "In-Progress";
      return {
        budgetCode: l.budgetCode,
        name: l.name,
        department: ctx.canonicalDepartment(l.department),
        budget,
        used,
        balance: budget - used,
        capitalBalance: p?.balanceCost ?? Math.max(budget - used, 0),
        achievePct: pct(used, budget),
        monthly,
        startDate: l.startDate?.toISOString() ?? null,
        endDate: l.endDate?.toISOString() ?? null,
        status,
      };
    })
    .sort((a, b) => b.monthly.reduce((x, y) => x + y, 0) - a.monthly.reduce((x, y) => x + y, 0));

  const budget = projects.reduce((s, p) => s + p.budget, 0);
  const used = projects.reduce((s, p) => s + p.used, 0);
  const balance = budget - used;
  const byDept = new Map<string, number>();
  for (const p of projects) byDept.set(p.department, (byDept.get(p.department) ?? 0) + p.used);

  return {
    asOf,
    outlay: {
      actual: used,
      plan: budget,
      planFull: projects.reduce((s, p) => s + p.monthly.reduce((x, y) => x + y, 0), 0),
      balance,
      achievePct: pct(used, budget),
      balancePct: pct(balance, budget),
      over: Math.max(used - budget, 0),
    },
    byDepartment: [...byDept.entries()].map(([name, value]) => ({ name, value })).filter((x) => x.value > 0),
    projects,
    statusCounts: {
      completed: projects.filter((p) => p.status === "Completed").length,
      inProgress: projects.filter((p) => p.status === "In-Progress").length,
      delay: projects.filter((p) => p.status === "Delay").length,
    },
    months: MONTH_LABELS,
  };
}

export type KpiPage = ReturnType<typeof kpiPage>;
export type TrainingPage = ReturnType<typeof trainingPage>;
export type ExpenditurePage = ReturnType<typeof expenditurePage>;
export type MembershipPage = ReturnType<typeof membershipPage>;
export type PnlPage = ReturnType<typeof pnlPage>;
export type CapitalPage = ReturnType<typeof capitalPage>;
