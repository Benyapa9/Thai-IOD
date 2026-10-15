"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCurrentUser, useT } from "@/components/layout/user-context";
import type { MessageKey } from "@/lib/i18n";
import { type Rect, nextIndex, placeCard, shouldAutoStart, spotlightRect, stepPosition, stepsFor } from "@/lib/tour/engine";
import { MAIN_TOUR, TOURS } from "@/lib/tour/tours";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * The one tour player. It only reads lib/tour/tours.ts — adding a tour or a
 * step never needs changes here (see docs/TOUR.md). It never clicks or edits
 * anything for the user; the page behind is inert while the tour is open.
 */

export const TOUR_START_EVENT = "iod:tour-start";

/** Open a tour from anywhere (e.g. the "Replay tour" menu item). */
export function startTour(tourId: string = MAIN_TOUR.id) {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: tourId }));
}

const TARGET_TIMEOUT = 1500; // ms to wait for an element before skipping its step
const POLL_MS = 100;
const ACTIVE_KEY = "iod-tour-active"; // sessionStorage: survive a refresh mid-tour
const seenKey = (userId: string, tourId: string) => `iod-tour-seen:${userId}:${tourId}`;

interface Active {
  tourId: string;
  index: number;
  skipped: number[];
}

// Storage can throw (private windows, blocked cookies): the tour must still work.
function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function readStore<T>(kind: "local" | "session", key: string): T | null {
  try {
    const raw = storage(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeStore(kind: "local" | "session", key: string, value: unknown) {
  try {
    const s = storage(kind);
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — remembering is best effort; the server copy is the source of truth
  }
}

const toRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/** First visible element with this data-tour value (hidden or zero-size ones don't count). */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(name)}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSheet = () => window.matchMedia("(max-width: 640px)").matches;
const HEADER = 64; // sticky top bar + a little space

/**
 * Page scroll that brings the target into the free area: centred on desktop,
 * just under the top bar on phones (the bottom sheet covers the lower part).
 */
function scrollTargetY(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const free = window.innerHeight - HEADER - (isSheet() ? 260 : 0);
  const offset = isSheet() || r.height > free ? HEADER : HEADER + (free - r.height) / 2;
  return Math.max(0, window.scrollY + r.top - offset);
}
const inView = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.top < window.innerHeight - (isSheet() ? 260 : 80);
};

export function TourPlayer() {
  const user = useCurrentUser();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  const [active, setActive] = useState<Active | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);

  const activeRef = useRef<Active | null>(null);
  const dirRef = useRef<1 | -1>(1);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const tour = active ? (TOURS[active.tourId] ?? null) : null;
  const steps = useMemo(() => (tour ? stepsFor(tour, user.features) : []), [tour, user.features]);
  const step = active ? steps[active.index] : undefined;
  const skipped = useMemo(() => new Set(active?.skipped ?? []), [active]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const begin = useCallback((tourId: string, index = 0, skippedSteps: number[] = []) => {
    if (!TOURS[tourId]) return;
    const from = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Started from a dropdown that closes: return to its trigger button instead.
    returnFocusRef.current = from?.closest('[role="menu"]')
      ? (from.closest('[role="menu"]')?.parentElement?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? from)
      : from;
    dirRef.current = 1;
    setReady(false);
    setRect(null);
    setActive({ tourId, index, skipped: skippedSteps });
  }, []);

  // Resume after a refresh, or auto-start once for a first-time user (after the consent dialog).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeRef.current) return;
      const saved = readStore<Active & { userId: string }>("session", ACTIVE_KEY);
      if (saved && saved.userId === user.id && TOURS[saved.tourId]) {
        begin(saved.tourId, saved.index, saved.skipped ?? []);
        return;
      }
      if (!user.consentDecided || dismissedRef.current.has(`${user.id}:${MAIN_TOUR.id}`)) return;
      if (shouldAutoStart(MAIN_TOUR, user.tourSeen, readStore<number>("local", seenKey(user.id, MAIN_TOUR.id)))) begin(MAIN_TOUR.id);
    }, 700);
    return () => clearTimeout(timer);
  }, [user.id, user.consentDecided, user.tourSeen, begin]);

  // "Replay tour" from menus.
  useEffect(() => {
    const onStart = (e: Event) => begin((e as CustomEvent<string>).detail || MAIN_TOUR.id);
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [begin]);

  // Keep the position so a refresh continues where the user was.
  useEffect(() => {
    if (active) writeStore("session", ACTIVE_KEY, { ...active, userId: user.id });
  }, [active, user.id]);

  /** Finished or skipped: remember (server + this browser) and never auto-start this version again. */
  const close = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    const def = TOURS[current.tourId];
    dismissedRef.current.add(`${user.id}:${current.tourId}`); // per user: demo accounts can switch without a reload
    writeStore("local", seenKey(user.id, current.tourId), def.version);
    writeStore("session", ACTIVE_KEY, null);
    void fetch("/api/me/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourId: current.tourId, version: def.version }),
    }).catch(() => undefined);
    restoreFocusRef.current = true;
    targetRef.current = null;
    setActive(null);
    setRect(null);
    setReady(false);
  }, [user.id]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const current = activeRef.current;
      if (!current) return;
      const n = nextIndex(steps.length, current.index, dir, new Set(current.skipped));
      if (n === null) {
        if (dir === 1) close();
        return;
      }
      dirRef.current = dir;
      setReady(false);
      setActive({ ...current, index: n });
    },
    [steps.length, close],
  );

  // Resolve the current step: go to its page, wait for its element, scroll it to the centre.
  useEffect(() => {
    if (!active || !step) return;
    if (step.page && pathname !== step.page) {
      router.push(step.page);
      return; // runs again once the new page is showing
    }
    let openedSidebar = false;
    if (step.open === "sidebar" && window.matchMedia("(max-width: 1023px)").matches) {
      setSidebarOpen(true);
      openedSidebar = true;
    }
    const cleanupSidebar = () => {
      if (openedSidebar) setSidebarOpen(false);
    };

    if (!step.target) {
      // setTimeout, not requestAnimationFrame: rAF is paused in background tabs.
      const timer = window.setTimeout(() => {
        targetRef.current = null;
        setRect(null);
        setReady(true);
      }, 0);
      return () => {
        clearTimeout(timer);
        cleanupSidebar();
      };
    }

    const reduce = prefersReducedMotion();
    const started = Date.now();
    let settle = 0;
    const poll = window.setInterval(() => {
      const el = findTarget(step.target!);
      if (el) {
        clearInterval(poll);
        targetRef.current = el;
        window.scrollTo({ top: scrollTargetY(el), behavior: reduce ? "auto" : "smooth" });
        settle = window.setTimeout(
          () => {
            // Smooth scrolling can be cut short (or not run at all): make sure we arrived.
            if (!inView(el)) window.scrollTo({ top: scrollTargetY(el), behavior: "auto" });
            setRect(toRect(el));
            setReady(true);
          },
          reduce ? 30 : 450,
        );
      } else if (Date.now() - started > TARGET_TIMEOUT) {
        // Still loading or not available to this user: skip — never point at an empty spot.
        clearInterval(poll);
        setActive((a) => {
          if (!a) return a;
          const sk = new Set(a.skipped).add(a.index);
          let n = nextIndex(steps.length, a.index, dirRef.current, sk);
          if (n === null) {
            dirRef.current = 1;
            n = nextIndex(steps.length, a.index, 1, sk);
          }
          return n === null ? a : { ...a, index: n, skipped: [...sk] };
        });
      }
    }, POLL_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(settle);
      cleanupSidebar();
    };
  }, [active, step, pathname, router, steps.length, setSidebarOpen]);

  // Follow the element while the page scrolls or resizes.
  useEffect(() => {
    if (!ready) return;
    const update = () => {
      if (targetRef.current) setRect(toRect(targetRef.current));
      else placeCardNow();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /** Position the card beside the target (DOM write only; bottom sheet on phones). */
  function placeCardNow() {
    const card = cardRef.current;
    if (!card) return;
    if (isSheet()) {
      card.style.top = "";
      card.style.left = "";
      card.dataset.side = "sheet";
      return;
    }
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const hole = targetRef.current && rect ? spotlightRect(rect, vp) : null;
    const pos = placeCard(hole, { width: card.offsetWidth, height: card.offsetHeight }, vp);
    card.style.top = `${pos.top}px`;
    card.style.left = `${pos.left}px`;
    card.dataset.side = pos.side;
  }

  useLayoutEffect(() => {
    if (ready) placeCardNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rect, active]);

  // Each new step: move focus to the card so screen readers read its title and text.
  useEffect(() => {
    if (ready) cardRef.current?.focus();
  }, [ready, active?.index]);

  // The page behind can't be used during the tour; focus returns to where it was afterwards.
  useEffect(() => {
    const shell = document.getElementById("app-shell");
    if (active) shell?.setAttribute("inert", "");
    else {
      shell?.removeAttribute("inert");
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        const back = returnFocusRef.current;
        if (back?.isConnected) back.focus();
      }
    }
    return () => shell?.removeAttribute("inert");
  }, [active]);

  // Keyboard: Esc closes, ←/→ change step, Tab stays inside the card.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Tab") {
        const card = cardRef.current;
        if (!card) return;
        // Always move focus ourselves so it can never leave the card (even from the card itself).
        const items = [...card.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!items.length) return;
        e.preventDefault();
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next = at === -1 ? (e.shiftKey ? items.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close, go]);

  if (!active || !tour || !step) return null;

  const pos = stepPosition(steps.length, active.index, skipped);
  const hasPrev = nextIndex(steps.length, active.index, -1, skipped) !== null;
  const isLast = nextIndex(steps.length, active.index, 1, skipped) === null;
  const key = (part: "title" | "body") => `tour.${tour.id}.${step.id}.${part}` as MessageKey;
  const hole = ready && rect && typeof window !== "undefined" ? spotlightRect(rect, { width: window.innerWidth, height: window.innerHeight }) : null;

  return createPortal(
    <div className="tour-root no-print">
      {/* Blocks clicks on the page behind for the whole tour. */}
      <div className="fixed inset-0 z-[100]" aria-hidden="true" />
      {hole ? (
        <div
          aria-hidden="true"
          className="tour-hole pointer-events-none fixed z-[101] rounded-xl ring-2 ring-white/90 motion-safe:transition-all motion-safe:duration-300"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        />
      ) : (
        <div aria-hidden="true" className="tour-dim pointer-events-none fixed inset-0 z-[101]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className={cn(
          "tour-card fixed z-[102] w-[min(380px,calc(100vw-24px))] rounded-2xl p-5 shadow-2xl outline-none",
          "motion-safe:transition-[top,left,opacity] motion-safe:duration-300",
          // Phones: bottom sheet stuck to the bottom edge.
          "max-[640px]:inset-x-0 max-[640px]:top-auto max-[640px]:bottom-0 max-[640px]:w-full max-[640px]:rounded-b-none max-[640px]:pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          !ready && "invisible opacity-0",
        )}
        style={{ top: "30%", left: "calc(50% - 190px)" }}
      >
        <p className="tour-meta text-xs font-semibold tracking-wide">
          {t("tour.label")} · {t("tour.step", { n: pos.current, total: pos.total })}
        </p>
        <h2 id="tour-title" className="tour-title mt-1 text-lg leading-snug font-bold">
          {t(key("title"))}
        </h2>
        <p id="tour-body" className="tour-body mt-1.5 text-sm leading-relaxed">
          {t(key("body"))}
        </p>

        <div className="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: pos.total }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < pos.current ? "tour-dot-on" : "tour-dot")} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isLast && (
            <button type="button" onClick={close} className="tour-btn-ghost min-h-11 rounded-lg px-3 text-sm font-medium cursor-pointer">
              {t("tour.skip")}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={!hasPrev}
              className="tour-btn-secondary min-h-11 min-w-11 rounded-lg px-4 text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("tour.back")}
            </button>
            <button
              type="button"
              onClick={() => (isLast ? close() : go(1))}
              className="tour-btn-primary min-h-11 min-w-11 rounded-lg px-5 text-sm font-semibold cursor-pointer"
            >
              {isLast ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
        <p className="tour-meta mt-3 hidden text-xs sm:block">{t("tour.keys")}</p>
      </div>
    </div>,
    document.body,
  );
}
