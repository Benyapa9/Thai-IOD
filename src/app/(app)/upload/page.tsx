"use client";

import { useCan } from "@/components/layout/user-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileWarning,
  FolderPlus,
  Network,
  ScanSearch,
  LayoutDashboard,
  PlusCircle,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, IconBadge, PageHeader, Spinner } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { useDashboardMeta } from "@/hooks/dashboard";
import { type ClientUpload, useUploads } from "@/hooks/queries";
import { api } from "@/lib/api";
import { DASHBOARD_PAGES, type DashboardPage } from "@/lib/alert-defs";
import { SLOT_BY_KEY, SLOT_DISPLAY_ORDER, SLOT_USAGE, type UploadSlot } from "@/lib/upload-slots";
import { cn, formatDate } from "@/lib/utils";
import { UploadHistory } from "./upload-history";

type Mode = "dataset" | "financial" | "reject";

interface Analysis {
  slot: string | null;
  mode: Mode;
  summary: string;
  error: string | null;
  warnings?: string[];
  errorCount: number;
  errors: { row: number; message: string }[];
}

interface QueueItem {
  id: string;
  file: File;
  forcedSlot?: string;
  state: "analyzing" | "analyzed" | "uploading" | "done" | "failed";
  analysis?: Analysis;
  error?: string;
}

const ACCEPT = ".xlsx,.xls,.csv";
const MAX_MB = 20;

/** Nothing left to do for this item (uploaded, failed, or will be skipped). */
const isFinished = (i: QueueItem) =>
  i.state === "done" || i.state === "failed" || (i.state === "analyzed" && i.analysis?.mode === "reject");
const SLOTS = SLOT_DISPLAY_ORDER.map((k) => SLOT_BY_KEY[k]);
const REQUIRED = SLOTS.filter((s) => s.required);
const OPTIONAL = SLOTS.filter((s) => !s.required);
const uploaderOf = (u: ClientUpload) => (u.uploadedBy === "system" ? "นำเข้าจากโฟลเดอร์" : (u.uploaderName ?? "-"));

