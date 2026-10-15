import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  CATEGORIES,
  type Category,
  type NewFinancialRecord,
  type PeriodType,
  RECORD_TYPES,
  type RecordType,
} from "@/types/domain";
import { CATEGORY_LABEL, RECORD_TYPE_LABEL } from "@/lib/labels";

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  records: NewFinancialRecord[];
  errors: ParseError[];
  totalRows: number;
}

const HEADER_ALIASES: Record<string, string> = {
  period: "period", "งวด": "period", "เดือน": "period",
  periodtype: "periodType", "ประเภทงวด": "periodType",
  category: "category", "หมวด": "category", "หมวดหมู่": "category",
  type: "type", "ประเภท": "type",
  amount: "amount", "จำนวนเงิน": "amount", "ยอด": "amount",
  currency: "currency", "สกุลเงิน": "currency",
  revenue: "revenue", "รายได้": "revenue",
  expense: "expense", "ค่าใช้จ่าย": "expense",
  budget: "budget", "งบประมาณ": "budget",
};

const CATEGORY_ALIASES = Object.fromEntries([
  ...CATEGORIES.map((c) => [c, c]),
  ...Object.entries(CATEGORY_LABEL).map(([k, v]) => [v.toLowerCase(), k]),
]) as Record<string, Category>;

const TYPE_ALIASES = Object.fromEntries([
  ...RECORD_TYPES.map((t) => [t, t]),
  ...Object.entries(RECORD_TYPE_LABEL).map(([k, v]) => [v.toLowerCase(), k]),
]) as Record<string, RecordType>;

const normalizeHeader = (h: string) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s_-]/g, "")] ?? HEADER_ALIASES[h.trim()] ?? h.trim();

function normalizePeriod(raw: unknown): { period: string; periodType: PeriodType } | null {
  if (raw instanceof Date) {
    return {
      period: `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}`,
      periodType: "monthly",
    };
  }
  const s = String(raw ?? "").trim().toUpperCase().replace("/", "-");
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { period: `${m[1]}-${m[2].padStart(2, "0")}`, periodType: "monthly" };
  }
  m = s.match(/^(\d{4})-?Q([1-4])$/);
  if (m) return { period: `${m[1]}-Q${m[2]}`, periodType: "quarterly" };
  m = s.match(/^(\d{4})$/);
  if (m) return { period: m[1], periodType: "annual" };
  return null;
}

function parseAmount(raw: unknown) {
  if (typeof raw === "number") return raw;
  const n = Number(String(raw ?? "").replace(/[,฿\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : NaN;
}

function readRows(buffer: Buffer, filename: string): Record<string, unknown>[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = buffer.toString("utf8").replace(/^﻿/, "");
    return Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    }).data;
  }
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [normalizeHeader(k), v])),
  );
}

/**
 * Accepts either long format (period, category, type, amount) or wide format
 * (period, category, revenue, expense, budget). Headers may be Thai or English.
 */
export function parseFinancialFile(buffer: Buffer, filename: string): ParseResult {
  const rows = readRows(buffer, filename);
  const records: NewFinancialRecord[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, index) => {
    const line = index + 2; // header is row 1
    const period = normalizePeriod(row.period);
    if (!period) {
      errors.push({ row: line, message: `งวดไม่ถูกต้อง: "${row.period ?? ""}" (ใช้ 2026-08, 2026-Q1 หรือ 2026)` });
      return;
    }
    const category = CATEGORY_ALIASES[String(row.category ?? "").trim().toLowerCase()];
    if (!category) {
      errors.push({ row: line, message: `หมวดไม่ถูกต้อง: "${row.category ?? ""}"` });
      return;
    }
    const currency = String(row.currency || "THB").toUpperCase();

    const pairs: [RecordType, unknown][] =
      row.type !== undefined && row.amount !== undefined
        ? [[TYPE_ALIASES[String(row.type).trim().toLowerCase()], row.amount]]
        : RECORD_TYPES.filter((t) => row[t] !== undefined && row[t] !== "").map((t) => [t, row[t]]);

    if (pairs.length === 0) {
      errors.push({ row: line, message: "ไม่พบคอลัมน์ type/amount หรือ revenue/expense/budget" });
      return;
    }
    for (const [type, rawAmount] of pairs) {
      if (!type) {
        errors.push({ row: line, message: `ประเภทไม่ถูกต้อง: "${row.type ?? ""}"` });
        continue;
      }
      const amount = parseAmount(rawAmount);
      if (Number.isNaN(amount)) {
        errors.push({ row: line, message: `จำนวนเงินไม่ถูกต้อง: "${rawAmount}"` });
        continue;
      }
      records.push({ ...period, category, type, amount, currency });
    }
  });

  return { records, errors, totalRows: rows.length };
}
