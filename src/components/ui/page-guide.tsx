"use client";

import { HelpCircle, Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/layout/user-context";

/**
 * Short explanation at the top of each page (MOM G7): what the page is for and
 * how to use it. Collapsed to a small "คำแนะนำการใช้งาน" button by default;
 * the user opens it when needed.
 */
export function PageGuide({ id, title, steps }: { id: string; title: string; steps: string[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        data-guide={id}
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="no-print mb-3 inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs text-navy-700 hover:bg-navy-50 cursor-pointer"
      >
        <HelpCircle className="size-3.5" /> {t("common.guide")}
      </button>
    );
  }
  return (
    <div data-guide={id} className="no-print gradient-border relative mb-5 overflow-hidden rounded-xl bg-gradient-to-r from-navy-50 via-white to-white p-4 pr-10">
      <button
        type="button"
        onClick={() => setOpen(false)}
        title={t("common.hideGuide")}
        aria-label={t("common.hideGuide")}
        className="absolute top-2 right-2 z-10 rounded p-1 text-muted-foreground hover:bg-white cursor-pointer"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-900 to-navy-500 text-white shadow-md">
          <Lightbulb className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-navy-900">{title}</p>
          <ol className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] leading-relaxed text-navy-800 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
