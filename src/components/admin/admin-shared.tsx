"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { type ClientUser, keys } from "@/hooks/queries";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const NO_DEPT = "ไม่ระบุแผนก";
export const deptOf = (u: ClientUser) => u.department?.trim() || NO_DEPT;

/** Search + "แผนก" checkbox filter (All + each department), as in the admin examples. */
export function useUserFilter(users: ClientUser[]) {
  const departments = useMemo(() => [...new Set(users.map(deptOf))].sort((a, b) => a.localeCompare(b, "th")), [users]);
  const [search, setSearch] = useState("");
  // null = everything ticked (also covers departments that appear later)
  const [picked, setPicked] = useState<string[] | null>(null);
  const isOn = (d: string) => picked === null || picked.includes(d);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) => isOn(deptOf(u)) && (!q || `${u.name} ${u.email} ${u.id} ${u.department ?? ""}`.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, search, picked]);

  const filterBar = (
    <Card className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 p-4">
      <div className="min-w-60 flex-1">
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">ค้นหาชื่อ อีเมล หรือแผนก</div>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา…" className="pl-8" />
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">แผนก</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" className="size-4" checked={picked === null} onChange={(e) => setPicked(e.target.checked ? null : [])} />
            All
          </label>
          {departments.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="size-4"
                checked={isOn(d)}
                onChange={(e) => {
                  const current = picked ?? departments;
                  const next = e.target.checked ? [...current, d] : current.filter((x) => x !== d);
                  setPicked(next.length === departments.length ? null : next);
                }}
              />
              {d}
            </label>
          ))}
        </div>
      </div>
    </Card>
  );

  return { rows, filterBar };
}

/** Header cell with a "select all shown" checkbox under the label. */
export function CheckAllTh({
  label,
  checked,
  indeterminate,
  onChange,
  disabled,
  hint,
}: {
  label: React.ReactNode;
  checked: boolean;
  indeterminate: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <th className="border-b border-border bg-navy-50 px-3 py-2 text-center text-xs font-semibold whitespace-nowrap text-navy-800" title={hint}>
      <div>{label}</div>
      <input
        type="checkbox"
        aria-label={`เลือกทั้งหมด: ${typeof label === "string" ? label : ""}`}
        className="mt-1 size-4 cursor-pointer"
        disabled={disabled}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
    </th>
  );
}

/**
 * Changes are kept locally and saved in one go ("บันทึก"), like the examples,
 * so an admin can tick many boxes and review before applying.
 */
export function usePendingChanges<P extends Record<string, unknown>>() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Record<string, P>>({});
  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(pending);
      const failed: string[] = [];
      for (const [id, patch] of entries) {
        try {
          await api.send(`/api/users/${id}`, "PATCH", patch);
        } catch (err) {
          failed.push((err as Error).message);
        }
      }
      if (failed.length) throw new Error(`บันทึกไม่สำเร็จ ${failed.length} รายการ: ${failed[0]}`);
      return entries.length;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: keys.users }),
    onSuccess: () => setPending({}),
  });
  /** Set a user's pending patch; an empty patch (back to saved values) removes the row from pending. */
  const replace = (id: string, patch: P) =>
    setPending((p) => {
      const next = { ...p };
      if (Object.keys(patch).length) next[id] = patch;
      else delete next[id];
      return next;
    });
  const reset = () => setPending({});
  return { pending, replace, reset, save, count: Object.keys(pending).length };
}

export function SaveBar({
  count,
  saving,
  error,
  savedCount,
  onSave,
  onReset,
  blockReason,
}: {
  count: number;
  saving: boolean;
  error: string | null;
  savedCount: number | undefined;
  onSave: () => void;
  onReset: () => void;
  /** When set, saving is disabled and this is shown instead. */
  blockReason?: string | null;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-lg",
        count ? "border-amber-300 bg-amber-50" : "border-border bg-white",
      )}
    >
      <span className="text-sm text-navy-900">
        {count ? (
          <>
            มีการเปลี่ยนแปลง <b>{count}</b> คนที่ยังไม่บันทึก
          </>
        ) : savedCount ? (
          <span className="text-success">บันทึกเรียบร้อย {savedCount} คน</span>
        ) : (
          <span className="text-muted-foreground">ติ๊กเลือกในตาราง แล้วกด “บันทึก” เพื่อยืนยัน</span>
        )}
      </span>
      {error && <span className="text-sm text-danger">{error}</span>}
      {blockReason && <span className="text-sm font-medium text-danger">{blockReason}</span>}
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={onReset} disabled={!count || saving}>
          <RotateCcw /> ยกเลิกการเปลี่ยนแปลง
        </Button>
        <Button size="sm" onClick={onSave} disabled={!count || saving || !!blockReason}>
          {saving ? <Spinner className="text-white" /> : <Save />} บันทึก
        </Button>
      </div>
    </div>
  );
}
