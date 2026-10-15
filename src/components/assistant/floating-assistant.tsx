"use client";

import { Maximize2, Minimize2, Send, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { type ChatSize, useUiStore } from "@/stores/ui-store";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const SUGGESTIONS = ["สรุปผลประกอบการเดือนล่าสุด", "หน่วยงานไหนใช้งบเกินแผน", "รายได้ Profit Center ไหนต่ำกว่าเป้า", "ควรติดตามอะไรเป็นอันดับแรก"];
const BUTTON = 60;
const PANEL: Record<Exclude<ChatSize, "full">, { w: number; h: number }> = { sm: { w: 340, h: 440 }, md: { w: 420, h: 580 } };

/** FINLEY, the assistant character (MOM I9: "ตัวการ์ตูนได้"). */
export const ASSISTANT_NAME = "FINLEY";

function Mascot({ size = 34, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static avatar
    <img src="/brand/finley.png" alt="" aria-hidden="true" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  );
}

const clampTo = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Open the panel above or below the button (towards the middle of the screen);
 * when there is no room vertically, open it beside the button so they never overlap.
 */
function placePanel(at: { x: number; y: number }, w: number, h: number, view: { w: number; h: number }): React.CSSProperties {
  const gap = 12;
  const roomAbove = at.y - gap - 16;
  const roomBelow = view.h - (at.y + BUTTON + gap) - 16;
  const preferAbove = at.y + BUTTON / 2 > view.h / 2;
  const left = clampTo(at.x + BUTTON / 2 > view.w / 2 ? at.x + BUTTON - w : at.x, 16, view.w - w - 16);
  if (preferAbove ? roomAbove >= h : roomBelow >= h) {
    return { width: w, height: h, left, top: preferAbove ? at.y - gap - h : at.y + BUTTON + gap };
  }
  if (!preferAbove ? roomAbove >= h : roomBelow >= h) {
    return { width: w, height: h, left, top: preferAbove ? at.y + BUTTON + gap : at.y - gap - h };
  }
  const toLeft = at.x + BUTTON / 2 > view.w / 2;
  return {
    width: w,
    height: h,
    left: clampTo(toLeft ? at.x - gap - w : at.x + BUTTON + gap, 16, view.w - w - 16),
    top: clampTo(at.y + BUTTON / 2 - h / 2, 16, view.h - h - 16),
  };
}

/**
 * FINLEY floating chat (MOM I9): a round button that can be dragged to any
 * corner, opens a chat in small / medium / full-screen size, and knows the data
 * of every dashboard (limited to the user's departments).
 */
export function FloatingAssistant() {
  const open = useUiStore((s) => s.chatOpen);
  const setOpen = useUiStore((s) => s.setChatOpen);
  const size = useUiStore((s) => s.chatSize);
  const setSize = useUiStore((s) => s.setChatSize);
  const pos = useUiStore((s) => s.chatPos);
  const setPos = useUiStore((s) => s.setChatPos);
  const [view, setView] = useState({ w: 1280, h: 800 });
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const update = () => setView({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(8, p.x), view.w - BUTTON - 8),
    y: Math.min(Math.max(8, p.y), view.h - BUTTON - 8),
  });
  const at = clamp(pos ?? { x: view.w - BUTTON - 24, y: view.h - BUTTON - 24 });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - at.x, dy: e.clientY - at.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const next = { x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy };
    if (Math.abs(next.x - at.x) + Math.abs(next.y - at.y) > 4) drag.current.moved = true;
    if (drag.current.moved) setPos(clamp(next));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) setOpen(!open);
    drag.current = null;
  };

  // Panel opens towards the middle of the screen from wherever the button is.
  const mobile = view.w < 640;
  const dims = size === "full" || mobile ? null : PANEL[size];
  const panelStyle: React.CSSProperties = dims ? placePanel(at, dims.w, Math.min(dims.h, view.h - 32), view) : {};

  return (
    <div className="no-print">
      {open && (
        <div
          role="dialog"
          aria-label="FINLEY"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl",
            !dims && "inset-2 sm:inset-6",
          )}
          style={panelStyle}
        >
          <ChatPanel size={size} onSize={setSize} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "ปิด FINLEY" : "เปิด FINLEY ผู้ช่วย AI"}
        title="FINLEY — ลากเพื่อย้ายตำแหน่ง"
        data-tour="zyinsight"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          "fixed z-50 flex touch-none items-center justify-center overflow-hidden rounded-full bg-navy-900 shadow-lg ring-4 ring-white transition-transform hover:scale-105 cursor-grab active:cursor-grabbing",
          open && size === "full" && "hidden",
        )}
        style={{ width: BUTTON, height: BUTTON, left: at.x, top: at.y }}
      >
        {open ? <X className="size-6 text-white" /> : <Mascot size={BUTTON} />}
      </button>
    </div>
  );
}

