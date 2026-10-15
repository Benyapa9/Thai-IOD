"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  tone: "success" | "error";
  text: string;
}

/** Small toast for "saved" / "failed" feedback. Errors stay until closed; success hides after 6 s. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((t: ToastMessage) => {
    window.clearTimeout(timer.current);
    setToast(t);
    if (t.tone === "success") timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = toast ? (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl",
        toast.tone === "success" ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger",
      )}
    >
      {toast.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <span className="flex-1">{toast.text}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="ปิดข้อความ" className="rounded p-0.5 hover:bg-white/60 cursor-pointer">
        <X className="size-4" />
      </button>
    </div>
  ) : null;
  return { show, node };
}