export default function UploadPage() {
  const canHistory = useCan("upload.history");
  const qc = useQueryClient();
  const { data: uploads = [], isLoading, error } = useUploads();
  const { data: meta } = useDashboardMeta();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const bySlot = useMemo(() => {
    const map = new Map<string, ClientUpload[]>();
    for (const u of uploads) {
      if (!u.slot) continue;
      map.set(u.slot, [...(map.get(u.slot) ?? []), u]);
    }
    for (const list of map.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return map;
  }, [uploads]);

  const missingRequired = REQUIRED.filter((s) => !bySlot.has(s.key));
  const optionalHave = OPTIONAL.filter((s) => bySlot.has(s.key)).length;

  const patch = (id: string, p: Partial<QueueItem>) => setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...p } : item)));

  /** MOM U6: every dropped file is checked immediately, before anything is saved. */
  function addFiles(files: FileList | File[], forcedSlot?: string) {
    setMessage(null);
    const items: QueueItem[] = [...files].map((file) => ({ id: crypto.randomUUID(), file, forcedSlot, state: "analyzing" }));
    setQueue((q) => (q.every(isFinished) ? items : [...q, ...items]));
    for (const item of items) {
      if (!/\.(xlsx|xls|csv)$/i.test(item.file.name)) {
        patch(item.id, { state: "failed", error: "รองรับเฉพาะไฟล์ .xlsx .xls หรือ .csv" });
        continue;
      }
      if (item.file.size > MAX_MB * 1024 * 1024) {
        patch(item.id, { state: "failed", error: `ไฟล์ใหญ่เกิน ${MAX_MB} MB` });
        continue;
      }
      const fd = new FormData();
      fd.append("file", item.file);
      if (forcedSlot) fd.append("slot", forcedSlot);
      api
        .upload<Analysis>("/api/upload?preview=1", fd)
        .then((analysis) => patch(item.id, { state: "analyzed", analysis }))
        .catch((err: Error) => patch(item.id, { state: "failed", error: err.message }));
    }
  }

  async function processAll() {
    const todo = queue.filter((i) => i.state === "analyzed" && i.analysis?.mode !== "reject");
    let ok = 0;
    for (const item of todo) {
      patch(item.id, { state: "uploading" });
      const fd = new FormData();
      fd.append("file", item.file);
      const slot = item.forcedSlot ?? item.analysis?.slot;
      if (slot) fd.append("slot", slot);
      try {
        await api.upload("/api/upload", fd);
        patch(item.id, { state: "done" });
        ok++;
      } catch (err) {
        patch(item.id, { state: "failed", error: (err as Error).message });
      }
    }
    for (const k of [["summary"], ["records"], ["insights"], ["uploads"], ["dashboard"], ["home"]]) void qc.invalidateQueries({ queryKey: k });
    if (ok) setMessage(`เพิ่มข้อมูลสำเร็จ ${ok} ไฟล์ — Dashboard อัปเดตแล้ว`);
  }

  const pickFor = (slot?: string) => {
    targetSlot.current = slot;
    inputRef.current?.click();
  };

  const processing = queue.some((i) => i.state === "uploading");
  const finished = queue.every(isFinished);
  const processable = queue.filter((i) => i.state === "analyzed" && i.analysis?.mode !== "reject").length;
  const busySlots = new Set(queue.filter((i) => i.state === "uploading").map((i) => i.forcedSlot ?? i.analysis?.slot ?? ""));

  return (
    <>
      <Link href="/dashboard" className="no-print mb-2 inline-flex items-center gap-1 text-sm text-navy-700 hover:underline">
        <ArrowLeft className="size-4" /> กลับไป Dashboard
      </Link>
      <PageHeader icon={UploadCloud} tone="blue" title="อัปโหลดข้อมูล" description="เพิ่มข้อมูลล่าสุดเข้าระบบ — ข้อมูลเดิมไม่ถูกลบ ระบบเพิ่ม/อัปเดตเฉพาะส่วนที่อยู่ในไฟล์ใหม่" />

      {/* MOM U1: explain before uploading */}
      <PageGuide
        id="upload"
        title="ก่อนอัปโหลด ควรรู้"
        steps={[
          "ไฟล์แต่ละประเภทป้อนข้อมูลให้ Dashboard ต่างกัน — ดูแผนภาพ “ไฟล์ไหนใช้ที่ Dashboard ใด” ด้านล่าง",
          "ไฟล์ Actual: เพิ่มเดือนใหม่ได้เลย เดือนที่มีในไฟล์จะถูกอัปเดต เดือนอื่นยังอยู่ครบ (ไม่ทับข้อมูลเก่า)",
          "ไฟล์งบประมาณ / Master: แถวที่รหัสตรงกันจะถูกอัปเดต แถวใหม่จะถูกเพิ่ม",
          "วางไฟล์แล้วระบบตรวจรูปแบบทันที — กด “เพิ่มข้อมูล” เมื่อผลตรวจผ่าน · ไม่แน่ใจรูปแบบ ดาวน์โหลดไฟล์ตัวอย่างได้ทุกประเภท",
        ]}
      />

      {/* MOM U6: honest status instead of "10/10" */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-start gap-3 p-4">
          <IconBadge icon={isLoading || !missingRequired.length ? FileCheck2 : FileWarning} tone={isLoading ? "slate" : missingRequired.length ? "red" : "green"} size="lg" />
        <div className="min-w-0">
          <div className="text-[13px] text-muted-foreground">ไฟล์หลัก (จำเป็น)</div>
          <div className={cn("mt-0.5 text-lg font-semibold", isLoading ? "text-muted-foreground" : missingRequired.length ? "text-danger" : "text-success")}>
            {isLoading ? "กำลังตรวจสอบ…" : missingRequired.length ? `ยังขาด ${missingRequired.length} ประเภท` : `ครบทั้ง ${REQUIRED.length} ประเภท`}
          </div>
          {!isLoading && missingRequired.length > 0 && <div className="text-xs text-danger">{missingRequired.map((s) => s.name).join(", ")}</div>}
        </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <IconBadge icon={FolderPlus} tone="teal" size="lg" />
          <div className="min-w-0">
            <div className="text-[13px] text-muted-foreground">ไฟล์เสริม (ข้อมูลสมาชิก/กิจกรรม)</div>
            <div className="mt-0.5 text-lg font-semibold text-navy-900">
              มี {optionalHave} จาก {OPTIONAL.length} ประเภท
            </div>
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <IconBadge icon={CalendarRange} tone="blue" size="lg" />
          <div className="min-w-0">
            <div className="text-[13px] text-muted-foreground">ข้อมูล Actual ในระบบ</div>
            <div className="mt-0.5 text-lg font-semibold text-navy-900">{meta?.scope?.label ?? "ยังไม่มี"}</div>
            <div className="text-xs text-muted-foreground">มีไฟล์ประเภทนั้นแล้ว ≠ ข้อมูลครบทุกเดือน — ตรวจช่วงเดือนที่นี่</div>
          </div>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => pickFor(undefined)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white px-6 py-10 text-center transition-colors cursor-pointer",
          dragging ? "border-navy-500 bg-navy-50" : "border-navy-200 hover:border-navy-400 hover:bg-navy-50/50",
        )}
      >
        <UploadCloud className="size-11 text-navy-400" />
        <p className="mt-3 text-lg font-semibold text-navy-900">ลากไฟล์ Excel มาวางเพื่อเพิ่มข้อมูลล่าสุด</p>
        <p className="mt-1 text-sm text-muted-foreground">วางได้หลายไฟล์พร้อมกัน — ระบบจับคู่ประเภทจากชื่อไฟล์และตรวจรูปแบบให้ทันที</p>
        <span className={cn(buttonVariants({ size: "sm" }), "mt-4")}>เลือกไฟล์จากคอมพิวเตอร์</span>
        <p className="mt-2 text-xs text-muted-foreground">.xlsx · .xls · .csv · ไม่เกิน {MAX_MB} MB ต่อไฟล์</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files, targetSlot.current);
          e.target.value = "";
        }}
      />

      {message && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" /> {message}
          <Link href="/dashboard" className="ml-auto inline-flex items-center gap-1 underline">
            ดู Dashboard <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {queue.length > 0 && (
        <Card className="mt-4 border-navy-300">
          <CardHeader>
            <CardTitle><IconBadge icon={ScanSearch} tone="blue" size="sm" /> ผลตรวจไฟล์ ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.map((item) => (
              <DetectRow key={item.id} item={item} onRemove={() => setQueue((q) => q.filter((i) => i.id !== item.id))} />
            ))}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {finished ? (
                <Button variant="outline" size="sm" onClick={() => setQueue([])}>
                  ปิด
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" disabled={processing} onClick={() => setQueue([])}>
                    ยกเลิก
                  </Button>
                  <Button size="sm" disabled={!processable || processing} onClick={processAll}>
                    {processing ? <Spinner className="text-white" /> : <PlusCircle />}
                    เพิ่มข้อมูล {processable} ไฟล์
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mt-4">
          <ErrorBlock error={error} />
        </div>
      )}

      <FileDashboardMap bySlot={bySlot} />

      <SlotSection title="ไฟล์หลัก" badge={`จำเป็น · ${REQUIRED.length} ประเภท`} slots={REQUIRED} bySlot={bySlot} busy={busySlots} loading={isLoading} onPick={pickFor} />
      <SlotSection title="ไฟล์เสริม" badge={`เพิ่มได้ · ${OPTIONAL.length} ประเภท`} slots={OPTIONAL} bySlot={bySlot} busy={busySlots} loading={isLoading} onPick={pickFor} />

      {canHistory && <UploadHistory />}
    </>
  );
}

