"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Check, ChevronDown, Lock, Plus, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { IconBadge, Spinner } from "@/components/ui/misc";
import { type ClientNote, keys, useNotes } from "@/hooks/queries";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * Personal notes: private to their author (the API filters by the signed-in
 * user), written on the Dashboard and listed on Home as reminders.
 */

const sentAt = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dueLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysUntil(due: string) {
  return Math.round((+new Date(`${due}T00:00:00`) - +new Date(`${todayIso()}T00:00:00`)) / 86_400_000);
}

/** Overdue first, then nearest due date, then notes without a date (newest first). */
export function sortOpen(notes: ClientNote[]) {
  return notes
    .filter((n) => !n.done)
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

function useNoteActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: keys.notes });
  const toggle = useMutation({
    mutationFn: (n: ClientNote) => api.send(`/api/notes/${n.id}`, "PATCH", { done: !n.done }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (n: ClientNote) => api.send(`/api/notes/${n.id}`, "DELETE"), onSuccess: refresh });
  return { toggle, remove };
}

function DueBadge({ note }: { note: ClientNote }) {
  if (!note.dueDate) return null;
  const left = daysUntil(note.dueDate);
  const tone = note.done ? "muted" : left < 0 ? "over" : left <= 2 ? "soon" : "ok";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "over" && "bg-danger-soft text-danger",
        tone === "soon" && "bg-warning-soft text-warning",
        tone === "ok" && "bg-navy-50 text-navy-700",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {note.done ? "กำหนด" : left < 0 ? `เลยกำหนด ${-left} วัน ·` : left === 0 ? "ครบกำหนดวันนี้ ·" : "ครบกำหนด"} {dueLabel(note.dueDate)}
    </span>
  );
}