function ChatPanel({ size, onSize, onClose }: { size: ChatSize; onSize: (s: ChatSize) => void; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;
    const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const append = (add: string, error = false) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + add, error: last.error || error };
        return next;
      });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FINLEY ไม่สามารถตอบได้");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const data = evt.replace(/^data: /, "");
          if (data === "[DONE]") continue;
          const payload = JSON.parse(data) as { text?: string; error?: string };
          if (payload.text) append(payload.text);
          if (payload.error) append(payload.error, true);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) append(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", true);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const sizes: { key: ChatSize; label: string }[] = [
    { key: "sm", label: "S" },
    { key: "md", label: "M" },
    { key: "full", label: "เต็มจอ" },
  ];

  return (
    <>
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-700 px-3 py-2.5 text-white">
        <span className="relative">
          <Mascot size={36} className="ring-2 ring-white/70" />
          <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-navy-900" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-bold tracking-wide">{ASSISTANT_NAME}</div>
          <div className="truncate text-xs text-navy-200">ผู้ช่วยวิเคราะห์ข้อมูลการเงิน · พร้อมช่วยเหลือ</div>
        </div>
        <div className="hidden rounded-md bg-white/10 p-0.5 sm:flex">
          {sizes.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSize(s.key)}
              className={cn("rounded px-2 py-0.5 text-xs font-medium cursor-pointer", size === s.key ? "bg-white text-navy-900" : "text-navy-100 hover:bg-white/10")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSize(size === "full" ? "md" : "full")}
          className="rounded p-1 hover:bg-white/10 sm:hidden cursor-pointer"
          aria-label="ขยาย/ย่อ"
        >
          {size === "full" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        {messages.length > 0 && (
          <button type="button" title="ล้างบทสนทนา" onClick={() => setMessages([])} className="rounded p-1 hover:bg-white/10 cursor-pointer">
            <Trash2 className="size-4" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="ปิด" className="rounded p-1 hover:bg-white/10 cursor-pointer">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col space-y-3 overflow-y-auto bg-navy-50/40 p-3">
        {messages.length === 0 && (
          <div className="my-auto flex flex-col items-center justify-center px-2 text-center">
            <Mascot size={88} className="shadow-lg ring-4 ring-white" />
            <p className="mt-3 text-base font-semibold text-navy-900">สวัสดีครับ ผม {ASSISTANT_NAME}</p>
            <p className="mt-1 text-xs text-muted-foreground">ถามเรื่องรายได้ ค่าใช้จ่าย งบประมาณ หรือ Insight ได้เลย</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-navy-800 hover:border-navy-300 hover:bg-navy-50 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-end gap-2", m.role === "user" && "justify-end")}>
            {m.role === "assistant" && <Mascot size={26} className="mb-0.5" />}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user" ? "rounded-br-sm bg-navy-900 text-white" : "rounded-bl-sm bg-white text-foreground shadow-sm",
                m.error && "bg-danger-soft text-danger",
              )}
            >
              {m.content || (streaming && i === messages.length - 1 ? <Spinner /> : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border bg-white p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="พิมพ์คำถาม… (Enter เพื่อส่ง)"
          className="min-h-10 resize-none text-sm"
          rows={1}
        />
        {streaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()} aria-label="หยุด" className="rounded-md border border-border p-2.5 hover:bg-muted cursor-pointer">
            <Square className="size-4" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="ส่ง" className="rounded-md bg-navy-900 p-2.5 text-white hover:bg-navy-800 disabled:opacity-50 cursor-pointer">
            <Send className="size-4" />
          </button>
        )}
      </form>
    </>
  );
}
