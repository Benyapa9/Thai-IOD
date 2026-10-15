"use client";

import { Building2, Check, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CheckAllTh, SaveBar, deptOf, usePendingChanges, useUserFilter } from "@/components/admin/admin-shared";
import { useCurrentUser } from "@/components/layout/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useDashboardMeta } from "@/hooks/dashboard";
import { type ClientUser, useUsers } from "@/hooks/queries";
import { tierLabel } from "@/lib/rbac";
import { tierFromLegacyRole } from "@/lib/access/catalog";
import { cn } from "@/lib/utils";

type Patch = { departments?: string[] | null };
const same = (a: string[] | null, b: string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|"));

/**
 * MOM A5: which departments' data each user may see. "ทุกแผนก" = everything
 * (including departments added later); otherwise pick departments in the popup.
 */
export default function AdminAccessPage() {
  const me = useCurrentUser();
  const { data: users = [], isLoading, error } = useUsers();
  const { data: meta } = useDashboardMeta();
  const allDepartments = meta?.departments ?? [];
  const { rows, filterBar } = useUserFilter(users);
  const changes = usePendingChanges<Patch>();
  const [editing, setEditing] = useState<ClientUser | null>(null);

  const depsOf = (u: ClientUser): string[] | null =>
    changes.pending[u.id] && "departments" in changes.pending[u.id] ? (changes.pending[u.id].departments ?? null) : u.departments;
  const setDeps = (u: ClientUser, departments: string[] | null) =>
    changes.replace(u.id, same(departments, u.departments) ? {} : { departments });

  const { sorted, sort, toggle } = useSort(
    rows,
    {
      name: (u: ClientUser) => u.name,
      email: (u: ClientUser) => u.email,
      dept: (u: ClientUser) => deptOf(u),
      level: (u: ClientUser) => tierLabel(u.tierId ?? tierFromLegacyRole(u.role)),
      all: (u: ClientUser) => (depsOf(u) === null ? 1 : 0),
      count: (u: ClientUser) => depsOf(u)?.length ?? 9999,
    },
    { key: "name", dir: "asc" },
  );
  const editable = sorted.filter((u) => u.id !== me.id);
  const allOn = editable.filter((u) => depsOf(u) === null).length;

  return (
    <div>
      <PageHeader
        icon={Building2}
        tone="teal"
        title="ตั้งค่าสิทธิ์ดูข้อมูลตามแผนก"
        description="กำหนดว่าใครเห็นข้อมูลการเงินของแผนกใดบ้าง — มีผลกับ Dashboard, Insight, Scenario และ FINLEY"
        actions={
          <Link href="/admin/users" className="text-sm font-medium text-navy-700 hover:underline">
            ไปที่ ตั้งค่าระดับสิทธิ์ →
          </Link>
        }
      />
      <PageGuide
        id="admin-access"
        title="วิธีกำหนดสิทธิ์ดูข้อมูล"
        steps={[
          "ติ๊ก “ทุกแผนก” = เห็นข้อมูลทุกหน่วยงาน รวมถึงหน่วยงานที่เพิ่มในอนาคต",
          "ไม่ติ๊ก “ทุกแผนก” แล้วคลิก “แผนก (n)” เพื่อเลือกหน่วยงานที่ให้เห็นได้ทีละหลายแผนก",
          "ติ๊กช่องที่หัวคอลัมน์ “ทุกแผนก” = ตั้งให้ทุกคนที่แสดงอยู่ตามตัวกรอง",
          "กด “บันทึก” เพื่อยืนยัน — สิทธิ์ของตัวเองเปลี่ยนไม่ได้",
        ]}
      />

      {filterBar}

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock error={error} />
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortTh label="พนักงาน" sortKey="name" sort={sort} onSort={toggle} />
                  <SortTh label="อีเมล" sortKey="email" sort={sort} onSort={toggle} />
                  <SortTh label="แผนกต้นสังกัด" sortKey="dept" sort={sort} onSort={toggle} />
                  <SortTh label="ระดับ" sortKey="level" sort={sort} onSort={toggle} />
                  <CheckAllTh
                    label="ทุกแผนก"
                    hint="เห็นข้อมูลทุกหน่วยงาน"
                    disabled={!editable.length}
                    checked={editable.length > 0 && allOn === editable.length}
                    indeterminate={allOn > 0 && allOn < editable.length}
                    onChange={(checked) => {
                      for (const u of editable) setDeps(u, checked ? null : (u.departments ?? []));
                    }}
                  />
                  <SortTh label="แผนกที่ดูได้" sortKey="count" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => {
                  const self = u.id === me.id;
                  const deps = depsOf(u);
                  const changed = !!changes.pending[u.id];
                  return (
                    <tr key={u.id} className={cn(changed && "bg-amber-50", !u.isActive && "text-muted-foreground")}>
                      <Td className="whitespace-nowrap font-medium text-navy-900">
                        {u.name} {self && <Badge variant="muted">คุณ</Badge>}
                        {changed && <span className="ml-1 text-xs font-normal text-amber-700">● แก้ไขแล้ว</span>}
                      </Td>
                      <Td className="text-xs">{u.email}</Td>
                      <Td className="text-xs">{deptOf(u)}</Td>
                      <Td className="text-xs">{tierLabel(u.tierId ?? tierFromLegacyRole(u.role))}</Td>
                      <Td className="text-center">
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer disabled:cursor-not-allowed"
                          aria-label={`${u.name} เห็นทุกแผนก`}
                          disabled={self}
                          checked={deps === null}
                          onChange={(e) => setDeps(u, e.target.checked ? null : (u.departments ?? []))}
                        />
                      </Td>
                      <Td>
                        {deps === null ? (
                          <span className="text-xs text-muted-foreground">ทุกแผนก</span>
                        ) : (
                          <button
                            type="button"
                            disabled={self}
                            onClick={() => setEditing(u)}
                            title={deps.join(", ")}
                            className={cn(
                              "max-w-72 truncate text-left text-sm font-medium underline underline-offset-2 cursor-pointer disabled:cursor-not-allowed",
                              deps.length ? "text-navy-700 hover:text-navy-900" : "text-danger",
                            )}
                          >
                            แผนก ({deps.length}){deps.length ? `: ${deps.join(", ")}` : " — ยังไม่ได้เลือก"}
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {!sorted.length && (
                  <tr>
                    <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                      ไม่พบผู้ใช้ตามตัวกรอง
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <SaveBar
        count={changes.count}
        saving={changes.save.isPending}
        error={changes.save.error ? (changes.save.error as Error).message : null}
        savedCount={changes.save.data}
        onSave={() => changes.save.mutate()}
        onReset={changes.reset}
        blockReason={(() => {
          const empty = users.filter((u) => changes.pending[u.id] && depsOf(u)?.length === 0);
          return empty.length ? `ยังไม่ได้เลือกแผนกให้: ${empty.map((u) => u.name).join(", ")}` : null;
        })()}
      />

      {editing && (
        <DepartmentDialog
          key={editing.id}
          user={editing}
          all={allDepartments}
          value={depsOf(editing) ?? []}
          onClose={() => setEditing(null)}
          onApply={(v) => {
            setDeps(editing, v);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** Popup "แผนกที่ … ดูได้" with a checkbox per department, as in the example. */
function DepartmentDialog({
  user,
  all,
  value,
  onClose,
  onApply,
}: {
  user: ClientUser;
  all: string[];
  value: string[];
  onClose: () => void;
  onApply: (departments: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(value);
  const [q, setQ] = useState("");
  const shown = all.filter((d) => d.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog open onClose={onClose} title={`แผนกที่ ${user.name} ดูได้`}>
      <div className="relative">
        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแผนก…" className="pl-8" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-navy-700">
        <span className="text-muted-foreground">เลือกแล้ว {selected.length} จาก {all.length}</span>
        <span className="flex gap-3">
          <button type="button" className="hover:underline cursor-pointer" onClick={() => setSelected([...new Set([...selected, ...shown])])}>
            เลือกทั้งหมด{q && "ที่ค้นหา"}
          </button>
          <button type="button" className="hover:underline cursor-pointer" onClick={() => setSelected([])}>
            ล้าง
          </button>
        </span>
      </div>
      <div className="mt-2 max-h-[50vh] space-y-0.5 overflow-y-auto border-t border-border pt-2">
        {shown.map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-navy-50">
            <input
              type="checkbox"
              className="size-4"
              checked={selected.includes(d)}
              onChange={(e) => setSelected(e.target.checked ? [...selected, d] : selected.filter((x) => x !== d))}
            />
            {d}
          </label>
        ))}
        {!shown.length && <p className="py-4 text-center text-sm text-muted-foreground">ไม่พบแผนก</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button onClick={() => onApply([...selected].sort((a, b) => a.localeCompare(b, "en")))}>
          <Check /> ตกลง
        </Button>
      </div>
    </Dialog>
  );
}
