"use client";

import { Check, ChevronRight, Compass, Gauge, Home, LogOut, Menu, Moon, Palette, Plus, Settings, ShieldCheck, Sun, UserRound } from "lucide-react";
import { startTour } from "@/components/tour/tour-player";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DASHBOARD_PAGES } from "@/lib/alert-defs";
import { tierLabel } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { THEMES, type Theme } from "@/types/domain";
import { useCurrentUser, usePrefs, useT } from "./user-context";

const THEME_SWATCH: Record<Theme, { label: string; color: string }> = {
  navy: { label: "Navy", color: "#132642" },
  teal: { label: "Teal", color: "#143a3b" },
  burgundy: { label: "Burgundy", color: "#4f1e27" },
  forest: { label: "Forest", color: "#1c392b" },
  graphite: { label: "Graphite", color: "#2b2f36" },
  custom: { label: "สีที่เลือกเอง", color: "var(--theme-base)" },
};
const PRESET_THEMES = THEMES.filter((th) => th !== "custom");

type Crumb = { label: string; href?: string };

/** Header path such as Insight → Dashboard → Main → KPI (MOM N10). */
function useBreadcrumbs(): Crumb[] {
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const q = params.toString() ? `?${params}` : "";
  const insight = { label: t("nav.insight"), href: "/insights" };
  const dashboard = { label: t("nav.dashboard"), href: `/dashboard${q}` };

  if (pathname.startsWith("/dashboard")) {
    const page = Object.values(DASHBOARD_PAGES).find((p) => pathname === p.href);
    const crumbs: Crumb[] = [insight, dashboard];
    if (pathname.startsWith("/dashboard/main")) crumbs.push({ label: "Main", href: `/dashboard/main/kpi${q}` });
    if (page) crumbs.push({ label: page.label });
    return crumbs;
  }
  if (pathname.startsWith("/upload")) return [insight, { label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.upload") }];
  if (pathname.startsWith("/scenario")) return [insight, { label: t("nav.scenario") }];
  if (pathname.startsWith("/insights")) return [{ label: t("nav.insight") }];
  if (pathname.startsWith("/follow-up")) return [{ label: t("nav.followUp") }];
  if (pathname.startsWith("/feedback")) return [{ label: t("nav.feedback") }];
  if (pathname.startsWith("/usage")) return [{ label: t("nav.usage") }];
  if (pathname.startsWith("/profile")) return [{ label: t("nav.profile") }];
  if (pathname.startsWith("/admin/access")) return [{ label: t("nav.adminGroup"), href: "/admin/users" }, { label: t("nav.adminAccess") }];
  if (pathname.startsWith("/admin/tiers")) return [{ label: t("nav.adminGroup"), href: "/admin/users" }, { label: t("nav.adminTiers") }];
  if (pathname.startsWith("/admin")) return [{ label: t("nav.adminGroup"), href: "/admin/users" }, { label: t("nav.adminLevels") }];
  if (pathname.startsWith("/builder")) return [{ label: "Chart Builder (internal)" }];
  return [{ label: t("nav.home") }];
}

export function Avatar({ name, image, size = 36 }: { name: string; image: string | null; size?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL from Microsoft Graph
    return <img src={image} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-800"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.trim().slice(0, 2)}
    </span>
  );
}

export function Topbar({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const user = useCurrentUser();
  const t = useT();
  const { theme, setTheme, locale, setLocale, mode, setMode, customColor, setCustomColor } = usePrefs();
  const dark = mode === "dark";
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
  const crumbs = useBreadcrumbs();
  // Remember where the menu was opened, so navigating closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const menu = menuAt === pathname;
  const setMenu = (open: boolean) => setMenuAt(open ? pathname : null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuAt(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-white/60 bg-white/70 px-3 shadow-[0_1px_12px_rgba(16,24,40,0.05)] backdrop-blur-xl sm:px-4 lg:px-6">
      <button
        type="button"
        aria-label={t("nav.collapse")}
        title={t("nav.collapse")}
        className="rounded-md p-2 text-navy-900 hover:bg-muted cursor-pointer"
        onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? toggleCollapsed() : setOpen(true))}
      >
        <Menu className="size-5" />
      </button>
      <Link href="/home" title={t("nav.home")} aria-label={t("nav.home")} className="rounded-md p-2 text-navy-900 hover:bg-muted">
        <Home className="size-[18px]" />
      </Link>

      <nav aria-label="breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className={cn("flex min-w-0 items-center gap-1", i < crumbs.length - 2 && "hidden sm:flex")}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            {c.href ? (
              <Link href={c.href} className="truncate text-muted-foreground hover:text-navy-900 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-navy-900">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setMode(dark ? "light" : "dark")}
        aria-pressed={dark}
        aria-label={dark ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน"}
        title={dark ? "โหมดกลางวัน" : "โหมดกลางคืน"}
        className="rounded-full p-2 text-navy-900 hover:bg-muted cursor-pointer"
      >
        {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenu(!menu)}
          className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted sm:pr-2 cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <Avatar name={user.name} image={user.image} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-40 truncate text-sm font-medium text-navy-900">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{tierLabel(user.tier)} User</span>
          </span>
        </button>

        {menu && (
          <div role="menu" className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <Avatar name={user.name} image={user.image} size={42} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy-900">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.jobTitle ?? user.email}</div>
                <div className="mt-0.5 text-xs text-navy-700">{tierLabel(user.tier)} User</div>
              </div>
            </div>
            <div className="p-1.5">
              <MenuLink href="/profile" icon={UserRound}>
                {t("nav.profile")}
              </MenuLink>
              <MenuLink href="/usage" icon={Gauge}>
                {t("nav.usage")}
              </MenuLink>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAt(null);
                  startTour();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-navy-900 hover:bg-navy-50 cursor-pointer"
              >
                <Compass className="size-4 text-navy-600" /> {t("tour.replay")}
              </button>
              {user.features.includes("users.manage") && (
                <MenuLink href="/admin/users" icon={ShieldCheck}>
                  {t("nav.admin")}
                </MenuLink>
              )}
            </div>
            <div className="border-t border-border p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Palette className="size-3.5" /> {t("nav.theme")}
              </div>
              <div className="flex gap-1.5">
                {[...PRESET_THEMES, ...(theme === "custom" ? (["custom"] as const) : [])].map((th) => (
                  <button
                    key={th}
                    type="button"
                    title={THEME_SWATCH[th].label}
                    onClick={() => setTheme(th)}
                    className={cn("flex size-7 items-center justify-center rounded-full ring-offset-2 cursor-pointer", theme === th && "ring-2 ring-navy-500")}
                    style={{ background: THEME_SWATCH[th].color }}
                  >
                    {theme === th && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
                <label
                  title="เพิ่มสีเอง"
                  className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-navy-300 text-navy-700 hover:border-navy-500 focus-within:ring-2 focus-within:ring-navy-500"
                >
                  <Plus className="size-3.5" aria-hidden />
                  <span className="sr-only">เพิ่มสีธีมเอง</span>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <div className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">{t("nav.language")}</div>
              <div className="inline-flex rounded-md border border-border p-0.5">
                {(["th", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    className={cn("rounded px-3 py-1 text-xs font-medium cursor-pointer", locale === l ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-navy-50")}
                  >
                    {l === "th" ? "ไทย" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <form action={signOutAction} className="border-t border-border p-1.5">
              <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-danger hover:bg-danger-soft cursor-pointer">
                <LogOut className="size-4" /> {t("nav.signOut")}
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: typeof Settings; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-navy-900 hover:bg-navy-50">
      <Icon className="size-4 text-navy-600" /> {children}
    </Link>
  );
}
