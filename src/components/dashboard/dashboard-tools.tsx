"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Building2, Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCan, useT } from "@/components/layout/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/form";
import { LoadingBlock, Spinner } from "@/components/ui/misc";
import { useDrill } from "@/hooks/dashboard";
import { useThresholds } from "@/hooks/queries";
import { api } from "@/lib/api";
import { DASHBOARD_PAGES, type DashboardPage } from "@/lib/alert-defs";
import { cn, formatMB } from "@/lib/utils";

// ── D3: department multi-select, searchable, A–Z ─────────────

export function DepartmentPicker({
  all,
  value,
  onChange,
  restricted,
}: {
  all: string[];
  value: string[];
  onChange: (v: string[]) => void;
  restricted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<string[]>(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = all.filter((d) => d.toLowerCase().includes(q.trim().toLowerCase()));
  const label = !value.length
    ? restricted
      ? `หน่วยงานของฉัน (${all.length})`
      : "ทุกหน่วยงาน"
    : value.length === 1
      ? value[0]
      : `${value.length} หน่วยงาน`;

  return (
    <div className="relative flex flex-col gap-1" ref={ref}>
      <span id="dept-picker-label" className="text-xs font-medium text-navy-700">
        หน่วยงาน (พิมพ์ค้นหาได้)
      </span>
      <button
        type="button"
        aria-labelledby="dept-picker-label dept-picker-value"
        onClick={() => {
          setDraft(value);
          setQ("");
          setOpen((o) => !o);
        }}
        className="flex h-9 w-64 items-center gap-2 rounded-md border border-navy-200 bg-white px-2.5 text-left text-sm text-navy-900 shadow-sm hover:border-navy-400 cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Search className="size-4 shrink-0 text-navy-500" aria-hidden />
        <span id="dept-picker-value" className="flex-1 truncate">{label}</span>
        <Building2 className="size-3.5 shrink-0 text-navy-400" aria-hidden />
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-72 rounded-lg border border-border bg-white p-2 shadow-xl">
          <div className="relative">
            <Search className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาหน่วยงาน…" className="h-8 pl-7 text-xs" />
          </div>
          <div className="mt-1 flex justify-between px-1 text-xs text-navy-700">
            <button type="button" className="hover:underline cursor-pointer" onClick={() => setDraft(shown)}>
              เลือกทั้งหมด{q && "ที่ค้นหา"}
            </button>
            <button type="button" className="hover:underline cursor-pointer" onClick={() => setDraft([])}>
              ล้าง ({restricted ? "หน่วยงานของฉัน" : "ทุกหน่วยงาน"})
            </button>
          </div>
          <div className="mt-1 max-h-64 overflow-y-auto" role="listbox" aria-multiselectable="true">
            {shown.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-navy-50">
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={draft.includes(d)}
                  onChange={(e) => setDraft(e.target.checked ? [...draft, d] : draft.filter((x) => x !== d))}
                />
                {d}
              </label>
            ))}
            {!shown.length && <p className="py-3 text-center text-xs text-muted-foreground">ไม่พบหน่วยงาน</p>}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">เลือก {draft.length}</span>
            <Button
              size="sm"
              onClick={() => {
                onChange([...draft].sort((a, b) => a.localeCompare(b, "en")));
                setOpen(false);
              }}
            >
              <Check /> ใช้ตัวกรอง
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── D10: alert thresholds per dashboard ─────────────────────

export function AlertsButton({ dashboard, period, dept }: { dashboard: DashboardPage; period?: string; dept?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: alerts = [] } = useThresholds(dashboard, period, dept);
  const breached = alerts.filter((a) => a.breached).length;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(breached > 0 && "border-danger/40 text-danger hover:bg-danger-soft")}
        title="เกณฑ์แจ้งเตือนของ Dashboard นี้"
      >
        {breached > 0 ? <BellRing /> : <Bell />} {t("dashboard.alerts")}
        {breached > 0 && <Badge variant="danger">{breached}</Badge>}
      </Button>
      {open && <AlertsDialog dashboard={dashboard} period={period} dept={dept} onClose={() => setOpen(false)} />}
    </>
  );
}