export function NoteItem({ note, compact = false }: { note: ClientNote; compact?: boolean }) {
  const { toggle, remove } = useNoteActions();
  return (
    <li className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5", note.done ? "border-border bg-muted/40" : "border-amber-200 bg-amber-50/60")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={note.done}
        aria-label={note.done ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จแล้ว"}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(note)}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors cursor-pointer",
          note.done ? "border-success bg-success text-white" : "border-navy-300 bg-white hover:border-navy-600",
        )}
      >
        {note.done && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm whitespace-pre-wrap text-navy-900", note.done && "text-muted-foreground line-through", compact && "line-clamp-2")}>{note.content}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>บันทึกเมื่อ {sentAt(note.createdAt)}</span>
          <DueBadge note={note} />
        </div>
      </div>
      {!compact && (
        <button
          type="button"
          onClick={() => remove.mutate(note)}
          disabled={remove.isPending}
          aria-label="ลบ Note นี้"
          title="ลบ Note นี้"
          className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger cursor-pointer"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

/** Write and manage notes (Dashboard → Key Financial Indicators, where Management Note used to be). */
export function PersonalNotesCard({ page }: { page: string }) {
  const qc = useQueryClient();
  const { data: notes = [], isLoading } = useNotes();
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  const create = useMutation({
    mutationFn: () => api.send("/api/notes", "POST", { content, dueDate: dueDate || null, page }),
    onSuccess: () => {
      setContent("");
      setDueDate("");
      void qc.invalidateQueries({ queryKey: keys.notes });
    },
  });
  const open = sortOpen(notes);
  const done = notes.filter((n) => n.done);

  return (
    <Card id="note" className="gradient-border scroll-mt-24 rounded-2xl p-5 lg:scroll-mt-48">
      <div className="flex flex-wrap items-start gap-3">
        <IconBadge icon={StickyNote} tone="amber" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-navy-900">Note ส่วนตัว</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> เห็นเฉพาะคุณ · ข้อความจะแสดงแจ้งเตือนในหน้าแรกเพื่อติดตาม
          </p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 lg:grid-cols-[1fr_200px_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) create.mutate();
        }}
      >
        <div>
          <label htmlFor="note-content" className="mb-1 block text-xs font-medium text-navy-800">
            ข้อความ
          </label>
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="เช่น ตามยอดรายได้ CAC กับทีมขายก่อนสิ้นเดือน"
            className="min-h-10 text-sm"
          />
        </div>
        <div>
          <label htmlFor="note-due" className="mb-1 block text-xs font-medium text-navy-800">
            วันที่ต้องการให้เสร็จ (ไม่บังคับ)
          </label>
          <Input id="note-due" type="date" value={dueDate} min={todayIso()} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button type="submit" disabled={!content.trim() || create.isPending}>
          {create.isPending ? <Spinner className="text-white" /> : <Plus />} บันทึก Note
        </Button>
      </form>
      {create.isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          บันทึกไม่สำเร็จ: {(create.error as Error).message}
        </p>
      )}

      <div className="mt-4">
        {isLoading ? (
          <Spinner />
        ) : !notes.length ? (
          <p className="text-sm text-muted-foreground">ยังไม่มี Note เขียนสิ่งที่อยากติดตามไว้ได้เลย</p>
        ) : (
          <>
            <ul className="space-y-2">
              {open.map((n) => (
                <NoteItem key={n.id} note={n} />
              ))}
              {!open.length && <li className="text-sm text-muted-foreground">ไม่มี Note ที่ค้างอยู่</li>}
            </ul>
            {done.length > 0 && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="text-xs font-medium text-navy-700 hover:underline cursor-pointer">
                  {showDone ? "ซ่อน" : "แสดง"} Note ที่เสร็จแล้ว ({done.length})
                </button>
                {showDone && (
                  <ul className="mt-2 space-y-2">
                    {done.map((n) => (
                      <NoteItem key={n.id} note={n} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

const HOME_NOTES_KEY = "iod-home-notes-open";

/** Home: my open notes as reminders (shown only when there is something open). */
export function HomeNotes() {
  const { data: notes = [] } = useNotes();
  // Collapsed / expanded is remembered in this browser only.
  const [expanded, setExpandedState] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read this browser's saved choice once
      if (localStorage.getItem(HOME_NOTES_KEY) === "0") setExpandedState(false);
    } catch {
      // storage unavailable — stay expanded
    }
  }, []);
  const setExpanded = (v: boolean) => {
    setExpandedState(v);
    try {
      localStorage.setItem(HOME_NOTES_KEY, v ? "1" : "0");
    } catch {
      // storage unavailable — the choice still applies until reload
    }
  };
  const open = sortOpen(notes);
  if (!open.length) return null;
  const overdue = open.filter((n) => n.dueDate && daysUntil(n.dueDate) < 0).length;
  return (
    <Card className="gradient-border rounded-2xl p-5" aria-labelledby="home-notes-title">
      <div className="flex flex-wrap items-center gap-2.5">
        <IconBadge icon={StickyNote} tone="amber" size="sm" />
        <h2 id="home-notes-title" className="text-base font-semibold text-navy-900">
          Note ของฉัน
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">ค้าง {open.length}</span>
        {overdue > 0 && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">เลยกำหนด {overdue}</span>}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden /> เห็นเฉพาะคุณ
        </span>
        <Link href="/dashboard/main/kpi#note" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline">
          จัดการ / เพิ่ม Note <ArrowRight className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="home-notes-list"
          title={expanded ? "ย่อ Note" : "แสดง Note"}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-navy-800 hover:bg-navy-50 cursor-pointer"
        >
          {expanded ? "ย่อ" : "แสดง"}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
      {expanded && (
        <div id="home-notes-list" className="mt-3">
          <ul className="grid gap-2 md:grid-cols-2">
            {open.slice(0, 6).map((n) => (
              <NoteItem key={n.id} note={n} compact />
            ))}
          </ul>
          {open.length > 6 && <p className="mt-2 text-xs text-muted-foreground">และอีก {open.length - 6} รายการ</p>}
        </div>
      )}
    </Card>
  );
}
