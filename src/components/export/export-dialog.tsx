"use client";

import { useQueries } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Download,
  FileDown,
  FileImage,
  FileText,
  GripVertical,
  Presentation,
  RotateCcw,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useCan } from "@/components/layout/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { type PageData, type ResolvedFilters, useDashboardFilters } from "@/hooks/dashboard";
import { api, qs } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHART_REGISTRY, type ChartEntry, type DataKey, ENTRY_BY_ID, REPORT_PAGES, type ReportPage } from "./chart-registry";
import { ensureFonts, resetFontCache, settle } from "./capture";
import { reportName } from "./exporters/download";
import { moveSlide, packSlides, planSlides } from "./layout-engine";
import { CELL_PAD, CELL_TITLE_H, CoverSlide, type ReportData, type ReportSettings, Scaled, SlideView } from "./slide";
import { EXPORT_THEMES, withAccent } from "./themes";

type Format = "png" | "jpg" | "pdf" | "pptx";
type Status = { phase: "idle" } | { phase: "working"; done: number; total: number; label: string } | { phase: "done"; file: string } | { phase: "error"; message: string };

const FORMATS: { id: Format; label: string; hint: string; icon: typeof FileImage }[] = [
  { id: "pdf", label: "PDF", hint: "1 สไลด์ = 1 หน้า แนวนอน 16:9 เหมาะสำหรับส่งต่อและพิมพ์", icon: FileText },
  { id: "pptx", label: "PowerPoint (PPTX)", hint: "กราฟเส้น/แท่ง/โดนัทแก้ไขได้ใน PowerPoint ตารางและการ์ดเป็นรูปความละเอียดสูง", icon: Presentation },
  { id: "png", label: "PNG", hint: "รูปความละเอียดสูง (3200×1800) ต่อสไลด์ หลายสไลด์รวมเป็น ZIP", icon: FileImage },
  { id: "jpg", label: "JPG", hint: "รูปขนาดไฟล์เล็กกว่า PNG หลายสไลด์รวมเป็น ZIP", icon: FileImage },
];

const STEPS = ["เลือกกราฟ", "จัดเลย์เอาต์และโทนสี", "ดาวน์โหลด"];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Export รายงาน" button for the Dashboard header. */
export function ExportButton({ title, filtersText }: { title: string; filtersText: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <FileDown /> Export รายงาน
      </Button>
      {open && <ExportDialog defaultTitle={title} filtersText={filtersText} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Keep Tab inside the dialog and give focus back to the opener on close. */
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, onEscape: () => void) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (n) => n.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [ref, onEscape]);
}

function pageOfPath(pathname: string): { page: ReportPage; data?: DataKey } {
  if (pathname.startsWith("/dashboard/pnl")) return { page: "pnl", data: "pnl" };
  if (pathname.startsWith("/dashboard/capital")) return { page: "capital", data: "capital" };
  const sub = (["kpi", "training", "expenditure", "membership"] as const).find((k) => pathname.endsWith(`/${k}`));
  return { page: "main", data: sub ?? "kpi" };
}

