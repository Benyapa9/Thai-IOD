"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** How long something must take before the indicator appears (avoids a flash on fast clicks). */
const SHOW_AFTER_MS = 150;
/** Never leave the indicator stuck if a navigation is cancelled. */
const GIVE_UP_MS = 15_000;

/**
 * Global "loading" feedback: a thin bar at the top of the screen while a page
 * change, a data request or a save is in progress, plus a small
 * popup in the middle of the screen while moving to another page or saving.
 */
export function LoadingIndicator() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  // Which URL a click started navigating away from; null = not navigating.
  const [navFrom, setNavFrom] = useState<string | null>(null);
  const here = `${pathname}?${search}`;
  // The URL changed: the navigation finished (adjusting state during render, no effect needed).
  if (navFrom !== null && navFrom !== here) setNavFrom(null);
  const navigating = navFrom !== null;

  // Start: an in-app link was clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or only a #hash change): nothing to load.
      if (url.pathname === location.pathname && url.search === location.search) return;
      setNavFrom(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Stop: give up after a while (the URL change itself ends it, see `navigating`).
  useEffect(() => {
    if (!navigating) return;
    const t = window.setTimeout(() => setNavFrom(null), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [navigating]);

  const busy = navigating || fetching > 0 || mutating > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(busy), busy ? SHOW_AFTER_MS : 0);
    return () => clearTimeout(t);
  }, [busy]);

  if (!visible) return null;
  return (
    <>
      <div className="no-print fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden bg-navy-100/60" role="progressbar" aria-label="กำลังโหลด">
        <div className="loading-bar h-full w-1/3 rounded-full bg-gradient-to-r from-navy-500 via-navy-800 to-accent" />
      </div>
      {(navigating || mutating > 0) && (
        // Small card in the middle of the screen; no backdrop, the page stays visible.
        <div role="status" className="no-print pointer-events-none fixed inset-0 z-[70] flex items-center justify-center">
          <span className="flex min-w-40 flex-col items-center gap-2.5 rounded-2xl border border-navy-100 bg-white/95 px-6 py-5 text-sm font-medium text-navy-900 shadow-2xl backdrop-blur">
            <Loader2 className="size-8 animate-spin text-navy-700" aria-hidden />
            {navigating ? "กำลังโหลดหน้า…" : "กำลังบันทึก…"}
          </span>
        </div>
      )}
    </>
  );
}