function AlertsDialog({ dashboard, period, dept, onClose }: { dashboard: DashboardPage; period?: string; dept?: string; onClose: () => void }) {
  const canEdit = useCan("thresholds.edit");
  const qc = useQueryClient();
  const { data: alerts, isLoading } = useThresholds(dashboard, period, dept);
  const [edits, setEdits] = useState<Record<string, { threshold: number; isActive: boolean }>>({});
  const save = useMutation({
    mutationFn: () =>
      api.send("/api/alerts/thresholds", "PUT", {
        thresholds: (alerts ?? []).map((a) => ({
          dashboard,
          metric: a.metric,
          operator: a.operator,
          threshold: edits[a.metric]?.threshold ?? a.threshold,
          isActive: edits[a.metric]?.isActive ?? a.isActive,
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["thresholds"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["insights"] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} title={`เกณฑ์แจ้งเตือน — ${DASHBOARD_PAGES[dashboard].label}`} className="max-w-2xl">
      <p className="mb-3 text-xs text-muted-foreground">
        เมื่อค่าจริงข้ามเกณฑ์ ระบบจะขึ้นเป็นสัญญาณสีแดงในหน้า Insight และส่งอีเมลแจ้ง Standard / Advanced users ·
        เกณฑ์ของแต่ละ Dashboard แยกกัน {canEdit ? "" : "· การแก้ไขเกณฑ์ต้องเป็น Advanced User"}
      </p>
      {isLoading || !alerts ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const e = edits[a.metric] ?? { threshold: a.threshold, isActive: a.isActive };
            return (
              <div key={a.metric} className={cn("rounded-lg border p-3", a.breached ? "border-danger/40 bg-danger-soft/50" : "border-border")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-navy-900">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.hint}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-lg font-bold tabular-nums", a.breached ? "text-danger" : "text-success")}>{a.value.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">{a.breached ? "เกินเกณฑ์" : "อยู่ในเกณฑ์"}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={e.isActive}
                      onChange={(ev) => setEdits({ ...edits, [a.metric]: { ...e, isActive: ev.target.checked } })}
                    />
                    เปิดใช้
                  </label>
                  <span className="text-muted-foreground">แจ้งเตือนเมื่อ{a.operator === "gt" ? "มากกว่า" : "น้อยกว่า"}</span>
                  <Input
                    type="number"
                    step="0.5"
                    disabled={!canEdit}
                    value={e.threshold}
                    onChange={(ev) => setEdits({ ...edits, [a.metric]: { ...e, threshold: Number(ev.target.value) } })}
                    className="h-7 w-24 text-xs"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {save.error && <p className="mt-2 text-sm text-danger">{(save.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          ปิด
        </Button>
        {canEdit && (
          <Button onClick={() => save.mutate()} disabled={save.isPending || !Object.keys(edits).length}>
            {save.isPending && <Spinner className="text-white" />} บันทึกเกณฑ์
          </Button>
        )}
      </div>
    </Dialog>
  );
}

// ── D4: export report as PDF ────────────────────────────────


/** Header that only appears on the exported PDF (MOM D4). */
export function PrintHeader({ title, filtersText, asOf }: { title: string; filtersText: string; asOf: string }) {
  const [url, setUrl] = useState("");
  const [printedAt, setPrintedAt] = useState("");
  useEffect(() => {
    const update = () => {
      setUrl(window.location.href);
      setPrintedAt(new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }));
    };
    window.addEventListener("beforeprint", update);
    return () => window.removeEventListener("beforeprint", update);
  }, []);
  return (
    <div className="print-only mb-4 border-b-2 border-navy-900 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wide text-accent">IOD FINANCE INTELLIGENCE</div>
          <div className="text-xl font-bold text-navy-900">{title}</div>
          <div className="text-xs text-navy-800">ตัวกรอง: {filtersText}</div>
          <div className="text-xs text-navy-800">ข้อมูล ณ: {asOf} · พิมพ์เมื่อ {printedAt}</div>
          <div id="print-note" className="mt-1 text-xs whitespace-pre-wrap text-navy-900" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- printed header */}
        <img src="/brand/thai-iod-logo.png" alt="Thai Institute of Directors" className="h-14 w-auto" />
      </div>
      <div className="mt-1 text-[11px] break-all text-muted-foreground">ดูออนไลน์: {url}</div>
    </div>
  );
}

// ── D1: "+" request a new dashboard ─────────────────────────

export function RequestDashboardButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const send = useMutation({
    mutationFn: () => api.send("/api/feedback", "POST", { type: "new_request", title: `ขอ Dashboard ใหม่: ${title}`, detail, page: "/dashboard" }),
  });
  const close = () => {
    setOpen(false);
    setTitle("");
    setDetail("");
    send.reset();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ขอ Dashboard ใหม่"
        aria-label="ขอ Dashboard ใหม่"
        className="-mb-px flex items-center gap-1 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-navy-900 cursor-pointer"
      >
        <Plus className="size-4" />
      </button>
      {open && (
        <Dialog open onClose={close} title="ขอ Dashboard ใหม่">
          {send.isSuccess ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-success">
                <Check className="size-4" /> ส่งคำขอแล้ว ทีมงานจะติดต่อกลับ
              </p>
              <p className="text-muted-foreground">ติดตามสถานะได้ที่เมนู “แจ้งปัญหา / ข้อเสนอแนะ” (New Request)</p>
              <div className="flex justify-end">
                <Button onClick={close}>ปิด</Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <div>
                <Label htmlFor="req-title">อยากเห็น Dashboard เรื่องอะไร</Label>
                <Input id="req-title" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Cash Flow รายเดือน" />
              </div>
              <div>
                <Label htmlFor="req-detail">ตัวชี้วัด / ข้อมูลที่ต้องการ และนำไปใช้ตัดสินใจอะไร</Label>
                <Textarea id="req-detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
              </div>
              {send.error && <p className="text-sm text-danger">{(send.error as Error).message}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={send.isPending || title.trim().length < 2}>
                  {send.isPending && <Spinner className="text-white" />} ส่งคำขอ
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}

// ── D7: drill-down behind Actual ────────────────────────────

export function DrillDialog({ metric, onClose }: { metric: "revenue" | "expense" | null; onClose: () => void }) {
  const { data, isLoading } = useDrill(metric);
  const [tab, setTab] = useState<"byDepartment" | "byProfitCenter" | "byProject" | "byMonth">("byDepartment");
  if (!metric) return null;
  const tabs = [
    { key: "byDepartment", label: "หน่วยงาน" },
    { key: "byProfitCenter", label: "Profit Center" },
    { key: "byProject", label: "โครงการ" },
    { key: "byMonth", label: "รายเดือน" },
  ] as const;
  const rows = data?.[tab] ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <Dialog open onClose={onClose} title={`ที่มาของ Actual ${metric === "revenue" ? "รายได้" : "ค่าใช้จ่าย"} (สะสม)`} className="max-w-2xl">
      {isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">รวมทั้งหมด</span>
            <span className="text-2xl font-bold tabular-nums text-navy-900">{formatMB(data.total)} MB</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn("rounded-full border px-3 py-1 text-xs cursor-pointer", tab === t.key ? "border-navy-900 bg-navy-900 text-white" : "border-border hover:bg-navy-50")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li key={r.name} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-navy-900">{tab === "byMonth" ? `เดือน ${r.name}` : r.name || "-"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMB(r.value)} MB · {r.share.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-navy-50">
                  <div className="h-1.5 rounded-full bg-navy-600" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">แสดง 10–15 อันดับแรก ตามตัวกรองที่เลือกอยู่</p>
        </>
      )}
    </Dialog>
  );
}

// ── I6: scroll to and highlight the component a link points at ──

export function useFocusTarget(focus: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!focus || !ready) return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`);
      // Data for the page may still be loading — keep looking for up to ~20 s.
      if (el || ++tries > 100) clearInterval(timer);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("focus-target");
      setTimeout(() => el.classList.remove("focus-target"), 4500);
    }, 200);
    return () => clearInterval(timer);
  }, [focus, ready]);
}

/** Small removable chip for an active cross-filter (MOM D6). */
export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2.5 py-1 text-xs text-white">
      {label}
      <button type="button" onClick={onClear} aria-label="ล้างตัวกรอง" className="rounded-full hover:bg-white/20 cursor-pointer">
        <X className="size-3.5" />
      </button>
    </span>
  );
}
