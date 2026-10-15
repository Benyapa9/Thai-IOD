"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Eye, FilePlus2, Lock, Pencil, RotateCcw, Save, SlidersHorizontal, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisProps } from "@/components/charts/theme";
import { DepartmentPicker } from "@/components/dashboard/dashboard-tools";
import { useCan, useCurrentUser } from "@/components/layout/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/form";
import { EmptyState, ErrorBlock, IconBadge, LoadingBlock, PageHeader, Spinner } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useDashboardMeta } from "@/hooks/dashboard";
import { type ClientScenario, keys, useScenarios } from "@/hooks/queries";
import { api, qs } from "@/lib/api";
import { cn, formatDate, formatMB, formatPercent } from "@/lib/utils";
import type { ScenarioSnapshot } from "@/types/domain";

type BaselineItem = ScenarioSnapshot["baseline"][number];

interface Draft {
  id: string | null;
  ownerId: string | null;
  ownerName?: string;
  name: string;
  period: string;
  departments: string[];
  asOf: string;
  baseline: BaselineItem[];
  /** Active assumptions only: lever key → % change. */
  levers: Record<string, number>;
}

const LIMIT = 50;

export default function ScenarioPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader icon={SlidersHorizontal} tone="violet" title="Scenario Planning" description="ทดลองปรับสมมติฐานรายได้และค่าใช้จ่าย เพื่อดูผลต่อกำไรทั้งปี (What-if)" />
      <PageGuide
        id="scenario"
        title="Scenario Planning ใช้อย่างไร"
        steps={[
          "เลือก “ดู Scenario ที่มีอยู่” หรือ “สร้าง Scenario ใหม่”",
          "สร้างใหม่: เลือกเดือนและหน่วยงาน ระบบดึงค่าคาดการณ์ทั้งปี (Actual สะสม + งบเดือนที่เหลือ) มาเป็นฐาน",
          "กดไอคอนดินสอเพื่อเพิ่ม/ลดสมมติฐาน แล้วปรับด้วยแถบเลื่อนหรือพิมพ์ตัวเลข %",
          "ทุกคนเห็นทุก Scenario ทดลองปรับได้ แต่บันทึกทับได้เฉพาะเจ้าของ — คนอื่นใช้ “บันทึกเป็นฉบับใหม่”",
        ]}
      />
      {draft ? (
        <Editor key={draft.id ?? `new-${draft.period}-${draft.departments.join()}`} initial={draft} onBack={() => setDraft(null)} onSaved={setDraft} />
      ) : creating ? (
        <CreateStep onBack={() => setCreating(false)} onReady={(d) => { setCreating(false); setDraft(d); }} />
      ) : (
        <Landing onCreate={() => setCreating(true)} onOpen={setDraft} />
      )}
    </div>
  );
}

// ── S6: view existing / create new ───────────────────────────

function toDraft(s: ClientScenario): Draft {
  return {
    id: s.id,
    ownerId: s.savedBy,
    ownerName: s.savedByName,
    name: s.name,
    period: s.projections.period,
    departments: s.projections.departments,
    asOf: s.projections.asOf,
    baseline: s.projections.baseline,
    levers: s.levers,
  };
}