function DetectRow({ item, onRemove }: { item: QueueItem; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const a = item.analysis;
  const slot: UploadSlot | undefined = SLOT_BY_KEY[item.forcedSlot ?? a?.slot ?? ""];

  let target: React.ReactNode = <span className="text-muted-foreground">กำลังตรวจสอบรูปแบบ…</span>;
  let badge: React.ReactNode = <Spinner />;
  let result: React.ReactNode = null;

  if (item.state === "failed") {
    target = <span className="text-danger">{item.error}</span>;
    badge = <Badge variant="danger">ไม่ผ่าน</Badge>;
  } else if (a) {
    target = slot ? (
      <span className="font-medium text-navy-900">{slot.name}</span>
    ) : a.mode === "financial" ? (
      <span className="font-medium text-navy-900">ข้อมูลการเงิน (รูปแบบมาตรฐาน)</span>
    ) : (
      <span className="text-muted-foreground">ไม่ตรงกับไฟล์ประเภทใด</span>
    );
    badge =
      item.state === "done" ? (
        <Badge variant="success">
          <CheckCircle2 className="size-3" /> เพิ่มแล้ว
        </Badge>
      ) : item.state === "uploading" ? (
        <Badge variant="muted">
          <Spinner className="size-3" /> กำลังเพิ่มข้อมูล
        </Badge>
      ) : a.mode === "reject" ? (
        <Badge variant="danger">{slot ? "รูปแบบไม่ถูกต้อง" : "ไม่รู้จัก"}</Badge>
      ) : a.warnings?.length ? (
        <Badge variant="warning">ผ่าน มีข้อควรตรวจ</Badge>
      ) : (
        <Badge variant="success">ตรวจผ่าน</Badge>
      );
    result =
      a.mode !== "reject" ? (
        <>
          <b className="text-navy-900">{a.summary}</b>
          {a.errorCount > 0 && (
            <button type="button" onClick={() => setOpen(!open)} className="ml-2 text-danger underline cursor-pointer">
              ข้าม {a.errorCount} แถวที่ผิดพลาด
            </button>
          )}
        </>
      ) : (
        <span className="text-danger">
          {a.error ?? "จะไม่ถูกนำเข้า"}
          {slot && (
            <a href={`/api/upload/sample/${slot.key}`} className="ml-2 underline">
              ดูไฟล์ตัวอย่าง
            </a>
          )}
        </span>
      );
  }

  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <FileSpreadsheet className="size-4 shrink-0 text-navy-500" />
        <span className="max-w-72 min-w-0 truncate font-mono text-xs">{item.file.name}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1">{target}</span>
        {badge}
        {(item.state === "analyzed" || item.state === "failed") && (
          <button type="button" onClick={onRemove} aria-label="นำออก" className="rounded p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="size-4" />
          </button>
        )}
      </div>
      {result && <div className="mt-1 pl-7 text-xs text-muted-foreground">{result}</div>}
      {a?.warnings?.map((w) => (
        <div key={w} className="mt-1 ml-7 flex items-start gap-1.5 rounded bg-warning-soft px-2 py-1 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
        </div>
      ))}
      {open && a && (
        <ul className="mt-2 ml-7 max-h-28 space-y-0.5 overflow-y-auto rounded bg-danger-soft/60 p-2 text-xs text-danger">
          {a.errors.map((e, i) => (
            <li key={i}>
              แถว {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** MOM U2 — which file feeds which dashboard. Hover or click either side to trace the links. */
function FileDashboardMap({ bySlot }: { bySlot: Map<string, ClientUpload[]> }) {
  const [file, setFile] = useState<string | null>(null);
  const [dash, setDash] = useState<DashboardPage | null>(null);
  const dashboards = Object.keys(DASHBOARD_PAGES) as DashboardPage[];
  const fileOn = (key: string) => (file ? file === key : dash ? SLOT_USAGE[key]?.feeds.includes(dash) : false);
  const dashOn = (d: DashboardPage) => (dash ? dash === d : file ? SLOT_USAGE[file]?.feeds.includes(d) : false);
  const active = file ?? dash;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div>
          <CardTitle><IconBadge icon={Network} tone="violet" size="sm" /> ไฟล์ไหนใช้ที่ Dashboard ใด</CardTitle>
          <p className="text-xs text-muted-foreground">ชี้หรือคลิกที่ไฟล์ / Dashboard เพื่อดูความเชื่อมโยง</p>
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFile(null);
              setDash(null);
            }}
          >
            ล้าง
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <ul className="space-y-1.5">
          {SLOTS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onMouseEnter={() => !dash && setFile(s.key)}
                onClick={() => {
                  setDash(null);
                  setFile(file === s.key ? null : s.key);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs transition-colors cursor-pointer",
                  fileOn(s.key) ? "border-navy-700 bg-navy-900 text-white" : active ? "border-border opacity-50" : "border-border hover:bg-navy-50",
                )}
              >
                <FileSpreadsheet className="size-3.5 shrink-0" />
                <span className="flex-1">
                  <span className="font-medium">{s.name}</span>
                  <span className={cn("block text-[11px]", fileOn(s.key) ? "text-navy-200" : "text-muted-foreground")}>{SLOT_USAGE[s.key]?.purpose}</span>
                </span>
                {bySlot.has(s.key) ? <CheckCircle2 className="size-3.5 text-success" /> : s.required ? <AlertCircle className="size-3.5 text-danger" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden flex-col items-center text-muted-foreground md:flex">
          <ArrowRight className={cn("size-6", active && "text-navy-700")} />
          <span className="mt-1 text-[11px]">ป้อนข้อมูลให้</span>
        </div>
        <ul className="space-y-1.5">
          {dashboards.map((d) => (
            <li key={d} className="flex items-center gap-1.5">
              <button
                type="button"
                onMouseEnter={() => !file && setDash(d)}
                onClick={() => {
                  setFile(null);
                  setDash(dash === d ? null : d);
                }}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  dashOn(d) ? "border-accent bg-accent text-white" : active ? "border-border opacity-50" : "border-border hover:bg-navy-50",
                )}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                <span className="flex-1">{DASHBOARD_PAGES[d].label}</span>
              </button>
              <Link href={DASHBOARD_PAGES[d].href} title="เปิด Dashboard" className="rounded p-1.5 text-navy-700 hover:bg-navy-50">
                <ArrowRight className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SlotSection({
  title,
  badge,
  slots,
  bySlot,
  busy,
  loading,
  onPick,
}: {
  title: string;
  badge: string;
  slots: UploadSlot[];
  bySlot: Map<string, ClientUpload[]>;
  busy: Set<string>;
  loading: boolean;
  onPick: (slot: string) => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <IconBadge icon={slots[0]?.required ? FileSpreadsheet : FolderPlus} tone={slots[0]?.required ? "navy" : "teal"} size="sm" />
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <Badge variant={slots[0]?.required ? "solid" : "muted"}>{badge}</Badge>
      </div>
      <Card className="divide-y divide-border">
        {slots.map((s) => {
          const history = bySlot.get(s.key) ?? [];
          const up = history[0];
          const isBusy = busy.has(s.key);
          const state = isBusy || loading ? "proc" : up ? "ready" : s.required ? "missing" : "optional";
          return (
            <div key={s.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", state === "missing" && "bg-danger-soft/40")}>
              <span className="flex size-8 shrink-0 items-center justify-center">
                {state === "ready" && <CheckCircle2 className="size-5 text-success" />}
                {state === "missing" && <AlertCircle className="size-5 text-danger" />}
                {state === "optional" && <PlusCircle className="size-5 text-muted-foreground" />}
                {state === "proc" && <Clock className="size-5 text-navy-500" />}
              </span>
              <div className="min-w-44 flex-1">
                <div className="font-medium text-navy-900">{s.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{s.pattern}</div>
              </div>
              {/* MOM U3: version · when · who */}
              <div className="min-w-52 flex-[1.4] text-xs text-muted-foreground">
                {loading ? (
                  <Spinner />
                ) : up ? (
                  <>
                    <div className="truncate text-foreground">
                      <Badge variant="muted" className="mr-1">
                        เวอร์ชัน {history.length}
                      </Badge>
                      {up.originalName}
                    </div>
                    อัปเดตล่าสุด {formatDate(up.createdAt)} · โดย {uploaderOf(up)}
                    {up.recordCount > 0 && ` · ${up.recordCount.toLocaleString()} รายการ`}
                  </>
                ) : (
                  <span className={cn(state === "missing" && "text-danger")}>ยังไม่มีข้อมูลประเภทนี้</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <a href={`/api/upload/sample/${s.key}`} className={buttonVariants({ variant: "ghost", size: "sm" })} title="ดาวน์โหลดไฟล์ตัวอย่าง">
                  <Download /> ตัวอย่าง
                </a>
                <Button variant={state === "missing" ? "default" : "outline"} size="sm" disabled={isBusy} onClick={() => onPick(s.key)}>
                  <PlusCircle /> {up ? "เพิ่มข้อมูลล่าสุด" : "อัปโหลด"}
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
