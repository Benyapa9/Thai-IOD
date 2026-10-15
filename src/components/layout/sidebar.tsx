"use client";

import { ChevronDown, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { NAV_BOTTOM, NAV_ITEMS, type NavItem, isActive } from "./nav";
import { useCurrentUser, usePrefs, useT } from "./user-context";
import { WhatsNewLink } from "./whats-new";

/**
 * Sidebar (MOM G2, N1–N4, N8, G3): collapses to icons on desktop via the
 * hamburger button, slides over the page on mobile/tablet.
 */
export function Sidebar({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const t = useT();
  const user = useCurrentUser();
  const { features } = user;
  const { locale, setLocale } = usePrefs();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "/insights": true });

  useEffect(() => setOpen(false), [pathname, setOpen]);
  // A group is shown only if at least one of its children is (UI only; pages are guarded on the server).
  const visible = (i: NavItem): boolean =>
    (!i.permission || features.includes(i.permission)) && (!i.children || i.children.some(visible));
  // On mobile the overlay always shows labels.
  const iconOnly = collapsed && !open;

  const link = (item: NavItem, depth = 0, small = false) => {
    const active = depth > 0 ? pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.match ?? []).some((m) => pathname.startsWith(m)) : isActive(pathname, item);
    return (
      <Link
        key={item.href + depth}
        href={item.href}
        title={iconOnly ? t(item.label) : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg transition-colors",
          small ? "text-[12.5px]" : "text-[14.5px]",
          iconOnly ? "justify-center px-0 py-2.5" : depth ? "py-2 pr-3 pl-10" : small ? "px-3 py-1.5" : "px-3 py-2.5",
          active
            ? depth
              ? "bg-white/15 font-medium text-white"
              : "bg-white font-medium text-navy-900"
            : "text-navy-200 hover:bg-white/10 hover:text-white",
        )}
      >
        <item.icon className={cn("shrink-0", depth || small ? "size-4" : "size-[18px]")} />
        {!iconOnly && <span className={small ? "leading-snug" : "truncate"}>{t(item.label)}</span>}
      </Link>
    );
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t("common.close")}
          className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-navy-100 shadow-xl transition-all duration-200",
          open ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0",
          !open && (collapsed ? "lg:w-[68px]" : "lg:w-60"),
        )}
      >
        <Link
          href="/home"
          className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10", iconOnly ? "justify-center px-2" : "px-4")}
          title={t("app.name")}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
            <Image src="/brand/thai-iod-logo.png" alt="Thai Institute of Directors" width={200} height={200} className="size-9" priority />
          </span>
          {!iconOnly && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-bold tracking-wide text-white">FINANCE</span>
              <span className="block truncate text-xs font-semibold tracking-[0.18em] text-accent-light">INTELLIGENCE</span>
            </span>
          )}
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
          {NAV_ITEMS.filter(visible).map((item) => {
            const kids = item.children?.filter(visible);
            if (!kids?.length || iconOnly) {
              return iconOnly && kids?.length ? (
                <div key={item.href} data-tour={item.tour}>
                  {kids.map((k) => link(k))}
                </div>
              ) : (
                link(item)
              );
            }
            const isOpen = expanded[item.href] ?? isActive(pathname, item);
            return (
              <div key={item.href} data-tour={item.tour}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [item.href]: !isOpen }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] transition-colors cursor-pointer",
                    isActive(pathname, item) ? "text-white" : "text-navy-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  <span className="flex-1 text-left">{t(item.label)}</span>
                  <ChevronDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
                </button>
                {isOpen && <div className="mt-0.5 space-y-0.5">{kids.map((k) => link(k, 1))}</div>}
              </div>
            );
          })}
        </nav>

        {/* Footer: help links, who is signed in, sign out, language, version. */}
        <div className="space-y-0.5 border-t border-white/10 p-2.5">{NAV_BOTTOM.filter(visible).map((item) => link(item, 0, true))}</div>
        {iconOnly ? (
          <form action={signOutAction} className="border-t border-white/10 p-2.5">
            <button
              type="submit"
              title={t("nav.signOut")}
              aria-label={t("nav.signOut")}
              className="flex w-full justify-center rounded-lg py-2.5 text-navy-200 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <LogOut className="size-[18px]" />
            </button>
          </form>
        ) : (
          <div className="space-y-2 border-t border-white/10 px-3.5 pt-2.5 pb-2.5">
            <Link href="/profile" className="block truncate text-xs text-navy-100 hover:text-white" title={user.email}>
              {user.name}
            </Link>
            <div className="flex items-center justify-between">
              <form action={signOutAction}>
                <button type="submit" className="text-xs font-semibold text-accent-light underline underline-offset-4 hover:text-white cursor-pointer">
                  {t("nav.signOut")}
                </button>
              </form>
              <div role="group" aria-label={t("nav.language")} className="flex items-center gap-1.5 text-xs">
                {(["th", "en"] as const).map((l, i) => (
                  <Fragment key={l}>
                    {i > 0 && (
                      <span className="text-white/25" aria-hidden>
                        |
                      </span>
                    )}
                    <button
                      type="button"
                      aria-pressed={locale === l}
                      onClick={() => setLocale(l)}
                      className={cn("cursor-pointer", locale === l ? "font-bold text-white" : "text-navy-300 hover:text-white")}
                    >
                      {l === "th" ? "ไทย" : "EN"}
                    </button>
                  </Fragment>
                ))}
              </div>
            </div>
            <WhatsNewLink />
          </div>
        )}
      </aside>
    </>
  );
}
