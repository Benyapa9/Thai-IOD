"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { APP_UPDATED, APP_VERSION } from "@/lib/app-info";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { cn, formatDate } from "@/lib/utils";
import { useT } from "./user-context";

/** "What's new - v… - Update …" link at the bottom of the sidebar; opens the release notes (MOM H4). */
export function WhatsNewLink() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-center text-[10px] whitespace-nowrap text-navy-300 hover:text-white hover:underline cursor-pointer"
      >
        {t("nav.whatsNew")} - {APP_VERSION} - {t("nav.update")} {APP_UPDATED}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${t("home.updates")} · ${APP_VERSION}`}>
        <ol className="max-h-[60vh] space-y-4 overflow-y-auto border-l-2 border-navy-100 pl-4">
          {RELEASE_NOTES.map((u, idx) => (
            <li key={u.date} className="relative">
              <span className={cn("absolute top-1 -left-[23px] size-3 rounded-full ring-4 ring-white", idx === 0 ? "bg-accent" : "bg-navy-300")} />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-navy-900">{u.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(u.date)}</span>
                {idx === 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">ใหม่</span>}
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {u.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}