export function ExportDialog({ defaultTitle, filtersText, onClose }: { defaultTitle: string; filtersText: string; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { period, dept, pc } = useDashboardFilters();
  const canPnl = useCan("forecast.view");
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const busy = status.phase === "working";
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  useFocusTrap(panelRef, close);

  // ── Data: same queries (and cache) as the dashboard pages, with the current filters ──
  const pages = REPORT_PAGES.filter((p) => p.id !== "pnl" || canPnl);
  const entries = useMemo(() => CHART_REGISTRY.filter((e) => e.page !== "pnl" || canPnl), [canPnl]);
  const dataKeys = useMemo(() => [...new Set(entries.map((e) => e.data))], [entries]);
  const results = useQueries({
    queries: dataKeys.map((k) => ({
      queryKey: ["dashboard", k, period, dept, pc],
      queryFn: () => api.get<{ filters: ResolvedFilters; data: PageData[typeof k] }>(`/api/dashboard/${k}${qs({ period, dept, pc })}`),
    })),
  });
  const data: ReportData = {};
  dataKeys.forEach((k, i) => {
    const r = results[i]?.data;
    if (r) (data as Record<string, unknown>)[k] = r.data;
  });
  const loading = results.some((r) => r.isLoading);
  const failed = results.find((r) => r.error)?.error as Error | undefined;

  // ── Step 1: selection (order = slide order) ──
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<string[]>(() => {
    const here = pageOfPath(pathname);
    return entries.filter((e) => e.page === here.page && (!here.data || e.data === here.data)).map((e) => e.id);
  });
  const selected = useMemo(() => new Set(order), [order]);
  const setSelected = (ids: string[], on: boolean) =>
    setOrder((o) => (on ? [...o, ...ids.filter((id) => !o.includes(id))] : o.filter((id) => !ids.includes(id))));

  // ── Step 2: layout, theme, settings ──
  const [themeId, setThemeId] = useState("brand");
  const [accent, setAccent] = useState<string | null>(null);
  const theme = withAccent(EXPORT_THEMES.find((t) => t.id === themeId) ?? EXPORT_THEMES[0], accent);
  const [settings, setSettings] = useState<ReportSettings>({ title: defaultTitle, date: today(), logo: true, cover: true, pageNumbers: true, filtersText });
  const sizeOf = (id: string) => ENTRY_BY_ID.get(id)?.size ?? "half";
  const items = order.map((id) => ({ id, size: sizeOf(id) }));
  const plans = planSlides(items);
  const groups = packSlides(items);
  const totalPages = plans.length + (settings.cover ? 1 : 0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= groups.length || from === to) return;
    setOrder(moveSlide(groups, from, to));
  };

  // ── Step 3: export ──
  const [format, setFormat] = useState<Format>("pdf");
  const [rendering, setRendering] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const baseName = reportName(settings.date);

  async function runExport() {
    setStatus({ phase: "working", done: 0, total: 1, label: "กำลังโหลดฟอนต์ภาษาไทย" });
    setRendering(true);
    try {
      await ensureFonts();
      resetFontCache();
      await settle(); // off-screen slides mount and lay out
      await settle();
      const contentNodes = slideRefs.current.slice(0, plans.length).filter((n): n is HTMLDivElement => !!n);
      const all = [...(settings.cover && coverRef.current ? [coverRef.current] : []), ...contentNodes];
      if (!all.length) throw new Error("ยังไม่ได้เลือกกราฟ");
      const onProgress = (done: number, total: number, label: string) => setStatus({ phase: "working", done, total, label });
      const job = { slides: all, background: theme.bg, baseName, onProgress };
      if (format === "png") await (await import("./exporters/png")).exportPng(job);
      else if (format === "jpg") await (await import("./exporters/jpg")).exportJpg(job);
      else if (format === "pdf") await (await import("./exporters/pdf")).exportPdf(job);
      else await (await import("./exporters/pptx")).exportPptx({ plans, data, theme, settings, slideNodes: contentNodes, baseName, onProgress });
      const ext = format === "png" || format === "jpg" ? (all.length > 1 ? `_${format}.zip` : `.${format}`) : `.${format}`;
      setStatus({ phase: "done", file: `${baseName}${ext}` });
    } catch (err) {
      console.error("[export]", err);
      setStatus({ phase: "error", message: err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" });
    } finally {
      setRendering(false);
    }
  }

  const canNext = step === 0 ? order.length > 0 && !loading : true;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-navy-950/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(92vh,940px)] sm:max-w-6xl sm:rounded-2xl"
      >
        {/* Header + stepper */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
          <h2 id={titleId} className="text-lg font-semibold text-navy-900">
            Export รายงาน
          </h2>
          <ol className="order-3 flex w-full gap-1 text-xs sm:order-none sm:ml-4 sm:w-auto" aria-label="ขั้นตอน">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined} className="flex items-center gap-1">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full font-semibold",
                    i < step ? "bg-success text-white" : i === step ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700",
                  )}
                >
                  {i < step ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("hidden md:inline", i === step ? "font-semibold text-navy-900" : "text-muted-foreground")}>{s}</span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
              </li>
            ))}
          </ol>
          <button type="button" onClick={close} disabled={busy} aria-label="ปิดหน้าต่าง Export" className="ml-auto rounded-full p-2 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {failed && (
            <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              <AlertTriangle className="size-4" /> โหลดข้อมูลบางหน้าไม่สำเร็จ: {failed.message}
            </p>
          )}
          {step === 0 && (
            <StepSelect pages={pages} entries={entries} data={data} loading={loading} selected={selected} setSelected={setSelected} />
          )}
          {step === 1 && (
            <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <SettingsPanel
                themeId={themeId}
                setThemeId={setThemeId}
                accent={accent}
                setAccent={setAccent}
                accentShown={theme.accent}
                settings={settings}
                setSettings={setSettings}
              />
              <section aria-label="ตัวอย่างสไลด์">
                <p className="mb-2 text-sm text-muted-foreground">
                  {totalPages} หน้า · ลากสไลด์เพื่อสลับลำดับ หรือใช้ปุ่มลูกศร · กราฟใหญ่และตารางได้พื้นที่มากกว่าโดยอัตโนมัติ
                </p>
                <ol className="grid gap-4 md:grid-cols-2">
                  {settings.cover && (
                    <li className="rounded-xl border border-border p-2">
                      <div className="mb-1.5 text-xs font-medium text-navy-800">หน้าปก</div>
                      <Scaled>
                        <CoverSlide theme={theme} settings={settings} pages={totalPages} />
                      </Scaled>
                    </li>
                  )}
                  {plans.map((plan, i) => (
                    <li
                      key={plan.ids.join("|")}
                      draggable
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom !== null) move(dragFrom, i);
                        setDragFrom(null);
                      }}
                      className={cn("rounded-xl border border-border bg-white p-2", dragFrom === i && "opacity-50")}
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-navy-800">
                        <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
                        สไลด์ {i + 1 + (settings.cover ? 1 : 0)} · {plan.ids.length} รายการ
                        <span className="ml-auto flex gap-1">
                          <button type="button" aria-label={`เลื่อนสไลด์ ${i + 1} ขึ้น`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30 cursor-pointer">
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`เลื่อนสไลด์ ${i + 1} ลง`}
                            disabled={i === plans.length - 1}
                            onClick={() => move(i, i + 1)}
                            className="rounded p-1 hover:bg-muted disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </span>
                      </div>
                      <Scaled>
                        <SlideView plan={plan} data={data} theme={theme} settings={settings} page={i + 1 + (settings.cover ? 1 : 0)} pages={totalPages} />
                      </Scaled>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
          {step === 2 && (
            <div className="mx-auto max-w-3xl">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-navy-900">เลือกรูปแบบไฟล์</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FORMATS.map((f) => (
                    <label
                      key={f.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-navy-500",
                        format === f.id ? "border-navy-800 bg-navy-50" : "border-border hover:bg-navy-50/60",
                      )}
                    >
                      <input type="radio" name="export-format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="sr-only" />
                      <f.icon className="mt-0.5 size-6 shrink-0 text-navy-700" aria-hidden />
                      <span>
                        <span className="block font-semibold text-navy-900">{f.label}</span>
                        <span className="block text-xs text-muted-foreground">{f.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-1 rounded-xl bg-navy-50 p-4 text-sm">
                <dt className="text-muted-foreground">ชื่อไฟล์</dt>
                <dd className="font-medium text-navy-900">
                  {baseName}
                  {format === "png" || format === "jpg" ? (totalPages > 1 ? `_${format}.zip` : `.${format}`) : `.${format}`}
                </dd>
                <dt className="text-muted-foreground">จำนวน</dt>
                <dd className="text-navy-900">
                  {totalPages} หน้า ({order.length} กราฟ/การ์ด)
                </dd>
                <dt className="text-muted-foreground">ตัวกรอง</dt>
                <dd className="text-navy-900">{filtersText}</dd>
              </dl>

              <div className="mt-4" aria-live="polite">
                {status.phase === "working" && (
                  <div>
                    <div className="mb-1 flex justify-between text-sm text-navy-800">
                      <span className="flex items-center gap-2">
                        <Spinner /> {status.label}
                      </span>
                      <span className="tabular-nums">{Math.round((status.done / Math.max(status.total, 1)) * 100)}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="ความคืบหน้าการสร้างไฟล์"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((status.done / Math.max(status.total, 1)) * 100)}
                      className="h-2 overflow-hidden rounded-full bg-navy-100"
                    >
                      <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${(status.done / Math.max(status.total, 1)) * 100}%` }} />
                    </div>
                  </div>
                )}
                {status.phase === "done" && (
                  <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                    <CheckCircle2 className="size-4" /> ดาวน์โหลด {status.file} แล้ว
                  </p>
                )}
                {status.phase === "error" && (
                  <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                    <AlertTriangle className="size-4" /> สร้างไฟล์ไม่สำเร็จ: {status.message}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={runExport}>
                      <RotateCcw /> ลองอีกครั้ง
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-6">
          <span className="text-sm text-muted-foreground">เลือกแล้ว {order.length} รายการ</span>
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft /> ย้อนกลับ
              </Button>
            )}
            {step < 2 ? (
              <Button data-autofocus onClick={() => setStep(step + 1)} disabled={!canNext}>
                ถัดไป <ArrowRight />
              </Button>
            ) : (
              <Button onClick={runExport} disabled={busy || !order.length}>
                {busy ? <Spinner className="text-white" /> : <Download />} ดาวน์โหลด {FORMATS.find((f) => f.id === format)?.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Off-screen, full-size copies used for capture (sharp, independent of the screen size). */}
      {rendering && (
        <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          {settings.cover && (
            <div ref={coverRef}>
              <CoverSlide theme={theme} settings={settings} pages={totalPages} />
            </div>
          )}
          {plans.map((plan, i) => (
            <div
              key={plan.ids.join("|")}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
            >
              <SlideView plan={plan} data={data} theme={theme} settings={settings} page={i + 1 + (settings.cover ? 1 : 0)} pages={totalPages} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepSelect({
  pages,
  entries,
  data,
  loading,
  selected,
  setSelected,
}: {
  pages: typeof REPORT_PAGES;
  entries: ChartEntry[];
  data: ReportData;
  loading: boolean;
  selected: Set<string>;
  setSelected: (ids: string[], on: boolean) => void;
}) {
  const all = entries.map((e) => e.id);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 px-4 py-2.5 text-sm">
        <b className="text-navy-900">
          เลือกแล้ว {selected.size} จาก {all.length} รายการ
        </b>
        {loading && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Spinner /> กำลังโหลดข้อมูลตามตัวกรองปัจจุบัน…
          </span>
        )}
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(all, true)}>
            เลือกทั้งหมด
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(all, false)}>
            ล้างทั้งหมด
          </Button>
        </span>
      </div>
      <div className="space-y-6">
        {pages.map((p) => {
          const list = entries.filter((e) => e.page === p.id);
          const ids = list.map((e) => e.id);
          const n = ids.filter((id) => selected.has(id)).length;
          const sections = [...new Set(list.map((e) => e.section))];
          return (
            <section key={p.id} aria-labelledby={`exp-page-${p.id}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-2">
                <h3 id={`exp-page-${p.id}`} className="text-base font-semibold text-navy-900">
                  {p.label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  เลือก {n} / {ids.length}
                </span>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(ids, true)} aria-label={`เลือกทั้งหมดใน ${p.label}`}>
                    เลือกทั้งหน้า
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(ids, false)} aria-label={`ล้างทั้งหมดใน ${p.label}`}>
                    ล้างทั้งหน้า
                  </Button>
                </span>
              </div>
              {sections.map((sec) => (
                <div key={sec} className="mb-3">
                  {sections.length > 1 && <h4 className="mb-1.5 text-xs font-semibold text-navy-700">{sec}</h4>}
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {list
                      .filter((e) => e.section === sec)
                      .map((e) => {
                        const on = selected.has(e.id);
                        return (
                          <li key={e.id}>
                            <label
                              className={cn(
                                "block h-full cursor-pointer overflow-hidden rounded-xl border transition-colors focus-within:ring-2 focus-within:ring-navy-500",
                                on ? "border-navy-800 ring-1 ring-navy-800" : "border-border hover:border-navy-300",
                              )}
                            >
                              <div className="relative bg-navy-50">
                                <Thumbnail entry={e} data={data} />
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={(ev) => setSelected([e.id], ev.target.checked)}
                                  className="absolute top-2 right-2 size-5 cursor-pointer accent-navy-800"
                                />
                              </div>
                              <span className="block px-3 py-2">
                                <span className="block text-sm leading-snug font-medium text-navy-900">{e.title}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {e.size === "full" ? "เต็มหน้า" : e.size === "half" ? "ครึ่งหน้า" : "การ์ดเล็ก"}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Small live preview of one chart in the brand theme, drawn at 800 × 450 and scaled down. */
function Thumbnail({ entry, data }: { entry: ChartEntry; data: ReportData }) {
  const theme = EXPORT_THEMES[0];
  const d = data[entry.data];
  const box = { w: 800 - CELL_PAD * 2, h: 450 - CELL_PAD * 2 - CELL_TITLE_H };
  return (
    <Scaled width={800} height={450}>
      <div style={{ width: 800, height: 450, padding: CELL_PAD, boxSizing: "border-box", background: theme.surface, fontFamily: "var(--font-sans)" }}>
        <div style={{ height: CELL_TITLE_H, fontSize: 24, fontWeight: 700, color: theme.text }}>{entry.title}</div>
        {d ? entry.render(d as never, theme, box) : <div style={{ fontSize: 22, color: theme.muted }}>กำลังโหลด…</div>}
      </div>
    </Scaled>
  );
}

function SettingsPanel({
  themeId,
  setThemeId,
  accent,
  setAccent,
  accentShown,
  settings,
  setSettings,
}: {
  themeId: string;
  setThemeId: (id: string) => void;
  accent: string | null;
  setAccent: (c: string | null) => void;
  accentShown: string;
  settings: ReportSettings;
  setSettings: (s: ReportSettings) => void;
}) {
  const set = <K extends keyof ReportSettings>(k: K, v: ReportSettings[K]) => setSettings({ ...settings, [k]: v });
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">โทนสี / ธีม</legend>
        <div className="grid grid-cols-2 gap-2">
          {EXPORT_THEMES.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs focus-within:ring-2 focus-within:ring-navy-500",
                themeId === t.id ? "border-navy-800 bg-navy-50" : "border-border hover:bg-navy-50/60",
              )}
            >
              <input type="radio" name="export-theme" className="sr-only" checked={themeId === t.id} onChange={() => setThemeId(t.id)} />
              <span className="flex shrink-0 overflow-hidden rounded" aria-hidden>
                {[t.bg, t.accent, t.series[1], t.series[2]].map((c, i) => (
                  <span key={i} className="h-6 w-3" style={{ background: c }} />
                ))}
              </span>
              <span className="leading-tight text-navy-900">{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="export-accent" className="mb-1 block text-sm font-semibold text-navy-900">
          สีหลัก (Accent)
        </label>
        <div className="flex items-center gap-2">
          <input id="export-accent" type="color" value={accentShown} onChange={(e) => setAccent(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-border" />
          <span className="text-xs text-muted-foreground tabular-nums">{accentShown}</span>
          {accent && (
            <Button size="sm" variant="ghost" onClick={() => setAccent(null)}>
              ใช้สีของธีม
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="export-title" className="mb-1 block text-sm font-semibold text-navy-900">
            ชื่อรายงาน
          </label>
          <Input id="export-title" value={settings.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label htmlFor="export-date" className="mb-1 block text-sm font-semibold text-navy-900">
            วันที่ในรายงาน
          </label>
          <Input id="export-date" type="date" value={settings.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
        </div>
        {(
          [
            ["cover", "ใส่หน้าปก"],
            ["logo", "แสดงโลโก้ Thai IOD"],
            ["pageNumbers", "ใส่เลขหน้า"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-navy-900">
            {label}
            <input type="checkbox" role="switch" checked={settings[k]} onChange={(e) => set(k, e.target.checked)} className="size-5 cursor-pointer accent-navy-800" />
          </label>
        ))}
      </div>
    </div>
  );
}
