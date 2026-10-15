"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

/** Click-to-sort for any table (MOM D8, A5). Numbers sort numerically, text in Thai collation. */
export function useSort<T, K extends string>(rows: T[], accessors: Record<K, (row: T) => unknown>, initial?: SortState<NoInfer<K>>) {
  const [sort, setSort] = useState<SortState<K>>(initial ?? { key: null, dir: "asc" });
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const get = accessors[sort.key];
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(get(a), get(b)));
    // accessors are recreated each render; only rows and sort matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: K) =>
    setSort((s) => (s.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : { key: null, dir: "asc" }) : { key, dir: rows.length && typeof accessors[key](rows[0]) === "number" ? "desc" : "asc" }));
  return { sorted, sort, toggle };
}

export function compareValues(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "th");
}

/** Header cell with a sort toggle. */
export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = "left",
}: {
  label: React.ReactNode;
  sortKey: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "border-b border-border bg-navy-50 px-3 py-2 text-xs font-semibold whitespace-nowrap text-navy-800",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 hover:text-navy-950 cursor-pointer", align === "right" && "flex-row-reverse")}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-navy-900" : "text-navy-300")} />
      </button>
    </th>
  );
}
