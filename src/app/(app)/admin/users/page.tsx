"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Search, TriangleAlert, UserCog, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCurrentUser } from "@/components/layout/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ErrorBlock, LoadingBlock, PageHeader, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { type ClientUser, keys, useUsers } from "@/hooks/queries";
import { TIER_BY_ID, TIER_IDS, TIERS, type TierId, tierFromLegacyRole } from "@/lib/access/catalog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Change {
  tierId?: TierId;
  isActive?: boolean;
}

const tierOf = (u: ClientUser): TierId => (u.tierId as TierId | null) ?? tierFromLegacyRole(u.role);

/** Per-user tier (access-matrix phase 5, mockup docs/mockups/users.webp). */
export default function AdminUsersPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: users = [], isLoading, error } = useUsers();
  const [pending, setPending] = useState<Record<string, Change>>({});
  const [filter, setFilter] = useState<TierId | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const tierNow = (u: ClientUser) => pending[u.id]?.tierId ?? tierOf(u);
  const activeNow = (u: ClientUser) => pending[u.id]?.isActive ?? u.isActive;

  const setChange = (u: ClientUser, patch: Change) =>
    setPending((p) => {
      const next = { ...p[u.id], ...patch };
      if (next.tierId === tierOf(u)) delete next.tierId;
      if (next.isActive === u.isActive) delete next.isActive;
      const out = { ...p };
      if (next.tierId === undefined && next.isActive === undefined) delete out[u.id];
      else out[u.id] = next;
      return out;
    });

  const counts = (fn: (u: ClientUser) => TierId) =>
    Object.fromEntries(TIER_IDS.map((t) => [t, users.filter((u) => fn(u) === t && (fn === tierOf ? u.isActive : activeNow(u))).length])) as Record<
      TierId,
      number
    >;
  const before = counts(tierOf);
  const after = counts(tierNow);
  const noIt = after.it < 1;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) => (filter === "all" || tierNow(u) === filter) && (!q || `${u.name} ${u.email} ${u.department ?? ""}`.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, filter, search, pending]);
  const selectable = rows.filter((u) => u.id !== me.id);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.includes(u.id));

  const changed = users.filter((u) => pending[u.id]);
  const save = useMutation({
    mutationFn: () =>
      api.send<{ changed: number }>("/api/users", "PATCH", {
        changes: changed.map((u) => ({ userId: u.id, ...pending[u.id] })),
      }),
    onSuccess: (res) => {
      setPending({});
      setSelected([]);
      void qc.invalidateQueries({ queryKey: keys.users });
      toast.show({ tone: "success", text: `บันทึกแล้ว ${res.changed} คน ผู้ใช้จะเห็นสิทธิ์ใหม่ภายใน 1 นาที` });
    },
    onError: (err) => toast.show({ tone: "error", text: (err as Error).message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <div>
      <PageHeader
        icon={UserCog}
        tone="navy"
        title="กำหนดระดับสิทธิ์ของผู้ใช้แต่ละคน"
        description="ผู้ใช้เข้าสู่ระบบด้วยบัญชี Microsoft 365 ผู้ใช้ใหม่จะเริ่มที่ระดับ Basic โดยอัตโนมัติ คลิกที่ระดับเพื่อเปลี่ยน หรือเลือกหลายคนแล้วเปลี่ยนพร้อมกัน แก้เสร็จแล้วกดบันทึกเพื่อยืนยัน"
      />
      <p className="-mt-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{TIERS.map((t) => `${t.name} = ${t.legacyRole}`).join(" · ")}</span>
        <Link href="/admin/tiers" className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
          ดูสิทธิ์ของแต่ละระดับ
        </Link>
        <Link href="/admin/access" className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
          ตั้งค่าแผนกที่ดูข้อมูลได้
        </Link>
      </p>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="กรองตามระดับ" className="flex flex-wrap gap-2">
              {(["all", ...TIER_IDS] as const).map((t) => {
                const n = t === "all" ? users.length : users.filter((u) => tierNow(u) === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={filter === t}
                    onClick={() => setFilter(t)}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer",
                      filter === t ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-900 hover:bg-navy-50",
                    )}
                  >
                    {t === "all" ? "ทั้งหมด" : TIER_BY_ID[t].name} {n}
                  </button>
                );
              })}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ อีเมล แผนก" aria-label="ค้นหาผู้ใช้" className="pl-8" />
            </div>
          </div>

          {selected.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm" role="region" aria-label="เปลี่ยนหลายคนพร้อมกัน">
              <b className="text-navy-900">เลือก {selected.length} คน</b>
              <span className="text-muted-foreground">ตั้งเป็น</span>
              {TIERS.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant="outline"
                  onClick={() => users.filter((u) => selected.includes(u.id)).forEach((u) => setChange(u, { tierId: t.id }))}
                >
                  {t.name}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
                <X /> ยกเลิกการเลือก
              </Button>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[600px] 2xl:min-w-[760px] border-collapse text-sm">
                <caption className="sr-only">รายชื่อผู้ใช้และระดับสิทธิ์</caption>
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-border text-left text-xs font-semibold text-navy-800">
                    <th scope="col" className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        className="size-5 cursor-pointer"
                        aria-label="เลือกทุกคนที่แสดงอยู่ (ยกเว้นตัวคุณเอง)"
                        checked={allSelected}
                        onChange={(e) => setSelected(e.target.checked ? selectable.map((u) => u.id) : [])}
                      />
                    </th>
                    <th scope="col" className="px-2 py-3">ผู้ใช้</th>
                    <th scope="col" className="hidden px-2 py-3 2xl:table-cell">แผนก</th>
                    <th scope="col" className="px-2 py-3">ระดับ (คลิกเพื่อเปลี่ยน)</th>
                    <th scope="col" className="px-2 py-3 text-center">เปิดใช้งาน</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const self = u.id === me.id;
                    const dirty = !!pending[u.id];
                    const tier = tierNow(u);
                    return (
                      <tr key={u.id} className={cn("border-b border-border/70", dirty && "bg-amber-50", !activeNow(u) && "text-muted-foreground")}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="size-5 cursor-pointer disabled:cursor-not-allowed"
                            aria-label={self ? "แก้ไขแถวของตัวเองไม่ได้" : `เลือก ${u.name}`}
                            disabled={self}
                            checked={selected.includes(u.id)}
                            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id)))}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-semibold text-navy-900">
                            {u.name} {self && <Badge variant="muted">คุณ</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                          {u.department && <div className="text-xs text-navy-700 2xl:hidden">{u.department}</div>}
                        </td>
                        <td className="hidden px-2 py-3 text-sm 2xl:table-cell">{u.department ?? "—"}</td>
                        <td className="px-2 py-3">
                          <div role="group" aria-label={`ระดับของ ${u.name}`} className="flex flex-nowrap gap-1.5">
                            {TIERS.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                aria-pressed={tier === t.id}
                                aria-label={`${u.name}: ระดับ ${t.name}`}
                                disabled={self}
                                title={self ? "เปลี่ยนระดับของตัวเองไม่ได้" : t.summary}
                                onClick={() => setChange(u, { tierId: t.id })}
                                className={cn(
                                  "min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                                  tier === t.id ? "border-navy-800 bg-navy-800 text-white" : "border-navy-200 bg-white text-navy-900 hover:bg-navy-50",
                                )}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={activeNow(u)}
                            aria-label={`เปิดใช้งานบัญชีของ ${u.name}`}
                            disabled={self}
                            onClick={() => setChange(u, { isActive: !activeNow(u) })}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                              activeNow(u) ? "bg-success" : "bg-navy-200",
                            )}
                          >
                            <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", activeNow(u) ? "translate-x-5" : "translate-x-0.5")} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground">
                        ไม่พบผู้ใช้ตามตัวกรองนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-navy-900">สรุปก่อนบันทึก</h2>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-navy-900">{changed.length}</span>
              <span className="text-sm text-muted-foreground">คนที่จะถูกเปลี่ยน</span>
            </p>
            {!changed.length && <p className="mt-1 text-sm text-muted-foreground">คลิกที่ระดับของผู้ใช้ในตารางเพื่อเริ่มแก้ไข</p>}
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {changed.map((u) => {
                const c = pending[u.id];
                return (
                  <li key={u.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="font-semibold text-navy-900">{u.name}</div>
                    {c.tierId && (
                      <div className="text-navy-800">
                        ระดับ {TIER_BY_ID[tierOf(u)].name} → {TIER_BY_ID[c.tierId].name}
                      </div>
                    )}
                    {c.isActive !== undefined && <div className="text-navy-800">{c.isActive ? "เปิดใช้งานบัญชี" : "ปิดใช้งานบัญชี"}</div>}
                  </li>
                );
              })}
            </ul>
            {noIt && (
              <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                ต้องเหลือผู้ใช้ระดับ IT ที่เปิดใช้งานอย่างน้อย 1 คน ไม่เช่นนั้นจะไม่มีใครจัดการสิทธิ์ได้ กรุณาแก้ก่อนบันทึก
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" disabled={!changed.length || noIt || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Spinner className="text-white" /> : <Save />} บันทึกการเปลี่ยนแปลง
              </Button>
              <Button variant="outline" disabled={!changed.length || save.isPending} onClick={() => setPending({})}>
                <RotateCcw /> ล้างที่แก้
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-navy-900">จำนวนผู้ใช้ต่อระดับ</h2>
            <p className="text-xs text-muted-foreground">นับเฉพาะบัญชีที่เปิดใช้งาน</p>
            <ul className="mt-3 space-y-3">
              {TIERS.map((t) => {
                const max = Math.max(1, ...TIER_IDS.map((x) => after[x]), ...TIER_IDS.map((x) => before[x]));
                return (
                  <li key={t.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-navy-900">
                        {t.name} ({t.legacyRole})
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {before[t.id] !== after[t.id] ? `${before[t.id]} → ${after[t.id]}` : after[t.id]} คน
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-navy-100" aria-hidden>
                      <div className={cn("h-2 rounded-full", t.id === "it" && noIt ? "bg-danger" : "bg-navy-700")} style={{ width: `${(after[t.id] / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
      {toast.node}
    </div>
  );
}
