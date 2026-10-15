/** Source-system datasets behind the Power BI–style dashboard. */

export interface GlTransaction {
  year: number;
  month: number;
  period: string;
  accountCode: string;
  accountName: string;
  postingDate: Date | null;
  budgetCode: string | null;
  debit: number;
  credit: number;
}

export interface BudgetLine {
  year: number;
  budgetCode: string;
  name: string;
  department: string | null;
  profitCenter: string | null;
  budgetGroup: string | null;
  budgetType: string | null;
  revenueType: string | null;
  expenseType: string | null;
  activity: string | null;
  courseCode: string | null;
  className: string | null;
  seat: number | null;
  status: string | null;
  isCapital: boolean;
  revenueMonthly: number[];
  expenseMonthly: number[];
  startDate: Date | null;
  endDate: Date | null;
}

export interface BudgetProgress {
  budgetCode: string;
  name: string;
  department: string | null;
  profitCenter: string | null;
  courseCode: string | null;
  className: string | null;
  seat: number | null;
  revenuePlan: number;
  budgetCost: number;
  expenseUsed: number;
  balanceCost: number;
  expenseActual: number;
  startDate: Date | null;
  endDate: Date | null;
  asOf: string;
}

export interface AccountMap {
  accountCode: string;
  courseCode: string;
  grouping: string;
  trainingName: string;
}

export interface PnlLine {
  sort1: number;
  sort2: number | null;
  sort3: number | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  key: string | null;
}

export interface Department {
  code: string;
  name: string;
  sort: number;
  mergedInto: string | null;
}

export interface MemberStat {
  memberType: string;
  year: number;
  month: number;
  value: number;
}

export type ActivitySource = "event" | "member" | "sponsor";

export interface ActivityStat {
  source: ActivitySource;
  period: string;
  department: string | null;
  program: string;
  eventName: string;
  memberType: string | null;
  registrations: number;
  attended: number;
  /** Distinct attendee names within the event (names themselves are not stored). */
  participants: number;
  companies: number;
  /** Hashed company names, for distinct counts across events. */
  companyKeys: string[];
  amount: number;
  newMembers: number;
  renewMembers: number;
}

export interface DatasetSnapshot {
  gl: GlTransaction[];
  budgetLines: BudgetLine[];
  budgetProgress: BudgetProgress[];
  accountMap: AccountMap[];
  pnlLines: PnlLine[];
  departments: Department[];
  memberStats: MemberStat[];
  activities: ActivityStat[];
}

/** A parsed source file, ready to replace its slice of the dataset. */
export type DatasetBatch =
  | { kind: "gl"; periods: string[]; rows: GlTransaction[] }
  | { kind: "budgetLines"; years: number[]; rows: BudgetLine[] }
  | { kind: "budgetProgress"; rows: BudgetProgress[] }
  | { kind: "accountMap"; rows: AccountMap[] }
  | { kind: "pnlLines"; rows: PnlLine[] }
  | { kind: "departments"; rows: Department[] }
  | { kind: "memberStats"; rows: MemberStat[] }
  | { kind: "activities"; source: ActivitySource; periods: string[]; rows: ActivityStat[] };
