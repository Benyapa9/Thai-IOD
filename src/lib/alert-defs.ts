/**
 * KPI alert thresholds per dashboard page (MOM D10). The same KPI (e.g. revenue
 * vs plan) can have a different threshold on each dashboard, so users can see
 * which page a threshold belongs to. Values are "% difference from plan / budget"
 * = (Actual − Plan) ÷ Plan × 100, year-to-date.
 */
export const DASHBOARD_PAGES = {
  kpi: { label: "Key Financial Indicators", href: "/dashboard/main/kpi" },
  training: { label: "Training Courses", href: "/dashboard/main/training" },
  expenditure: { label: "Expenditure by Department", href: "/dashboard/main/expenditure" },
  membership: { label: "Membership & Sponsorship", href: "/dashboard/main/membership" },
  pnl: { label: "P&L", href: "/dashboard/pnl" },
  capital: { label: "Capital (CAPEX)", href: "/dashboard/capital" },
} as const;
export type DashboardPage = keyof typeof DASHBOARD_PAGES;

export interface AlertDef {
  metric: string;
  label: string;
  hint: string;
  operator: "gt" | "lt";
  threshold: number;
  /** Component id on the dashboard page that shows this figure (for "focus" links). */
  focus: string;
}

export const ALERT_DEFS: Record<DashboardPage, AlertDef[]> = {
  kpi: [
    { metric: "revenue_vs_plan", label: "รายได้เทียบแผน (%)", hint: "(Actual − Revenue Plan) ÷ Revenue Plan, สะสมถึงเดือนที่เลือก", operator: "lt", threshold: -10, focus: "revenue" },
    { metric: "expense_vs_budget", label: "ค่าใช้จ่ายเทียบงบ (%)", hint: "(Actual − Budget Cost) ÷ Budget Cost", operator: "gt", threshold: 5, focus: "expense" },
    { metric: "ebitda_pct", label: "EBITDA % ของ Net Operating Income", hint: "Actual EBITDA ÷ Net Operating Income", operator: "lt", threshold: 20, focus: "ebitda" },
  ],
  training: [
    { metric: "revenue_vs_plan", label: "รายได้หลักสูตรเทียบแผน (%)", hint: "รายได้ Training (Public/InHouse) เทียบแผน", operator: "lt", threshold: -10, focus: "revenue" },
    { metric: "expense_vs_budget", label: "ค่าใช้จ่ายหลักสูตรเทียบงบ (%)", hint: "ค่าใช้จ่ายบัญชี 5 ของหลักสูตรเทียบงบ", operator: "gt", threshold: 5, focus: "expense" },
  ],
  expenditure: [
    { metric: "expense_vs_budget", label: "ค่าใช้จ่ายรวมเทียบงบ (%)", hint: "ค่าใช้จ่ายบัญชี 5/6 เทียบ Budget Cost", operator: "gt", threshold: 5, focus: "expense" },
    { metric: "max_dept_over", label: "หน่วยงานที่ใช้งบเกินมากที่สุด (%)", hint: "% ที่ใช้เกินงบของหน่วยงานที่เกินมากที่สุด", operator: "gt", threshold: 10, focus: "overview" },
  ],
  membership: [
    { metric: "membership_vs_plan", label: "รายได้สมาชิกเทียบแผน (%)", hint: "Membership fees เทียบแผน", operator: "lt", threshold: -10, focus: "membership" },
    { metric: "sponsorship_vs_plan", label: "รายได้สปอนเซอร์เทียบแผน (%)", hint: "Donations & sponsorships (MME, CAC) เทียบแผน", operator: "lt", threshold: -10, focus: "sponsorship" },
    { metric: "seminar_vs_plan", label: "รายได้สัมมนาเทียบแผน (%)", hint: "Seminars เทียบแผน", operator: "lt", threshold: -10, focus: "seminar" },
  ],
  pnl: [
    { metric: "noi_vs_plan", label: "Net Operating Income เทียบแผนถึงเดือนนี้ (%)", hint: "Actual YTD เทียบ Budget YTD", operator: "lt", threshold: -10, focus: "operating-income" },
  ],
  capital: [
    { metric: "capex_usage", label: "งบลงทุนใช้ไปเทียบงบถึงเดือนนี้ (%)", hint: "Actual Expense ÷ Budget Cost (YTD) × 100", operator: "gt", threshold: 100, focus: "outlay" },
  ],
};

export function defaultThresholds() {
  return (Object.entries(ALERT_DEFS) as [DashboardPage, AlertDef[]][]).flatMap(([dashboard, defs]) =>
    defs.map((d) => ({ dashboard, metric: d.metric, threshold: d.threshold, operator: d.operator, isActive: true })),
  );
}