function Landing({ onCreate, onOpen }: { onCreate: () => void; onOpen: (d: Draft) => void }) {
  const me = useCurrentUser();
  const { data: scenarios = [], isLoading, error } = useScenarios();
  const { sorted, sort, toggle } = useSort(
    scenarios,
    {
      name: (s: ClientScenario) => s.name,
      owner: (s: ClientScenario) => s.savedByName ?? "",
      period: (s: ClientScenario) => s.projections.period,
      net: (s: ClientScenario) => s.projections.totals.revenue - s.projections.totals.expense,
      date: (s: ClientScenario) => +new Date(s.createdAt),
    },
    { key: "date", dir: "desc" },
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => document.getElementById("scenario-list")?.scrollIntoView({ behavior: "smooth" })}
          className="flex items-start gap-4 rounded-xl border border-border bg-white p-5 text-left transition-shadow hover:shadow-md cursor-pointer"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <Eye className="size-5" />
          </span>
          <span>
            <span className="block font-semibold text-navy-900">ดู Scenario ที่มีอยู่</span>
            <span className="block text-sm text-muted-foreground">{scenarios.length} Scenario จากผู้ใช้ทุกคน — เปิดดูและทดลองปรับได้</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-start gap-4 rounded-xl border border-navy-900 bg-navy-900 p-5 text-left text-white transition-shadow hover:shadow-md cursor-pointer"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-white/15">
            <FilePlus2 className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">สร้าง Scenario ใหม่</span>
            <span className="block text-sm text-navy-200">เลือกช่วงข้อมูลและหน่วยงาน แล้วตั้งสมมติฐาน</span>
          </span>
        </button>
      </div>

      <Card id="scenario-list" className="scroll-mt-20 overflow-hidden">
        <CardHeader>
          <CardTitle><IconBadge icon={Eye} tone="blue" size="sm" /> Scenario ทั้งหมด</CardTitle>
        </CardHeader>
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock error={error} />
          </div>
        ) : !sorted.length ? (
          <div className="p-5">
            <EmptyState title="ยังไม่มี Scenario">เริ่มสร้าง Scenario แรกได้เลย</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <SortTh label="ชื่อ" sortKey="name" sort={sort} onSort={toggle} />
                  <SortTh label="เจ้าของ" sortKey="owner" sort={sort} onSort={toggle} />
                  <SortTh label="ข้อมูล ณ" sortKey="period" sort={sort} onSort={toggle} />
                  <SortTh label="กำไรคาดการณ์ (MB)" sortKey="net" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="บันทึกเมื่อ" sortKey="date" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const t = s.projections.totals;
                  const net = t.revenue - t.expense;
                  const base = t.baseRevenue - t.baseExpense;
                  return (
                    <tr key={s.id} onClick={() => onOpen(toDraft(s))} className="cursor-pointer hover:bg-navy-50/60">
                      <Td>
                        <div className="font-medium text-navy-900">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {Object.keys(s.levers).length} สมมติฐาน · {s.projections.departments.length ? `${s.projections.departments.length} หน่วยงาน` : "ทุกหน่วยงาน"}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {s.savedByName} {s.savedBy === me.id && <Badge>ของฉัน</Badge>}
                      </Td>
                      <Td className="whitespace-nowrap">{s.projections.asOf}</Td>
                      <Td className="text-right tabular-nums">
                        <span className={cn("font-semibold", net >= base ? "text-success" : "text-danger")}>{formatMB(net)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">(ฐาน {formatMB(base)})</span>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(s.createdAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── S4: choose data range / departments for a new scenario ───

interface BaselineResponse {
  asOf: string;
  levers: (BaselineItem & { actualYtd: number; budgetRest: number })[];
}

function CreateStep({ onBack, onReady }: { onBack: () => void; onReady: (d: Draft) => void }) {
  const { data: meta } = useDashboardMeta();
  const [period, setPeriod] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const selected = period || meta?.periods[0]?.value || "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.get<BaselineResponse>(`/api/scenarios/baseline${qs({ period: selected, dept: departments.join(",") || undefined })}`);
      const baseline = res.levers.map(({ key, label, kind, value }) => ({ key, label, kind, value }));
      // Start with the biggest revenue lines and the main expense groups; the pencil adds more.
      const initial = [...baseline.filter((b) => b.kind === "revenue").slice(0, 3), ...baseline.filter((b) => b.kind === "expense").slice(0, 2)];
      onReady({
        id: null,
        ownerId: null,
        name: "",
        period: selected,
        departments,
        asOf: res.asOf,
        baseline,
        levers: Object.fromEntries(initial.map((b) => [b.key, 0])),
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl p-5">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-navy-700 hover:underline cursor-pointer">
        <ArrowLeft className="size-4" /> กลับ
      </button>
      <h2 className="text-lg font-semibold text-navy-900">สร้าง Scenario ใหม่</h2>
      <p className="text-sm text-muted-foreground">ค่าฐานจะถูกบันทึกไว้กับ Scenario ณ วันที่บันทึก (snapshot) แม้ข้อมูลจะอัปเดตภายหลัง</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-period">ข้อมูล Actual ถึงเดือน</Label>
          <Select id="sc-period" value={selected} onChange={(e) => setPeriod(e.target.value)}>
            {meta?.periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>หน่วยงาน</Label>
          {meta && <DepartmentPicker all={meta.departments} value={departments} onChange={setDepartments} restricted={meta.restricted} />}
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end">
        <Button onClick={start} disabled={busy || !selected}>
          {busy && <Spinner className="text-white" />} เริ่มตั้งสมมติฐาน
        </Button>
      </div>
    </Card>
  );
}

// ── Editor: S1 pencil, S3 slider + number, S5 owner-only save ─

function Editor({ initial, onBack, onSaved }: { initial: Draft; onBack: () => void; onSaved: (d: Draft) => void }) {
  const me = useCurrentUser();
  const canSave = useCan("scenario.save");
  const qc = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [levers, setLevers] = useState<Record<string, number>>(initial.levers);
  const [picking, setPicking] = useState(false);
  const isOwner = initial.ownerId === me.id;
  const isNew = !initial.id;
  const readOnlyHint = !isNew && !isOwner;

  const byKey = useMemo(() => new Map(initial.baseline.map((b) => [b.key, b])), [initial.baseline]);
  const active = Object.keys(levers).filter((k) => byKey.has(k));
  const totals = useMemo(() => {
    let baseRevenue = 0;
    let baseExpense = 0;
    let revenue = 0;
    let expense = 0;
    for (const b of initial.baseline) {
      const adj = b.value * (1 + (levers[b.key] ?? 0) / 100);
      if (b.kind === "revenue") {
        baseRevenue += b.value;
        revenue += adj;
      } else {
        baseExpense += b.value;
        expense += adj;
      }
    }
    return { baseRevenue, baseExpense, revenue, expense };
  }, [initial.baseline, levers]);

  const snapshot: ScenarioSnapshot = {
    period: initial.period,
    departments: initial.departments,
    asOf: initial.asOf,
    baseline: initial.baseline,
    totals,
  };
  const save = useMutation({
    mutationFn: async (asNew: boolean) => {
      const body = { name: name.trim() || "Scenario ไม่มีชื่อ", levers, projections: snapshot };
      if (!asNew && initial.id && isOwner) {
        return (await api.send<{ scenario: ClientScenario }>(`/api/scenarios/${initial.id}`, "PATCH", body)).scenario;
      }
      return (await api.send<{ scenario: ClientScenario }>("/api/scenarios", "POST", body)).scenario;
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: keys.scenarios });
      onSaved({ ...toDraft(s), ownerName: me.name });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.send(`/api/scenarios/${initial.id}`, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.scenarios });
      onBack();
    },
  });

  const baseNet = totals.baseRevenue - totals.baseExpense;
  const net = totals.revenue - totals.expense;
  const chart = [
    { name: "รายได้", base: totals.baseRevenue, scenario: totals.revenue },
    { name: "ค่าใช้จ่าย", base: totals.baseExpense, scenario: totals.expense },
    { name: "กำไรสุทธิ", base: baseNet, scenario: net },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft /> Scenario ทั้งหมด
        </Button>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="muted">ข้อมูล ณ {initial.asOf}</Badge>
          <Badge variant="muted">{initial.departments.length ? initial.departments.join(", ") : "ทุกหน่วยงาน"}</Badge>
          {!isNew && <Badge>เจ้าของ: {initial.ownerName ?? "-"}</Badge>}
        </div>
      </div>

      {readOnlyHint && (
        <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
          <Lock className="size-4" /> Scenario นี้เป็นของ {initial.ownerName} — คุณทดลองปรับได้ แต่บันทึกทับไม่ได้ ใช้ “บันทึกเป็นฉบับใหม่” แทน
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle><IconBadge icon={SlidersHorizontal} tone="violet" size="sm" /> สมมติฐาน ({active.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLevers(Object.fromEntries(active.map((k) => [k, 0])))} title="รีเซ็ตเป็น 0%">
                <RotateCcw /> รีเซ็ต
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPicking(true)} title="เพิ่ม / ลดสมมติฐาน">
                <Pencil /> แก้ไขสมมติฐาน
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!active.length && <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีสมมติฐาน — กดไอคอนดินสอเพื่อเพิ่ม</p>}
            {active.map((k) => {
              const b = byKey.get(k)!;
              const v = levers[k] ?? 0;
              const adj = b.value * (1 + v / 100);
              return (
                <div key={k}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-navy-900">
                      <span className={cn("mr-1.5 inline-block size-2 rounded-full", b.kind === "revenue" ? "bg-success" : "bg-danger")} />
                      {b.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ฐาน {formatMB(b.value)} → <b className="text-navy-900">{formatMB(adj)}</b> MB
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      type="range"
                      min={-LIMIT}
                      max={LIMIT}
                      step={1}
                      value={v}
                      onChange={(e) => setLevers({ ...levers, [k]: Number(e.target.value) })}
                      className="flex-1 accent-navy-800"
                      aria-label={`${b.label} (%)`}
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step={0.5}
                        min={-100}
                        max={200}
                        value={v}
                        onChange={(e) => setLevers({ ...levers, [k]: Math.max(-100, Math.min(200, Number(e.target.value) || 0)) })}
                        className="h-8 w-20 text-right text-sm tabular-nums"
                        aria-label={`${b.label} เปอร์เซ็นต์`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[13px] text-muted-foreground">
              <IconBadge icon={net >= baseNet ? TrendingUp : TrendingDown} tone={net >= baseNet ? "green" : "red"} size="sm" />
              กำไรสุทธิคาดการณ์ทั้งปี
            </div>
            <div className={cn("text-3xl font-bold tabular-nums", net >= baseNet ? "text-success" : "text-danger")}>{formatMB(net)} MB</div>
            <div className="text-sm text-muted-foreground">
              ฐาน {formatMB(baseNet)} MB · เปลี่ยน{" "}
              <b className={cn(net - baseNet >= 0 ? "text-success" : "text-danger")}>
                {net - baseNet >= 0 ? "+" : ""}
                {formatMB(net - baseNet)} MB {baseNet ? `(${formatPercent(((net - baseNet) / Math.abs(baseNet)) * 100)})` : ""}
              </b>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted/70 p-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="size-3.5 text-success" /> รายได้</div>
                <div className="font-semibold tabular-nums">{formatMB(totals.revenue)}</div>
              </div>
              <div className="rounded-md bg-muted/70 p-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5 text-danger" /> ค่าใช้จ่าย</div>
                <div className="font-semibold tabular-nums">{formatMB(totals.expense)}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => formatMB(Number(v), 0)} />
                  <Tooltip formatter={(v) => `${formatMB(Number(v))} MB`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="base" name="ฐาน" fill={CHART.expense} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="scenario" name="Scenario" fill={CHART.revenue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <Label htmlFor="sc-name">ชื่อ Scenario</Label>
          <Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น รายได้อบรมลด 10% + คุมค่าใช้จ่ายบริหาร" />
        </div>
        {canSave ? (
          <>
            {(isNew || isOwner) && (
              <Button onClick={() => save.mutate(false)} disabled={save.isPending}>
                {save.isPending ? <Spinner className="text-white" /> : <Save />} {isNew ? "บันทึก" : "บันทึกการแก้ไข"}
              </Button>
            )}
            {!isNew && (
              <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>
                <Copy /> บันทึกเป็นฉบับใหม่
              </Button>
            )}
            {!isNew && isOwner && (
              <Button variant="ghost" className="text-danger" onClick={() => confirm("ลบ Scenario นี้?") && remove.mutate()} disabled={remove.isPending}>
                <Trash2 /> ลบ
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">ทดลองปรับได้ · การบันทึก Scenario ต้องเป็น Standard User ขึ้นไป</p>
        )}
        {(save.error || remove.error) && <p className="w-full text-sm text-danger">{((save.error ?? remove.error) as Error).message}</p>}
        {save.isSuccess && <p className="w-full text-sm text-success">บันทึกแล้ว</p>}
      </Card>

      {picking && (
        <LeverPicker
          baseline={initial.baseline}
          active={active}
          onClose={() => setPicking(false)}
          onApply={(keysOn) => {
            setLevers(Object.fromEntries(keysOn.map((k) => [k, levers[k] ?? 0])));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/** MOM S1 — add or remove assumptions. */
function LeverPicker({
  baseline,
  active,
  onClose,
  onApply,
}: {
  baseline: BaselineItem[];
  active: string[];
  onClose: () => void;
  onApply: (keys: string[]) => void;
}) {
  const [on, setOn] = useState<string[]>(active);
  const [q, setQ] = useState("");
  const shown = baseline.filter((b) => b.label.toLowerCase().includes(q.trim().toLowerCase()));
  const group = (kind: "revenue" | "expense") => shown.filter((b) => b.kind === kind);
  return (
    <Dialog open onClose={onClose} title="เลือกสมมติฐาน" className="max-w-xl">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา…" className="mb-3" />
      <div className="max-h-[55vh] space-y-4 overflow-y-auto">
        {(["revenue", "expense"] as const).map((kind) => (
          <div key={kind}>
            <div className={cn("mb-1 text-xs font-semibold", kind === "revenue" ? "text-success" : "text-danger")}>
              {kind === "revenue" ? "รายได้ (ตาม Profit Center)" : "ค่าใช้จ่าย (ตามกลุ่ม P&L)"}
            </div>
            {group(kind).map((b) => (
              <label key={b.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-navy-50">
                <input type="checkbox" className="size-4" checked={on.includes(b.key)} onChange={(e) => setOn(e.target.checked ? [...on, b.key] : on.filter((k) => k !== b.key))} />
                <span className="flex-1">{b.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatMB(b.value)} MB</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between gap-2">
        <span className="self-center text-xs text-muted-foreground">เลือก {on.length} รายการ</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={() => onApply(on)}>ใช้</Button>
        </div>
      </div>
    </Dialog>
  );
}
