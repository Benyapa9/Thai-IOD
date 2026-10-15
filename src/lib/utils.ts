import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const thb = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatTHB(value: number) {
  return `฿${thb.format(value)}`;
}

export function formatCompact(value: number) {
  return compact.format(value);
}

/** Million baht, as in the Power BI reports ("MB"). */
export function formatMB(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "-";
  const mb = value / 1e6;
  const shown = Math.abs(mb) < 0.5 * 10 ** -digits ? 0 : mb; // avoid "-0.0"
  return shown.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(value: number, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** "2026-08" → "ส.ค. 69" · "2026-Q1" → "Q1/69" · "2026" → "ปี 2569" */
export function formatPeriod(period: string) {
  const [year, part] = period.split("-");
  const be = String(Number(year) + 543).slice(-2);
  if (!part) return `ปี ${Number(year) + 543}`;
  if (part.startsWith("Q")) return `${part}/${be}`;
  return `${THAI_MONTHS[Number(part) - 1]} ${be}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function pctChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function quarterOf(period: string) {
  const [year, month] = period.split("-");
  return `${year}-Q${Math.ceil(Number(month) / 3)}`;
}

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
